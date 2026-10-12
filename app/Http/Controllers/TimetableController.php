<?php

namespace App\Http\Controllers;

use App\Enums\RoomKind;
use App\Enums\TimetableStatus;
use App\Http\Requests\Timetable\GenerateTimetableRequest;
use App\Http\Requests\Timetable\PublishTimetableRequest;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Period;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Building a timetable version: the overview, then setup, the input
 * checks, generating and publishing. Reviewing has its own controller.
 */
class TimetableController extends Controller
{
    /**
     * Where the term's timetable stands, for the phase bar on every
     * timetable screen.
     *
     * @return array{term: string, draft: int, has_draft: bool, live: int|null, live_since: string|null, setup: bool, checks: bool, generated: bool, reviewed: bool, blocking: int, to_fix: int|null, current: string}
     */
    public static function phase(School $school, Term $term): array
    {
        $draft = TimetableVersion::draftFor($term);
        $live = TimetableVersion::liveFor($term);
        $inputs = static::inputs($school, $term);
        $setup = Period::where('school_id', $school->id)->where('is_break', false)->exists()
            && $school->school_days > 0
            && Room::where('school_id', $school->id)->exists();
        $checks = $setup && $inputs['blocking'] === [];
        $generated = $draft?->generated_at !== null;
        $toFix = $draft && ($generated || $draft->slots()->exists()) ? $draft->toFix() : null;
        $reviewed = $generated && $toFix === 0;
        $since = $live ? ($live->effective_on ?? $live->published_at) : null;

        return [
            'term' => $term->label,
            'draft' => $draft->number ?? TimetableVersion::nextNumber($term),
            'has_draft' => $draft !== null,
            'live' => $live?->number,
            'live_since' => $since?->toDateString(),
            'setup' => $setup,
            'checks' => $checks,
            'generated' => $generated,
            'reviewed' => $reviewed,
            'blocking' => count($inputs['blocking']),
            'to_fix' => $toFix,
            'current' => match (true) {
                ! $setup => 'setup',
                ! $checks => 'checks',
                ! $generated => 'generate',
                ! $reviewed => 'review',
                default => 'publish',
            },
        ];
    }

    /**
     * Whether the generator has what it needs. Blocking items stop it;
     * warnings do not.
     *
     * @return array{blocking: list<array{title: string, detail: string|null, action: array{label: string, href: string}|null}>, warnings: list<array{title: string, detail: string|null, action: array{label: string, href: string}|null}>, passed: list<string>}
     */
    public static function inputs(School $school, Term $term): array
    {
        $world = TimetableVersion::worldFor($school, $term);
        $slotsAWeek = count($world['days']) * $world['periods']->count();
        $blocking = [];
        $warnings = [];
        $passed = [];
        $item = fn (string $title, ?string $detail = null, ?string $label = null, ?string $href = null) => [
            'title' => $title,
            'detail' => $detail,
            'action' => $label && $href ? ['label' => $label, 'href' => $href] : null,
        ];

        if ($slotsAWeek === 0) {
            $blocking[] = $item('The school day has no periods or no school days', 'Lessons need periods to be placed in', 'Edit in School Setup', route('setup'));
        }

        if ($world['lessons']->isEmpty()) {
            $blocking[] = $item('No class takes any subject yet', 'Add subjects to classes first', 'Open subjects', route('classes.subjects'));
        }

        $unstaffed = $world['lessons']->filter(fn (ClassSubject $lesson) => $lesson->staff_id === null);

        foreach ($unstaffed as $lesson) {
            $blocking[] = $item(
                "{$lesson->subject?->name} in {$world['classes']->get($lesson->school_class_id)?->name} has no teacher",
                "{$lesson->weekly_periods} ".($lesson->weekly_periods === 1 ? 'lesson' : 'lessons').' a week would be left out',
                'Assign a teacher',
                route('classes.subjects.edit', $lesson->subject_id),
            );
        }

        if ($unstaffed->isEmpty() && $world['lessons']->isNotEmpty()) {
            $passed[] = 'Every subject has a teacher in every class';
        }

        $full = false;

        foreach ($world['lessons']->groupBy('school_class_id') as $classId => $lessons) {
            $periods = (int) $lessons->sum('weekly_periods');

            if ($slotsAWeek > 0 && $periods > $slotsAWeek) {
                $full = true;
                $blocking[] = $item(
                    "{$world['classes']->get($classId)?->name} has {$periods} periods a week for {$slotsAWeek} slots",
                    'Lower the weekly periods of a subject in this class',
                    'Open subjects',
                    route('classes.subjects'),
                );
            }
        }

        if (! $full && $slotsAWeek > 0) {
            $passed[] = "No class has more than {$slotsAWeek} periods";
        }

        $homeless = $world['classes']->filter(fn (SchoolClass $class) => $class->home_room_id === null
            && $world['lessons']->contains('school_class_id', $class->id));

        foreach ($homeless as $class) {
            $warnings[] = $item("{$class->name} has no home room", 'Its lessons take any free classroom, or none', 'Set under Levels', route('classes'));
        }

        if ($homeless->isEmpty() && $world['classes']->isNotEmpty()) {
            $passed[] = 'Every class has a home room';
        }

        $covered = true;

        foreach (RoomKind::special() as $kind) {
            $needed = (int) $world['lessons']->filter(fn (ClassSubject $lesson) => $lesson->subject?->room_kind === $kind)->sum('weekly_periods');
            $rooms = $world['rooms']->filter(fn (Room $room) => $room->kind === $kind);
            $capacity = $rooms->count() * $slotsAWeek - (int) $rooms->sum(fn (Room $room) => count($room->unavailable ?? []));

            if ($needed === 0) {
                continue;
            }

            if ($rooms->isEmpty() || $needed > $capacity) {
                $covered = false;
                $blocking[] = $item(
                    $rooms->isEmpty()
                        ? "{$needed} lessons a week need a {$kind->label()} and the school has none"
                        : "{$needed} lessons a week need a {$kind->label()}, which has {$capacity} slots",
                    'Add a room of this kind, or change which subjects need it',
                    'Manage rooms',
                    route('timetable.rooms'),
                );
            } elseif ($needed >= $capacity * 0.9) {
                $warnings[] = $item(
                    $rooms->count() === 1
                        ? "{$rooms->first()->code} is needed for {$needed} of its {$capacity} slots. Little room to move lessons."
                        : "{$kind->label()}s are needed for {$needed} of their {$capacity} slots. Little room to move lessons.",
                    null,
                    'Manage rooms',
                    route('timetable.rooms'),
                );
            }
        }

        if ($covered) {
            $passed[] = 'Rooms cover every practical lesson';
        }

        $within = true;

        foreach ($world['teachers'] as $teacher) {
            $periods = (int) $world['lessons']->where('staff_id', $teacher->id)->sum('weekly_periods');
            $open = 0;

            foreach ($world['days'] as $day) {
                foreach ($world['periods'] as $period) {
                    $open += TimetableVersion::teacherWorks($teacher, $school, $day, $period, $world['periods']) ? 1 : 0;
                }
            }

            if ($periods > $open) {
                $within = false;
                $blocking[] = $item(
                    "{$teacher->full_name} has {$periods} periods a week and works {$open}",
                    'Change the teaching days, or give some classes to another teacher',
                    'Open teacher record',
                    route('staff.show', $teacher->id),
                );
            } elseif ($teacher->max_periods_week !== null && $periods > $teacher->max_periods_week) {
                $within = false;
                $warnings[] = $item(
                    "{$teacher->full_name} has {$periods} periods a week. The limit is {$teacher->max_periods_week}.",
                    null,
                    'Open teacher record',
                    route('staff.show', $teacher->id),
                );
            } elseif ($open > 0 && $periods >= $open * 0.9) {
                $warnings[] = $item(
                    "{$teacher->full_name} teaches {$periods} of the {$open} periods worked. Few free periods.",
                    null,
                    'Open teacher record',
                    route('staff.show', $teacher->id),
                );
            }
        }

        if ($within && $world['teachers']->isNotEmpty()) {
            $passed[] = "All {$world['teachers']->count()} teachers are within their weekly limit";
        }

        return ['blocking' => $blocking, 'warnings' => $warnings, 'passed' => $passed];
    }

    /**
     * The school and its current term, for a role allowed to build the
     * timetable. Without a term there is nothing to build for.
     *
     * @return array{0: School, 1: Term|null}
     */
    public static function context(Request $request): array
    {
        $school = StructureController::schoolFor($request);

        return [$school, StudentController::currentTerm($school)];
    }

    public function index(Request $request): Response
    {
        [$school, $term] = static::context($request);

        if (! $term) {
            return Inertia::render('timetable/overview', ['phase' => null]);
        }

        $world = TimetableVersion::worldFor($school, $term);
        $inputs = static::inputs($school, $term);
        $live = TimetableVersion::liveFor($term);
        $rooms = $world['rooms']->count();
        $days = count($world['days']);

        return Inertia::render('timetable/overview', [
            'phase' => static::phase($school, $term),
            'summary' => [
                'lessons' => (int) $world['lessons']->sum('weekly_periods'),
                'classes' => $world['classes']->count(),
                'teachers' => $world['teachers']->count(),
                'rooms' => $rooms,
            ],
            'setupLine' => "{$world['periods']->count()} periods a day, {$days} ".($days === 1 ? 'day' : 'days').". {$rooms} ".($rooms === 1 ? 'room' : 'rooms').". Teaching days and hours for {$world['teachers']->count()} teachers.",
            'warnings' => count($inputs['warnings']),
            'firstProblem' => $inputs['blocking'][0]['title'] ?? null,
            'live' => $live ? [
                'number' => $live->number,
                'published' => $live->published_at?->toDateString(),
            ] : null,
        ]);
    }

    public function setup(Request $request): Response|RedirectResponse
    {
        [$school, $term] = static::context($request);

        if (! $term) {
            return redirect()->route('timetable');
        }

        $world = TimetableVersion::worldFor($school, $term);
        $homes = $world['classes']->filter(fn (SchoolClass $class) => $class->home_room_id !== null)->keyBy('home_room_id');
        $needs = $world['lessons']->map(fn (ClassSubject $lesson) => $lesson->subject)->filter()->unique('id');

        return Inertia::render('timetable/setup', [
            'phase' => static::phase($school, $term),
            'schoolDays' => $school->school_days,
            'periods' => Period::where('school_id', $school->id)->orderBy('ordinal')->get()->map(fn (Period $period) => [
                'id' => $period->id,
                'label' => $period->label,
                'starts_at' => substr($period->starts_at, 0, 5),
                'ends_at' => substr($period->ends_at, 0, 5),
                'is_break' => $period->is_break,
            ]),
            'rooms' => [
                'total' => $world['rooms']->count(),
                'rows' => $world['rooms']->take(6)->map(fn (Room $room) => [
                    'id' => $room->id,
                    'code' => $room->code,
                    'kind' => $room->kind->label(),
                    'capacity' => $room->capacity,
                    'home' => $homes->get($room->id)?->name,
                    'subjects' => $needs->filter(fn ($subject) => $subject->room_kind === $room->kind)->pluck('name')->values(),
                ])->values(),
            ],
            'practicals' => $needs->filter(fn ($subject) => $subject->room_kind !== null)->pluck('name')->values(),
            'teachers' => $world['teachers']->map(function (User $teacher) use ($world, $school) {
                $periods = (int) $world['lessons']->where('staff_id', $teacher->id)->sum('weekly_periods');

                return [
                    'id' => $teacher->id,
                    'name' => $teacher->full_name,
                    'days' => $teacher->teaching_days ?? $school->school_days,
                    'part_time' => $teacher->teaching_days !== null && $teacher->teaching_days !== $school->school_days,
                    'periods' => $periods,
                    'max' => $teacher->max_periods_week,
                ];
            })->values(),
        ]);
    }

    public function checks(Request $request): Response|RedirectResponse
    {
        [$school, $term] = static::context($request);

        if (! $term) {
            return redirect()->route('timetable');
        }

        return Inertia::render('timetable/checks', [
            'phase' => static::phase($school, $term),
            'inputs' => static::inputs($school, $term),
        ]);
    }

    public function generator(Request $request): Response|RedirectResponse
    {
        [$school, $term] = static::context($request);

        if (! $term) {
            return redirect()->route('timetable');
        }

        $draft = TimetableVersion::draftFor($term);
        $world = TimetableVersion::worldFor($school, $term);
        $total = (int) $world['lessons']->sum('weekly_periods');
        $issues = $draft ? $draft->issues() : [];
        $unplaced = (int) collect($issues)->where('type', 'unplaced')->sum('count');
        $slotsAWeek = count($world['days']) * $world['periods']->count();
        $taught = $draft ? $draft->slots->whereNotNull('staff_id')->countBy('staff_id') : collect();

        return Inertia::render('timetable/generate', [
            'phase' => static::phase($school, $term),
            'options' => [...TimetableVersion::OPTIONS, ...($draft->options ?? []), ...(TimetableVersion::liveFor($term) && ! $draft ? ['keep_placed' => true] : [])],
            'locked' => $draft ? $draft->slots->where('is_locked', true)->count() : 0,
            'onGrid' => $draft ? $draft->slots->count() : 0,
            'heavy' => TimetableVersion::HEAVY_COEFFICIENT,
            'result' => $draft?->generated_at ? [
                'placed' => $total - $unplaced,
                'total' => $total,
                'unplaced' => $unplaced,
                'clashes' => collect($issues)->where('type', 'clash')->count(),
                'free' => $taught->isNotEmpty() && count($world['days']) > 0
                    ? round($taught->map(fn (int $lessons) => max(0, $slotsAWeek - $lessons) / count($world['days']))->avg(), 1)
                    : null,
                'seconds' => $draft->generation_ms !== null ? round($draft->generation_ms / 1000, 1) : null,
                'at' => $draft->generated_at->toIso8601String(),
            ] : null,
            'issues' => collect($issues)->map(fn (array $issue) => [
                'type' => $issue['type'],
                'count' => $issue['count'],
                'title' => $issue['title'],
                'detail' => $issue['detail'],
                'class_id' => $issue['class_ids'][0] ?? null,
            ])->values(),
        ]);
    }

    public function generate(GenerateTimetableRequest $request): RedirectResponse
    {
        [$school, $term] = static::context($request);
        $term ??= throw ValidationException::withMessages(['generate' => 'No term is active. Make one active in School Setup first.']);

        $data = $request->validated();

        if (static::inputs($school, $term)['blocking'] !== []) {
            throw ValidationException::withMessages([
                'generate' => 'The generator cannot run yet. Fix what Check inputs lists first.',
            ]);
        }

        $draft = TimetableVersion::startDraft($term);
        $draft->generate(array_map(fn (mixed $value) => (bool) $value, $data['options']));

        $this->audit($request, $school, $draft, 'generated', [
            'version' => $draft->number,
            'options' => $draft->options,
            'to_fix' => $draft->forget()->toFix(),
        ]);

        $this->notify('Timetable generated.');

        return back();
    }

    public function publishing(Request $request): Response|RedirectResponse
    {
        [$school, $term] = static::context($request);
        $draft = $term ? TimetableVersion::draftFor($term) : null;

        if (! $term || ! $draft) {
            return redirect()->route('timetable');
        }

        $world = $draft->world();
        $issues = collect($draft->issues());
        $total = (int) $world['lessons']->sum('weekly_periods');
        $unplaced = (int) $issues->where('type', 'unplaced')->sum('count');
        $live = TimetableVersion::liveFor($term);

        return Inertia::render('timetable/publish', [
            'phase' => static::phase($school, $term),
            'checks' => [
                'placed' => $total - $unplaced,
                'total' => $total,
                'clashes' => $issues->where('type', 'clash')->count(),
            ],
            'warnings' => collect(static::inputs($school, $term)['warnings'])
                ->filter(fn (array $warning) => $warning['action'] !== null && str_contains($warning['action']['href'], '/staff/'))
                ->values(),
            'diff' => $live ? $this->diff($live, $draft) : null,
            'defaultDate' => max(today(), $term->starts_on)->toDateString(),
            'termEnds' => $term->ends_on->toDateString(),
        ]);
    }

    public function publish(PublishTimetableRequest $request): RedirectResponse
    {
        [$school, $term] = static::context($request);
        $draft = $term ? TimetableVersion::draftFor($term) : null;

        if (! $term || ! $draft) {
            throw ValidationException::withMessages(['publish' => 'There is no draft timetable to publish.']);
        }

        $data = $request->validated();

        if ($draft->slots->isEmpty() || $draft->toFix() > 0) {
            throw ValidationException::withMessages([
                'publish' => 'This version still has lessons to place or clashes to clear. Finish the review first.',
            ]);
        }

        DB::transaction(function () use ($request, $school, $term, $draft, $data) {
            TimetableVersion::where('term_id', $term->id)
                ->where('status', TimetableStatus::Live)
                ->update(['status' => TimetableStatus::Archived]);

            $draft->update([
                'status' => TimetableStatus::Live,
                'effective_on' => $data['effective_on'],
                'published_at' => now(),
                'published_by' => $request->user()?->id,
            ]);

            $this->audit($request, $school, $draft, 'published', [
                'version' => $draft->number,
                'effective_on' => $data['effective_on'],
            ]);
        });

        $this->notify('Timetable published.');

        return redirect()->route('timetable');
    }

    /**
     * What a draft changes against the live timetable.
     *
     * @return array{from: int, added: int, added_subjects: list<string>, moved: int, teachers: int, classes: int}
     */
    protected function diff(TimetableVersion $live, TimetableVersion $draft): array
    {
        $lesson = fn (TimetableSlot $slot) => "{$slot->school_class_id}|{$slot->subject_id}";
        $place = fn (TimetableSlot $slot) => "{$lesson($slot)}|{$slot->weekday}|{$slot->period_id}";
        $full = fn (TimetableSlot $slot) => "{$place($slot)}|{$slot->staff_id}|{$slot->room_id}";
        $before = $live->slots->countBy($lesson);
        $added = [];

        foreach ($draft->slots->groupBy($lesson) as $key => $slots) {
            $more = $slots->count() - (int) $before->get($key, 0);

            if ($more > 0) {
                $name = (string) $slots->first()?->subject?->name;
                $added[$name] = ($added[$name] ?? 0) + $more;
            }
        }

        $was = $live->slots->map($place)->all();
        $week = fn (TimetableVersion $version, string $by) => $version->slots
            ->groupBy($by)
            ->map(fn ($mine) => $mine->map($full)->sort()->values()->all());
        $changed = function (string $by) use ($live, $draft, $week): int {
            $old = $week($live, $by);
            $new = $week($draft, $by);

            return $new->keys()->merge($old->keys())->unique()->filter()
                ->filter(fn (int|string $id) => $old->get($id) !== $new->get($id))
                ->count();
        };

        return [
            'from' => $live->number,
            'added' => (int) array_sum($added),
            'added_subjects' => array_map(fn (string $name, int $count) => "{$name} ({$count})", array_keys($added), $added),
            'moved' => max(0, $draft->slots->reject(fn (TimetableSlot $slot) => in_array($place($slot), $was, true))->count() - (int) array_sum($added)),
            'teachers' => $changed('staff_id'),
            'classes' => $changed('school_class_id'),
        ];
    }

    protected function audit(Request $request, School $school, TimetableVersion $version, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'timetable_version',
            'entity_id' => $version->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
