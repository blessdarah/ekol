<?php

namespace App\Models;

use App\Enums\RoomKind;
use App\Enums\TimetableStatus;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * One whole timetable for a term. A draft is built and reviewed in
 * private; publishing makes it the live version and archives the last.
 *
 * @property string $id
 * @property string $school_id
 * @property string $term_id
 * @property int $number
 * @property TimetableStatus $status
 * @property array<string, bool>|null $options
 * @property Carbon|null $generated_at
 * @property int|null $generation_ms
 * @property Carbon|null $effective_on
 * @property Carbon|null $published_at
 * @property string|null $published_by
 */
class TimetableVersion extends Model
{
    use BelongsToSchool, HasUuids;

    /**
     * What the generator can be told, with the defaults.
     */
    public const array OPTIONS = [
        'keep_placed' => false,
        'spread' => true,
        'heavy_early' => true,
        'doubles' => true,
        'compact' => false,
    ];

    /**
     * A subject at or above this coefficient is kept out of the last period.
     */
    public const int HEAVY_COEFFICIENT = 4;

    public const array WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    protected $fillable = [
        'school_id',
        'term_id',
        'number',
        'status',
        'options',
        'generated_at',
        'generation_ms',
        'effective_on',
        'published_at',
        'published_by',
    ];

    /**
     * Who and what is busy when, keyed by "weekday|period".
     *
     * @var array{class: array<string, array<string, string>>, staff: array<string, array<string, list<string>>>, room: array<string, array<string, list<string>>>}|null
     */
    protected ?array $busy = null;

    /**
     * @var array{days: list<int>, periods: Collection<int, Period>, classes: Collection<array-key, SchoolClass>, lessons: Collection<int, ClassSubject>, rooms: Collection<array-key, Room>, teachers: Collection<array-key, User>}|null
     */
    protected ?array $world = null;

    protected ?School $owner = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => TimetableStatus::class,
            'options' => 'array',
            'generated_at' => 'datetime',
            'effective_on' => 'date',
            'published_at' => 'datetime',
        ];
    }

    public static function liveFor(Term $term): ?self
    {
        return static::where('term_id', $term->id)->where('status', TimetableStatus::Live)->first();
    }

    public static function draftFor(Term $term): ?self
    {
        return static::where('term_id', $term->id)->where('status', TimetableStatus::Draft)->first();
    }

    /**
     * The number the next draft will carry.
     */
    public static function nextNumber(Term $term): int
    {
        return ((int) static::where('term_id', $term->id)->max('number')) + 1;
    }

    /**
     * The term's draft, started when there is none. A new draft begins
     * as a copy of the live timetable, so only what changed needs work.
     */
    public static function startDraft(Term $term): self
    {
        return static::draftFor($term) ?? DB::transaction(function () use ($term) {
            $live = static::liveFor($term);
            $draft = static::create([
                'school_id' => $term->school_id,
                'term_id' => $term->id,
                'number' => static::nextNumber($term),
                'status' => TimetableStatus::Draft,
                'options' => [...static::OPTIONS, 'keep_placed' => $live !== null],
            ]);

            if ($live) {
                $rows = $live->slots()->get()->map(fn (TimetableSlot $slot) => [
                    ...$draft->row($slot->school_class_id, $slot->subject_id, $slot->staff_id, $slot->room_id, $slot->weekday, $slot->period_id),
                    'is_locked' => $slot->is_locked,
                ])->all();

                foreach (array_chunk($rows, 200) as $chunk) {
                    TimetableSlot::insert($chunk);
                }
            }

            return $draft;
        });
    }

    /**
     * Everything a timetable for this term has to fit together.
     *
     * @return array{days: list<int>, periods: Collection<int, Period>, classes: Collection<array-key, SchoolClass>, lessons: Collection<int, ClassSubject>, rooms: Collection<array-key, Room>, teachers: Collection<array-key, User>}
     */
    public static function worldFor(School $school, Term $term): array
    {
        $classes = SchoolClass::where('school_id', $school->id)
            ->where('academic_year_id', $term->academic_year_id)
            ->with('formMaster:id,full_name')
            ->orderBy('name')
            ->get()
            ->keyBy('id');
        $lessons = ClassSubject::whereIn('school_class_id', $classes->modelKeys())
            ->whereHas('subject')
            ->with('subject')
            ->get()
            ->values();

        return [
            'days' => array_values(array_filter(range(0, 6), fn (int $day) => ($school->school_days & (1 << $day)) !== 0)),
            'periods' => Period::where('school_id', $school->id)->where('is_break', false)->orderBy('ordinal')->get()->values(),
            'classes' => $classes,
            'lessons' => $lessons,
            'rooms' => Room::where('school_id', $school->id)->orderBy('code')->get()->keyBy('id'),
            'teachers' => User::where('school_id', $school->id)
                ->whereIn('id', $lessons->pluck('staff_id')->filter()->unique()->values())
                ->orderBy('full_name')
                ->get()
                ->keyBy('id'),
        ];
    }

    /**
     * Whether a teacher works at this time, by her record: her teaching
     * days and the periods she has blocked.
     *
     * @param  Collection<int, Period>  $periods
     */
    public static function teacherWorks(User $teacher, School $school, int $weekday, Period $period, Collection $periods): bool
    {
        $days = $teacher->teaching_days ?? $school->school_days;

        if (($days & (1 << $weekday)) === 0) {
            return false;
        }

        foreach ($teacher->unavailable_times ?? [] as $block) {
            if ((int) $block['weekday'] !== $weekday) {
                continue;
            }

            $from = $periods->firstWhere('label', $block['from'])?->ordinal;
            $end = $periods->firstWhere('label', $block['to']);
            $to = $end ? $end->ordinal : $from;

            if ($from !== null && $period->ordinal >= $from && $period->ordinal <= $to) {
                return false;
            }
        }

        return true;
    }

    public static function roomOpen(Room $room, int $weekday, string $periodId): bool
    {
        foreach ($room->unavailable ?? [] as $block) {
            if ((int) $block['weekday'] === $weekday && $block['period_id'] === $periodId) {
                return false;
            }
        }

        return true;
    }

    public static function key(int $weekday, string $periodId): string
    {
        return "{$weekday}|{$periodId}";
    }

    /**
     * @return array{days: list<int>, periods: Collection<int, Period>, classes: Collection<array-key, SchoolClass>, lessons: Collection<int, ClassSubject>, rooms: Collection<array-key, Room>, teachers: Collection<array-key, User>}
     */
    public function world(): array
    {
        return $this->world ??= static::worldFor($this->schoolOrFail(), $this->termOrFail());
    }

    /**
     * Drop what was read from the database, after slots change.
     */
    public function forget(): static
    {
        $this->busy = null;
        $this->unsetRelation('slots');

        return $this;
    }

    /**
     * Place every lesson that is not placed yet. Locked lessons always
     * stay; with keep_placed every lesson already on the grid stays too.
     *
     * @param  array<string, bool>  $options
     */
    public function generate(array $options): void
    {
        $started = microtime(true);
        $options = [...static::OPTIONS, ...array_intersect_key($options, static::OPTIONS)];

        DB::transaction(function () use ($options) {
            if (! $options['keep_placed']) {
                $this->slots()->where('is_locked', false)->delete();
            }

            $this->forget();
            $world = $this->world();
            $periods = $world['periods'];
            $school = $this->schoolOrFail();
            $last = $periods->count() - 1;
            $breakAfter = $this->breaksAfter();

            $subjectDay = [];
            $staffDay = [];
            $classDay = [];
            $placed = [];

            foreach ($this->slots as $slot) {
                $index = (int) $periods->search(fn (Period $period) => $period->id === $slot->period_id);
                $subjectDay["{$slot->school_class_id}|{$slot->subject_id}|{$slot->weekday}"][] = $index;
                $staffDay["{$slot->staff_id}|{$slot->weekday}"][] = $index;
                $classDay["{$slot->school_class_id}|{$slot->weekday}"] = ($classDay["{$slot->school_class_id}|{$slot->weekday}"] ?? 0) + 1;
                $placed["{$slot->school_class_id}|{$slot->subject_id}"] = ($placed["{$slot->school_class_id}|{$slot->subject_id}"] ?? 0) + 1;
            }

            $load = $world['lessons']->groupBy('staff_id')->map(fn (Collection $mine) => (int) $mine->sum('weekly_periods'));
            $lessons = $world['lessons']
                ->filter(fn (ClassSubject $lesson) => $lesson->staff_id !== null && $world['teachers']->has($lesson->staff_id))
                ->sortBy([
                    fn (ClassSubject $a, ClassSubject $b) => ($b->subject?->room_kind !== null) <=> ($a->subject?->room_kind !== null),
                    fn (ClassSubject $a, ClassSubject $b) => ($load[$b->staff_id] ?? 0) <=> ($load[$a->staff_id] ?? 0),
                    fn (ClassSubject $a, ClassSubject $b) => $b->weekly_periods <=> $a->weekly_periods,
                ]);
            $rows = [];

            foreach ($lessons as $lesson) {
                $subject = $lesson->subject;
                $teacher = $world['teachers']->get($lesson->staff_id);
                $class = $world['classes']->get($lesson->school_class_id);

                if (! $subject || ! $teacher || ! $class) {
                    continue;
                }

                $needed = $lesson->weekly_periods - ($placed["{$lesson->school_class_id}|{$lesson->subject_id}"] ?? 0);
                $heavy = (float) $subject->coefficient >= static::HEAVY_COEFFICIENT;

                for ($unit = 0; $unit < $needed; $unit++) {
                    $best = null;

                    foreach ($world['days'] as $day) {
                        $mine = $staffDay["{$teacher->id}|{$day}"] ?? [];

                        if ($teacher->max_periods_day !== null && count($mine) >= $teacher->max_periods_day) {
                            continue;
                        }

                        foreach ($periods as $index => $period) {
                            $key = static::key($day, $period->id);

                            if (isset($this->busy()['class'][$class->id][$key]) || isset($this->busy()['staff'][$teacher->id][$key])) {
                                continue;
                            }

                            if (! static::teacherWorks($teacher, $school, $day, $period, $periods)) {
                                continue;
                            }

                            $room = $this->pickRoom($class, $subject->room_kind, $day, $period->id);

                            if ($room === false) {
                                continue;
                            }

                            $same = $subjectDay["{$class->id}|{$subject->id}|{$day}"] ?? [];
                            $cost = $index * 0.1 + ($classDay["{$class->id}|{$day}"] ?? 0) * 0.4 + count($mine) * 0.3;

                            if ($same !== []) {
                                $beside = (in_array($index - 1, $same, true) && ! ($breakAfter[$index - 1] ?? false))
                                    || (in_array($index + 1, $same, true) && ! ($breakAfter[$index] ?? false));

                                $cost += match (true) {
                                    $options['doubles'] && $subject->room_kind !== null && count($same) === 1 && $beside => -8,
                                    $options['spread'] => 10 * count($same),
                                    default => 2 * count($same),
                                };
                            }

                            if ($options['heavy_early'] && $heavy && $index === $last) {
                                $cost += 6;
                            }

                            if ($options['compact'] && $mine !== [] && ! in_array($index - 1, $mine, true) && ! in_array($index + 1, $mine, true)) {
                                $cost += 3;
                            }

                            if ($best === null || $cost < $best['cost']) {
                                $best = ['cost' => $cost, 'day' => $day, 'index' => $index, 'period' => $period->id, 'room' => $room?->id];
                            }
                        }
                    }

                    if ($best === null) {
                        break;
                    }

                    $row = $this->row($class->id, $subject->id, $teacher->id, $best['room'], $best['day'], $best['period']);
                    $rows[] = $row;
                    $this->book($row['id'], $class->id, $teacher->id, $best['room'], static::key($best['day'], $best['period']));
                    $subjectDay["{$class->id}|{$subject->id}|{$best['day']}"][] = $best['index'];
                    $staffDay["{$teacher->id}|{$best['day']}"][] = $best['index'];
                    $classDay["{$class->id}|{$best['day']}"] = ($classDay["{$class->id}|{$best['day']}"] ?? 0) + 1;
                }
            }

            foreach (array_chunk($rows, 200) as $chunk) {
                TimetableSlot::insert($chunk);
            }

            $this->forget();
        });

        $this->update([
            'options' => $options,
            'generated_at' => now(),
            'generation_ms' => (int) round((microtime(true) - $started) * 1000),
        ]);
    }

    /**
     * A room for a lesson at a time: a room of the kind the subject
     * needs, else the class's home room, else any free classroom.
     * Null means the lesson goes without a room; false means the room
     * it needs cannot be had at this time.
     */
    public function pickRoom(SchoolClass $class, ?RoomKind $kind, int $weekday, string $periodId): Room|false|null
    {
        $key = static::key($weekday, $periodId);
        $rooms = $this->world()['rooms'];
        $free = fn (Room $room) => ! isset($this->busy()['room'][$room->id][$key]) && static::roomOpen($room, $weekday, $periodId);

        if ($kind !== null) {
            return $rooms
                ->filter(fn (Room $room) => $room->kind === $kind && $free($room))
                ->sortBy(fn (Room $room) => count($this->busy()['room'][$room->id] ?? []))
                ->first() ?? false;
        }

        $home = $class->home_room_id ? $rooms->get($class->home_room_id) : null;

        if ($home && $free($home)) {
            return $home;
        }

        $homes = $this->world()['classes']->pluck('home_room_id')->filter()->all();

        return $rooms
            ->filter(fn (Room $room) => $room->kind === RoomKind::Classroom && ! in_array($room->id, $homes, true) && $free($room))
            ->first();
    }

    /**
     * Times a lesson could move to, or be placed at, with nobody in the
     * way: the class, the teacher and the room are all free.
     *
     * @return list<array{weekday: int, period_id: string, room_id: string|null}>
     */
    public function freeTimes(ClassSubject $lesson, ?TimetableSlot $slot = null): array
    {
        $world = $this->world();
        $class = $world['classes']->get($lesson->school_class_id);
        $staffId = $slot ? $slot->staff_id : $lesson->staff_id;
        $teacher = $staffId ? User::whereKey($staffId)->first() : null;
        $times = [];

        if (! $class) {
            return [];
        }

        foreach ($world['days'] as $day) {
            foreach ($world['periods'] as $period) {
                $key = static::key($day, $period->id);

                if (isset($this->busy()['class'][$class->id][$key])) {
                    continue;
                }

                if ($teacher && (isset($this->busy()['staff'][$teacher->id][$key])
                    || ! static::teacherWorks($teacher, $this->schoolOrFail(), $day, $period, $world['periods']))) {
                    continue;
                }

                $room = $slot && $slot->room_id && $world['rooms']->has($slot->room_id)
                    ? $world['rooms']->get($slot->room_id)
                    : $this->pickRoom($class, $lesson->subject?->room_kind, $day, $period->id);

                if ($room === false) {
                    continue;
                }

                if ($room && $slot && (isset($this->busy()['room'][$room->id][$key]) || ! static::roomOpen($room, $day, $period->id))) {
                    continue;
                }

                $times[] = ['weekday' => $day, 'period_id' => $period->id, 'room_id' => $room?->id];
            }
        }

        return $times;
    }

    /**
     * What still has to be fixed before publishing: lessons with no
     * place, and people or rooms booked twice at once.
     *
     * @return list<array{type: string, kind: string, count: int, title: string, detail: string, lesson_id: string|null, slot_ids: list<string>, class_ids: list<string>, staff_id: string|null, room_id: string|null, weekday: int|null, period_id: string|null}>
     */
    public function issues(): array
    {
        $world = $this->world();
        $slots = $this->slots->keyBy('id');
        $periods = $world['periods']->keyBy('id');
        $issues = [];
        $placed = $this->slots->countBy(fn (TimetableSlot $slot) => "{$slot->school_class_id}|{$slot->subject_id}");

        foreach ($world['lessons'] as $lesson) {
            $missing = $lesson->weekly_periods - (int) $placed->get("{$lesson->school_class_id}|{$lesson->subject_id}", 0);

            if ($missing <= 0) {
                continue;
            }

            $issues[] = [
                'type' => 'unplaced',
                'kind' => 'unplaced',
                'count' => $missing,
                'title' => "{$lesson->subject?->name} · {$world['classes']->get($lesson->school_class_id)?->name}",
                'detail' => $this->whyUnplaced($lesson),
                'lesson_id' => $lesson->id,
                'slot_ids' => [],
                'class_ids' => [$lesson->school_class_id],
                'staff_id' => $lesson->staff_id,
                'room_id' => null,
                'weekday' => null,
                'period_id' => null,
            ];
        }

        $when = function (string $key) use ($periods): array {
            [$day, $periodId] = explode('|', $key);

            return [(int) $day, $periodId, static::WEEKDAYS[(int) $day].' '.$periods->get($periodId)?->label];
        };
        $named = fn (array $ids, \Closure $name): string => collect($ids)->map(fn (string $id) => $name($slots->get($id)))->filter()->join(', ', ' and ');

        foreach ($this->busy()['staff'] as $staffId => $times) {
            $teacher = $world['teachers']->get($staffId) ?? User::whereKey($staffId)->first();

            foreach ($times as $key => $ids) {
                [$day, $periodId, $label] = $when($key);
                $period = $periods->get($periodId);

                if (count($ids) > 1) {
                    $issues[] = [
                        'type' => 'clash',
                        'kind' => 'teacher',
                        'count' => 1,
                        'title' => "{$label} · {$teacher?->full_name}",
                        'detail' => 'In '.$named($ids, fn (?TimetableSlot $slot) => $slot?->schoolClass?->name).' at the same time',
                        'lesson_id' => null,
                        'slot_ids' => $ids,
                        'class_ids' => array_values(array_filter(array_map(fn (string $id) => $slots->get($id)?->school_class_id, $ids))),
                        'staff_id' => $staffId,
                        'room_id' => null,
                        'weekday' => $day,
                        'period_id' => $periodId,
                    ];
                } elseif ($teacher && $period && ! static::teacherWorks($teacher, $this->schoolOrFail(), $day, $period, $world['periods'])) {
                    $issues[] = [
                        'type' => 'clash',
                        'kind' => 'away',
                        'count' => 1,
                        'title' => "{$label} · {$teacher->full_name}",
                        'detail' => 'Not a time this teacher works, by the staff record',
                        'lesson_id' => null,
                        'slot_ids' => $ids,
                        'class_ids' => array_values(array_filter(array_map(fn (string $id) => $slots->get($id)?->school_class_id, $ids))),
                        'staff_id' => $staffId,
                        'room_id' => null,
                        'weekday' => $day,
                        'period_id' => $periodId,
                    ];
                }
            }
        }

        foreach ($this->busy()['room'] as $roomId => $times) {
            $room = $world['rooms']->get($roomId);

            foreach ($times as $key => $ids) {
                if (count($ids) < 2) {
                    continue;
                }

                [$day, $periodId, $label] = $when($key);

                $issues[] = [
                    'type' => 'clash',
                    'kind' => 'room',
                    'count' => 1,
                    'title' => "{$label} · {$room?->code}",
                    'detail' => 'Booked by '.$named($ids, fn (?TimetableSlot $slot) => $slot ? "{$slot->subject?->name} {$slot->schoolClass?->name}" : null),
                    'lesson_id' => null,
                    'slot_ids' => $ids,
                    'class_ids' => array_values(array_filter(array_map(fn (string $id) => $slots->get($id)?->school_class_id, $ids))),
                    'staff_id' => null,
                    'room_id' => $roomId,
                    'weekday' => $day,
                    'period_id' => $periodId,
                ];
            }
        }

        return $issues;
    }

    /**
     * How many things are left to fix: every unplaced lesson and every clash.
     */
    public function toFix(): int
    {
        return (int) array_sum(array_column($this->issues(), 'count'));
    }

    /**
     * Who and what is busy when, read from the slots once and kept up
     * to date while generating.
     *
     * @return array{class: array<string, array<string, string>>, staff: array<string, array<string, list<string>>>, room: array<string, array<string, list<string>>>}
     */
    public function busy(): array
    {
        if ($this->busy !== null) {
            return $this->busy;
        }

        $this->busy = ['class' => [], 'staff' => [], 'room' => []];

        foreach ($this->slots as $slot) {
            $this->book($slot->id, $slot->school_class_id, $slot->staff_id, $slot->room_id, static::key($slot->weekday, $slot->period_id));
        }

        return $this->busy;
    }

    /**
     * @return HasMany<TimetableSlot, $this>
     */
    public function slots(): HasMany
    {
        return $this->hasMany(TimetableSlot::class)->with(['subject', 'staff', 'room', 'schoolClass']);
    }

    /**
     * @return HasMany<TimetableChange, $this>
     */
    public function changes(): HasMany
    {
        return $this->hasMany(TimetableChange::class);
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * Whether a break follows each teaching period, by its position in
     * the day. A double period should not straddle a break.
     *
     * @return array<int, bool>
     */
    public function breaksAfter(): array
    {
        $all = Period::where('school_id', $this->school_id)->orderBy('ordinal')->get()->values();
        $after = [];
        $index = -1;

        foreach ($all as $period) {
            if ($period->is_break) {
                if ($index >= 0) {
                    $after[$index] = true;
                }

                continue;
            }

            $index++;
            $after[$index] = false;
        }

        return $after;
    }

    /**
     * A slot row ready for a bulk insert.
     *
     * @return array<string, mixed>
     */
    public function row(string $classId, ?string $subjectId, ?string $staffId, ?string $roomId, int $weekday, string $periodId): array
    {
        return [
            'id' => (string) Str::uuid7(),
            'school_id' => $this->school_id,
            'term_id' => $this->term_id,
            'timetable_version_id' => $this->id,
            'school_class_id' => $classId,
            'subject_id' => $subjectId,
            'staff_id' => $staffId,
            'room_id' => $roomId,
            'weekday' => $weekday,
            'period_id' => $periodId,
            'is_locked' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    protected function book(string $slotId, string $classId, ?string $staffId, ?string $roomId, string $key): void
    {
        $busy = $this->busy ?? ['class' => [], 'staff' => [], 'room' => []];
        $busy['class'][$classId][$key] = $slotId;

        if ($staffId) {
            $busy['staff'][$staffId][$key][] = $slotId;
        }

        if ($roomId) {
            $busy['room'][$roomId][$key][] = $slotId;
        }

        $this->busy = $busy;
    }

    /**
     * Why a lesson has no place, in the school's words.
     */
    protected function whyUnplaced(ClassSubject $lesson): string
    {
        if (! $lesson->staff_id) {
            return 'No teacher is assigned';
        }

        $world = $this->world();
        $teacher = $world['teachers']->get($lesson->staff_id);
        $class = $world['classes']->get($lesson->school_class_id);
        $kind = $lesson->subject?->room_kind;
        $both = false;

        if (! $teacher || ! $class) {
            return 'The teacher is no longer on the staff list';
        }

        foreach ($world['days'] as $day) {
            foreach ($world['periods'] as $period) {
                $key = static::key($day, $period->id);

                if (isset($this->busy()['class'][$class->id][$key]) || isset($this->busy()['staff'][$teacher->id][$key])
                    || ! static::teacherWorks($teacher, $this->schoolOrFail(), $day, $period, $world['periods'])) {
                    continue;
                }

                $both = true;

                if ($this->pickRoom($class, $kind, $day, $period->id) !== false) {
                    return 'A free slot exists. Place it in the timetable';
                }
            }
        }

        return $both && $kind
            ? "No {$kind->label()} is free when the teacher and the class are"
            : 'No slot where the teacher and the class are both free';
    }

    protected function schoolOrFail(): School
    {
        return $this->owner ??= School::whereKey($this->school_id)->firstOrFail();
    }

    protected function termOrFail(): Term
    {
        return Term::whereKey($this->term_id)->firstOrFail();
    }
}
