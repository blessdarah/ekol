<?php

namespace App\Http\Controllers;

use App\Enums\RoomKind;
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
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The timetable as a grid, by class, teacher or room, and the moves
 * that fix it: place, move, change teacher or room, lock, take off.
 */
class TimetableReviewController extends Controller
{
    protected const array VIEWS = ['class', 'teacher', 'room'];

    protected const int MOVES_SHOWN = 6;

    public function show(Request $request): Response|RedirectResponse
    {
        [$school, $term] = TimetableController::context($request);

        if (! $term) {
            return redirect()->route('timetable');
        }

        $wantsLive = $request->query('version') === 'live';
        $version = $wantsLive
            ? TimetableVersion::liveFor($term)
            : (TimetableVersion::draftFor($term) ?? TimetableVersion::liveFor($term));

        if (! $version) {
            return redirect()->route('timetable.generate');
        }

        $readOnly = $version->status->value !== 'draft';
        $world = $version->world();
        $issues = collect($version->issues());
        $view = in_array($request->query('view'), static::VIEWS, true) ? (string) $request->query('view') : 'class';
        $picker = collect($this->picker($version, $view, $issues, $school));
        $id = (string) $request->query('id', '');
        $current = $picker->firstWhere('id', $id)
            ?? $picker->first(fn (array $row) => $row['issues'] > 0)
            ?? $picker->first();

        $column = ['class' => 'school_class_id', 'teacher' => 'staff_id', 'room' => 'room_id'][$view];
        $slots = $current ? $version->slots->where($column, $current['id']) : collect();
        $clashing = $issues->where('type', 'clash')->flatMap(fn (array $issue) => $issue['slot_ids'])->all();
        $cells = [];

        foreach ($slots as $slot) {
            $cells[TimetableVersion::key($slot->weekday, $slot->period_id)][] = [
                'id' => $slot->id,
                'title' => match ($view) {
                    'teacher' => (string) $slot->schoolClass?->name,
                    default => (string) $slot->subject?->name,
                },
                'sub' => match ($view) {
                    'class' => trim($this->short($slot->staff).' · '.($slot->room->code ?? 'no room'), ' ·'),
                    'teacher' => $slot->room->code ?? 'no room',
                    default => (string) $slot->schoolClass?->name,
                },
                'tone' => $slot->schoolClass?->stream === 'science' ? 'science' : 'primary',
                'clash' => in_array($slot->id, $clashing, true),
                'locked' => $slot->is_locked,
            ];
        }

        $selected = null;
        $slotId = (string) $request->query('slot', '');
        $lessonId = (string) $request->query('lesson', '');

        if ($slotId !== '' && ($slot = $version->slots->firstWhere('id', $slotId))) {
            $selected = $this->slotPanel($version, $slot, $issues, $school, $readOnly);
        } elseif ($lessonId !== '' && ! $readOnly && ($lesson = $world['lessons']->firstWhere('id', $lessonId))) {
            $selected = $this->lessonPanel($version, $lesson, $issues);
        }

        return Inertia::render('timetable/review', [
            'phase' => TimetableController::phase($school, $term),
            'version' => ['number' => $version->number, 'live' => $readOnly],
            'view' => $view,
            'picker' => $picker->values(),
            'current' => $current,
            'days' => collect($world['days'])->map(fn (int $day) => [
                'index' => $day,
                'short' => substr(TimetableVersion::WEEKDAYS[$day], 0, 3),
            ])->values(),
            'periods' => Period::where('school_id', $school->id)->orderBy('ordinal')->get()->map(fn (Period $period) => [
                'id' => $period->id,
                'label' => $period->label,
                'is_break' => $period->is_break,
            ]),
            'cells' => $cells === [] ? new \stdClass : $cells,
            'closed' => $current ? $this->closed($version, $view, $current['id'], $school) : [],
            'unplaced' => $view === 'class' && $current
                ? $issues->where('type', 'unplaced')
                    ->filter(fn (array $issue) => in_array($current['id'], $issue['class_ids'], true))
                    ->map(fn (array $issue) => [
                        'lesson_id' => $issue['lesson_id'],
                        'subject' => explode(' · ', $issue['title'])[0],
                        'count' => $issue['count'],
                    ])->values()
                : [],
            'clashes' => $current
                ? $issues->where('type', 'clash')
                    ->filter(fn (array $issue) => match ($view) {
                        'teacher' => $issue['staff_id'] === $current['id'],
                        'room' => $issue['room_id'] === $current['id'],
                        default => in_array($current['id'], $issue['class_ids'], true),
                    })
                    ->map(fn (array $issue) => [
                        'title' => $issue['title'],
                        'detail' => $issue['detail'],
                        'slot_id' => $issue['slot_ids'][0] ?? null,
                    ])->values()
                : [],
            'selected' => $selected,
        ]);
    }

    /**
     * Place one lesson that has no place yet.
     */
    public function store(Request $request): RedirectResponse
    {
        [$school, $term] = TimetableController::context($request);
        $draft = $this->draft($term);
        $world = $draft->world();

        $data = $request->validate([
            'lesson_id' => ['required', 'uuid'],
            'weekday' => ['required', 'integer', Rule::in($world['days'])],
            'period_id' => ['required', Rule::in($world['periods']->modelKeys())],
        ]);

        $lesson = $world['lessons']->firstWhere('id', $data['lesson_id']);
        $class = $lesson ? $world['classes']->get($lesson->school_class_id) : null;

        if (! $lesson || ! $class) {
            throw ValidationException::withMessages(['move' => 'That lesson is no longer on the list.']);
        }

        $placed = $draft->slots->where('school_class_id', $class->id)->where('subject_id', $lesson->subject_id)->count();

        if ($placed >= $lesson->weekly_periods) {
            throw ValidationException::withMessages(['move' => 'Every lesson of that subject is already placed.']);
        }

        $weekday = (int) $data['weekday'];
        $this->guard($draft, $school, $class->id, $lesson->staff_id, null, $weekday, $data['period_id'], null, ['time']);
        $room = $draft->pickRoom($class, $lesson->subject?->room_kind, $weekday, $data['period_id']);

        if ($room === false) {
            throw ValidationException::withMessages([
                'move' => "No {$lesson->subject?->room_kind?->label()} is free at that time.",
            ]);
        }

        $slot = TimetableSlot::create([
            ...$draft->row($class->id, $lesson->subject_id, $lesson->staff_id, $room?->id, $weekday, $data['period_id']),
        ]);

        $this->audit($request, $school, $slot, 'placed', ['weekday' => $weekday, 'period_id' => $data['period_id']]);

        return back();
    }

    /**
     * Move a lesson, change its teacher or room, or lock it. A change
     * that would put someone in two places at once is refused.
     */
    public function update(Request $request, string $slot): RedirectResponse
    {
        [$school, $term] = TimetableController::context($request);
        $draft = $this->draft($term);
        $world = $draft->world();
        $target = $draft->slots->firstWhere('id', $slot) ?? abort(404);

        $data = $request->validate([
            'weekday' => ['sometimes', 'required_with:period_id', 'integer', Rule::in($world['days'])],
            'period_id' => ['sometimes', 'required_with:weekday', Rule::in($world['periods']->modelKeys())],
            'staff_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')->where('school_id', $school->id)],
            'room_id' => ['sometimes', 'nullable', Rule::exists('rooms', 'id')->where('school_id', $school->id)->whereNull('deleted_at')],
            'is_locked' => ['sometimes', 'boolean'],
        ]);

        $weekday = (int) ($data['weekday'] ?? $target->weekday);
        $periodId = (string) ($data['period_id'] ?? $target->period_id);
        $staffId = array_key_exists('staff_id', $data) ? $data['staff_id'] : $target->staff_id;
        $roomId = array_key_exists('room_id', $data) ? $data['room_id'] : $target->room_id;
        $moved = $weekday !== $target->weekday || $periodId !== $target->period_id;

        $this->guard($draft, $school, $target->school_class_id, $staffId, $roomId, $weekday, $periodId, $target->id, array_keys(array_filter([
            'time' => $moved,
            'staff' => $moved || $staffId !== $target->staff_id,
            'room' => $moved || $roomId !== $target->room_id,
        ])));

        $before = $target->only(['weekday', 'period_id', 'staff_id', 'room_id', 'is_locked']);
        TimetableSlot::whereKey($target->id)->update([
            'weekday' => $weekday,
            'period_id' => $periodId,
            'staff_id' => $staffId,
            'room_id' => $roomId,
            'is_locked' => $data['is_locked'] ?? $target->is_locked,
        ]);

        $this->audit($request, $school, $target, 'changed', ['before' => $before, 'after' => $data]);

        return back();
    }

    /**
     * Take a lesson off the grid; it goes back to the not-placed list.
     */
    public function destroy(Request $request, string $slot): RedirectResponse
    {
        [$school, $term] = TimetableController::context($request);
        $draft = $this->draft($term);
        $target = $draft->slots->firstWhere('id', $slot) ?? abort(404);

        TimetableSlot::whereKey($target->id)->delete();
        $this->audit($request, $school, $target, 'unplaced', $target->only(['weekday', 'period_id', 'subject_id']));

        return back();
    }

    protected function draft(?Term $term): TimetableVersion
    {
        $draft = $term ? TimetableVersion::draftFor($term) : null;

        return $draft ?? throw ValidationException::withMessages([
            'move' => 'There is no draft timetable to change. The live timetable changes through Changes.',
        ]);
    }

    /**
     * Refuse a placement that double-books the class, the teacher or
     * the room, or uses a time one of them is not there.
     *
     * @param  list<string>  $checks
     */
    protected function guard(
        TimetableVersion $draft,
        School $school,
        string $classId,
        ?string $staffId,
        ?string $roomId,
        int $weekday,
        string $periodId,
        ?string $exceptId,
        array $checks,
    ): void {
        $world = $draft->world();
        $key = TimetableVersion::key($weekday, $periodId);
        $busy = $draft->busy();
        $others = fn (array $ids) => array_values(array_diff($ids, [$exceptId]));
        $period = $world['periods']->firstWhere('id', $periodId);
        $when = TimetableVersion::WEEKDAYS[$weekday].' '.$period?->label;

        if (in_array('time', $checks, true)) {
            $taken = $busy['class'][$classId][$key] ?? null;

            if ($taken !== null && $taken !== $exceptId) {
                throw ValidationException::withMessages(['move' => "The class already has a lesson on {$when}."]);
            }
        }

        if ($staffId && in_array('staff', $checks, true)) {
            $teacher = User::where('school_id', $school->id)->whereKey($staffId)->first();

            if ($others($busy['staff'][$staffId][$key] ?? []) !== []) {
                throw ValidationException::withMessages(['move' => "{$teacher?->full_name} already teaches on {$when}."]);
            }

            if ($teacher && $period && ! TimetableVersion::teacherWorks($teacher, $school, $weekday, $period, $world['periods'])) {
                throw ValidationException::withMessages(['move' => "{$teacher->full_name} does not work on {$when}, by the staff record."]);
            }
        }

        if ($roomId && in_array('room', $checks, true)) {
            $room = $world['rooms']->get($roomId);

            if ($others($busy['room'][$roomId][$key] ?? []) !== []) {
                throw ValidationException::withMessages(['move' => "{$room?->code} is already booked on {$when}."]);
            }

            if ($room && ! TimetableVersion::roomOpen($room, $weekday, $periodId)) {
                throw ValidationException::withMessages(['move' => "{$room->code} is closed on {$when}."]);
            }
        }
    }

    /**
     * The list on the left: every class, teacher or room, with how
     * much of it is filled and what is wrong.
     *
     * @param  Collection<int, array{type: string, kind: string, count: int, title: string, detail: string, lesson_id: string|null, slot_ids: list<string>, class_ids: list<string>, staff_id: string|null, room_id: string|null, weekday: int|null, period_id: string|null}>  $issues
     * @return array<int, array{id: string, name: string, meta: string|null, note: string|null, issues: int, clash: bool, title: string, detail: string}>
     */
    protected function picker(TimetableVersion $version, string $view, Collection $issues, School $school): array
    {
        $world = $version->world();
        $slotsAWeek = count($world['days']) * $world['periods']->count();
        $clashes = $issues->where('type', 'clash');

        if ($view === 'teacher') {
            return $world['teachers']->toBase()->map(function (User $teacher) use ($version, $world, $clashes) {
                $placed = $version->slots->where('staff_id', $teacher->id)->count();
                $mine = $clashes->where('staff_id', $teacher->id)->count();
                $over = $teacher->max_periods_week !== null && $placed > $teacher->max_periods_week;
                $subjects = $world['lessons']->where('staff_id', $teacher->id)->map(fn (ClassSubject $lesson) => $lesson->subject?->name)->filter()->unique();
                $classes = $version->slots->where('staff_id', $teacher->id)->unique('school_class_id')->count();

                return [
                    'id' => $teacher->id,
                    'name' => $teacher->full_name,
                    'meta' => $teacher->max_periods_week !== null ? "{$placed}/{$teacher->max_periods_week}" : (string) $placed,
                    'note' => $mine > 0 ? "{$mine} ".($mine === 1 ? 'clash' : 'clashes') : ($over ? 'over' : null),
                    'issues' => $mine,
                    'clash' => $mine > 0,
                    'title' => $teacher->full_name,
                    'detail' => $subjects->take(2)->join(', ')." · {$placed} ".($teacher->max_periods_week !== null ? "of {$teacher->max_periods_week} " : '')."periods · {$classes} ".($classes === 1 ? 'class' : 'classes'),
                ];
            })->values()->all();
        }

        if ($view === 'room') {
            return $world['rooms']->toBase()->map(function (Room $room) use ($version, $world, $clashes, $slotsAWeek) {
                $booked = $version->slots->where('room_id', $room->id)->count();
                $mine = $clashes->where('room_id', $room->id)->count();
                $left = $slotsAWeek - $booked - count($room->unavailable ?? []);
                $needs = $world['lessons']->map(fn (ClassSubject $lesson) => $lesson->subject)
                    ->filter(fn ($subject) => $subject && $subject->room_kind === $room->kind)
                    ->pluck('name')->unique();

                return [
                    'id' => $room->id,
                    'name' => $room->code,
                    'meta' => "{$booked}/{$slotsAWeek}",
                    'note' => $mine > 0 ? "{$mine} ".($mine === 1 ? 'clash' : 'clashes') : ($booked > 0 && $left <= 3 ? max(0, $left).' left' : null),
                    'issues' => $mine,
                    'clash' => $mine > 0,
                    'title' => $room->code,
                    'detail' => "{$room->kind->label()} · {$room->capacity} seats · {$booked} of {$slotsAWeek} slots booked".($needs->isNotEmpty() ? ' · '.$needs->join(', ') : ''),
                ];
            })->values()->all();
        }

        return $world['classes']->toBase()->map(function (SchoolClass $class) use ($version, $world, $issues) {
            $mine = $issues->filter(fn (array $issue) => in_array($class->id, $issue['class_ids'], true));
            $total = (int) $world['lessons']->where('school_class_id', $class->id)->sum('weekly_periods');
            $placed = $version->slots->where('school_class_id', $class->id)->count();

            return [
                'id' => $class->id,
                'name' => $class->name,
                'meta' => null,
                'note' => null,
                'issues' => (int) $mine->sum('count'),
                'clash' => $mine->contains('type', 'clash'),
                'title' => $class->name,
                'detail' => ($class->formMaster ? "Form master {$class->formMaster->full_name} · " : '')."{$placed} of {$total} lessons placed",
            ];
        })->values()->all();
    }

    /**
     * Times that are not open in this view: when the teacher does not
     * work or the room is closed.
     *
     * @return array<string, string>
     */
    protected function closed(TimetableVersion $version, string $view, string $id, School $school): array
    {
        $world = $version->world();
        $closed = [];

        if ($view === 'room' && ($room = $world['rooms']->get($id))) {
            foreach ($room->unavailable ?? [] as $block) {
                $closed[TimetableVersion::key((int) $block['weekday'], $block['period_id'])] = 'Closed'.($block['reason'] ? " · {$block['reason']}" : '');
            }
        }

        if ($view === 'teacher' && ($teacher = $world['teachers']->get($id))) {
            foreach ($world['days'] as $day) {
                foreach ($world['periods'] as $period) {
                    if (! TimetableVersion::teacherWorks($teacher, $school, $day, $period, $world['periods'])) {
                        $closed[TimetableVersion::key($day, $period->id)] = 'Not teaching';
                    }
                }
            }
        }

        return $closed;
    }

    /**
     * The side panel for a lesson on the grid.
     *
     * @param  Collection<int, array{type: string, kind: string, count: int, title: string, detail: string, lesson_id: string|null, slot_ids: list<string>, class_ids: list<string>, staff_id: string|null, room_id: string|null, weekday: int|null, period_id: string|null}>  $issues
     * @return array<string, mixed>
     */
    protected function slotPanel(TimetableVersion $version, TimetableSlot $slot, Collection $issues, School $school, bool $readOnly): array
    {
        $world = $version->world();
        $period = Period::whereKey($slot->period_id)->first();
        $key = TimetableVersion::key($slot->weekday, $slot->period_id);
        $busy = $version->busy();
        $lesson = $world['lessons']->first(fn (ClassSubject $candidate) => $candidate->school_class_id === $slot->school_class_id
            && $candidate->subject_id === $slot->subject_id);
        $kind = $slot->subject?->room_kind;
        $free = fn (array $ids) => array_diff($ids, [$slot->id]) === [];

        $teachers = $world['lessons']
            ->where('subject_id', $slot->subject_id)
            ->pluck('staff_id')->push($slot->staff_id)->filter()->unique()
            ->map(fn (string $id) => $world['teachers']->get($id) ?? User::whereKey($id)->first())
            ->filter()
            ->map(fn (User $teacher) => [
                'id' => $teacher->id,
                'name' => $teacher->full_name,
                'free' => $free($busy['staff'][$teacher->id][$key] ?? [])
                    && ($period === null || TimetableVersion::teacherWorks($teacher, $school, $slot->weekday, $period, $world['periods'])),
            ])->values();

        $rooms = $world['rooms']
            ->filter(fn (Room $room) => $room->id === $slot->room_id || (
                ($kind !== null ? $room->kind === $kind : $room->kind === RoomKind::Classroom)
                && $free($busy['room'][$room->id][$key] ?? [])
                && TimetableVersion::roomOpen($room, $slot->weekday, $slot->period_id)
            ))
            ->map(fn (Room $room) => ['id' => $room->id, 'code' => $room->code])
            ->values();

        return [
            'type' => 'slot',
            'id' => $slot->id,
            'title' => "{$slot->subject?->name} · {$slot->schoolClass?->name}",
            'when' => strtoupper(substr(TimetableVersion::WEEKDAYS[$slot->weekday], 0, 3))." · {$period?->label} · ".substr((string) $period?->starts_at, 0, 5).' – '.substr((string) $period?->ends_at, 0, 5),
            'problems' => $issues
                ->filter(fn (array $issue) => in_array($slot->id, $issue['slot_ids'], true))
                ->map(fn (array $issue) => [
                    'title' => match ($issue['kind']) {
                        'teacher' => 'Two lessons at once',
                        'room' => 'Two classes in one room',
                        default => 'Not a working time',
                    },
                    'text' => "{$issue['title']}. {$issue['detail']}.",
                ])->values(),
            'teacher_id' => $slot->staff_id,
            'teacher' => $slot->staff?->full_name,
            'teachers' => $teachers,
            'room_id' => $slot->room_id,
            'room' => $slot->room?->code,
            'rooms' => $rooms,
            'locked' => $slot->is_locked,
            'moves' => $readOnly || ! $lesson ? [] : $this->moves($version, $lesson, $slot),
        ];
    }

    /**
     * The side panel for a lesson that is not on the grid yet.
     *
     * @param  Collection<int, array{type: string, kind: string, count: int, title: string, detail: string, lesson_id: string|null, slot_ids: list<string>, class_ids: list<string>, staff_id: string|null, room_id: string|null, weekday: int|null, period_id: string|null}>  $issues
     * @return array<string, mixed>
     */
    protected function lessonPanel(TimetableVersion $version, ClassSubject $lesson, Collection $issues): array
    {
        $issue = $issues->firstWhere('lesson_id', $lesson->id);
        $world = $version->world();

        return [
            'type' => 'lesson',
            'id' => $lesson->id,
            'title' => "{$lesson->subject?->name} · {$world['classes']->get($lesson->school_class_id)?->name}",
            'count' => $issue['count'] ?? 0,
            'why' => $issue['detail'] ?? null,
            'teacher' => $lesson->staff_id ? $world['teachers']->get($lesson->staff_id)?->full_name : null,
            'moves' => $issue ? $this->moves($version, $lesson, null) : [],
        ];
    }

    /**
     * @return list<array{weekday: int, period_id: string, label: string}>
     */
    protected function moves(TimetableVersion $version, ClassSubject $lesson, ?TimetableSlot $slot): array
    {
        $periods = $version->world()['periods']->keyBy('id');

        return array_map(fn (array $time) => [
            'weekday' => $time['weekday'],
            'period_id' => $time['period_id'],
            'label' => substr(TimetableVersion::WEEKDAYS[$time['weekday']], 0, 3).' '.$periods->get($time['period_id'])?->label,
        ], array_slice($version->freeTimes($lesson, $slot), 0, static::MOVES_SHOWN));
    }

    protected function short(?User $teacher): string
    {
        if (! $teacher) {
            return 'No teacher';
        }

        $parts = preg_split('/\s+/', trim($teacher->full_name)) ?: [];

        return $teacher->family_name ?? (string) end($parts);
    }

    protected function audit(Request $request, School $school, TimetableSlot $slot, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'timetable_slot',
            'entity_id' => $slot->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
