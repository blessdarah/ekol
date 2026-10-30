<?php

namespace App\Http\Controllers;

use App\Enums\TimetableStatus;
use App\Http\Requests\Timetable\GenerateTimetableRequest;
use App\Http\Requests\Timetable\PublishTimetableRequest;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Period;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
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
    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();

        if (! $term) {
            return Inertia::render('timetable/overview', ['phase' => null]);
        }

        $world = TimetableVersion::worldFor($school, $term);
        $inputs = TimetableVersion::inputs($school, $term);
        $live = TimetableVersion::liveFor($term);
        $rooms = $world['rooms']->count();
        $days = count($world['days']);

        return Inertia::render('timetable/overview', [
            'phase' => TimetableVersion::phase($school, $term),
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
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();

        if (! $term) {
            return redirect()->route('timetable');
        }

        $world = TimetableVersion::worldFor($school, $term);
        $homes = $world['classes']->filter(fn (SchoolClass $class) => $class->home_room_id !== null)->keyBy('home_room_id');
        $needs = $world['lessons']->map(fn (ClassSubject $lesson) => $lesson->subject)->filter()->unique('id');

        return Inertia::render('timetable/setup', [
            'phase' => TimetableVersion::phase($school, $term),
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
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();

        if (! $term) {
            return redirect()->route('timetable');
        }

        return Inertia::render('timetable/checks', [
            'phase' => TimetableVersion::phase($school, $term),
            'inputs' => TimetableVersion::inputs($school, $term),
        ]);
    }

    public function generator(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();

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
            'phase' => TimetableVersion::phase($school, $term),
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
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $term ??= throw ValidationException::withMessages(['generate' => __('No term is active. Make one active in School Setup first.')]);

        $data = $request->validated();

        if (TimetableVersion::inputs($school, $term)['blocking'] !== []) {
            throw ValidationException::withMessages([
                'generate' => __('The generator cannot run yet. Fix what Check inputs lists first.'),
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
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
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
            'phase' => TimetableVersion::phase($school, $term),
            'checks' => [
                'placed' => $total - $unplaced,
                'total' => $total,
                'clashes' => $issues->where('type', 'clash')->count(),
            ],
            'warnings' => collect(TimetableVersion::inputs($school, $term)['warnings'])
                ->filter(fn (array $warning) => $warning['action'] !== null && str_contains($warning['action']['href'], '/staff/'))
                ->values(),
            'diff' => $live ? $this->diff($live, $draft) : null,
            'defaultDate' => max(today(), $term->starts_on)->toDateString(),
            'termEnds' => $term->ends_on->toDateString(),
        ]);
    }

    public function publish(PublishTimetableRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $draft = $term ? TimetableVersion::draftFor($term) : null;

        if (! $term || ! $draft) {
            throw ValidationException::withMessages(['publish' => __('There is no draft timetable to publish.')]);
        }

        $data = $request->validated();

        if ($draft->slots->isEmpty() || $draft->toFix() > 0) {
            throw ValidationException::withMessages([
                'publish' => __('This version still has lessons to place or clashes to clear. Finish the review first.'),
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
