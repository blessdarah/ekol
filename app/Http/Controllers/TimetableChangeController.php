<?php

namespace App\Http\Controllers;

use App\Http\Requests\Timetable\StoreTimetableChangeRequest;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Period;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use App\Models\TimetableChange;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Small changes to the live timetable that do not need a new version:
 * covering an absent teacher, swapping two lessons, changing a room.
 */
class TimetableChangeController extends Controller
{
    protected const array MODES = ['cover', 'swap', 'room'];

    public function index(Request $request): Response|RedirectResponse
    {
        [$school, $term] = TimetableController::context($request);

        if (! $term) {
            return redirect()->route('timetable');
        }

        $live = TimetableVersion::liveFor($term);
        $mode = in_array($request->query('mode'), static::MODES, true) ? (string) $request->query('mode') : 'cover';
        $date = $this->date((string) $request->query('date', ''), $term);
        $props = [
            'phase' => TimetableController::phase($school, $term),
            'live' => $live?->number,
            'mode' => $mode,
            'date' => $date->toDateString(),
            'termStarts' => $term->starts_on->toDateString(),
            'termEnds' => $term->ends_on->toDateString(),
            'recent' => $live
                ? TimetableChange::where('school_id', $school->id)
                    ->whereIn('timetable_version_id', TimetableVersion::where('term_id', $term->id)->pluck('id'))
                    ->with('author:id,full_name')
                    ->latest()
                    ->limit(8)
                    ->get()
                    ->map(fn (TimetableChange $change) => [
                        'id' => $change->id,
                        'summary' => $change->summary,
                        'on' => $change->starts_on->toDateString(),
                        'by' => $change->author?->full_name,
                    ])
                : [],
        ];

        if (! $live) {
            return Inertia::render('timetable/changes', $props);
        }

        $world = $live->world();
        $weekday = $date->dayOfWeekIso - 1;
        $periods = $world['periods']->keyBy('id');
        $describe = fn (TimetableSlot $slot) => [
            'id' => $slot->id,
            'weekday' => $slot->weekday,
            'period' => $periods->get($slot->period_id)?->label,
            'label' => substr(TimetableVersion::WEEKDAYS[$slot->weekday], 0, 3).' '.$periods->get($slot->period_id)?->label.' · '.$slot->subject?->name,
            'room_id' => $slot->room_id,
            'room' => $slot->room?->code,
        ];

        if ($mode === 'cover') {
            $teacherId = (string) $request->query('teacher', '');
            $lessons = $live->slots
                ->where('staff_id', $teacherId)
                ->where('weekday', $weekday)
                ->sortBy(fn (TimetableSlot $slot) => $periods->get($slot->period_id)?->ordinal)
                ->values();

            return Inertia::render('timetable/changes', [
                ...$props,
                'teachers' => $world['teachers']->map(fn (User $teacher) => ['id' => $teacher->id, 'name' => $teacher->full_name])->values(),
                'teacher' => $teacherId,
                'isSchoolDay' => in_array($weekday, $world['days'], true),
                'lessons' => $lessons->map(fn (TimetableSlot $slot) => [
                    'id' => $slot->id,
                    'period' => $periods->get($slot->period_id)?->label,
                    'title' => "{$slot->schoolClass?->name} · {$slot->subject?->name}",
                    'room' => $slot->room?->code,
                    'covers' => $this->covers($live, $school, $slot, $weekday),
                ]),
            ]);
        }

        $classId = (string) $request->query('class', '');

        return Inertia::render('timetable/changes', [
            ...$props,
            'classes' => $world['classes']->map(fn (SchoolClass $class) => ['id' => $class->id, 'name' => $class->name])->values(),
            'class' => $classId,
            'slots' => $live->slots
                ->where('school_class_id', $classId)
                ->sortBy(fn (TimetableSlot $slot) => $slot->weekday * 100 + (int) $periods->get($slot->period_id)?->ordinal)
                ->map($describe)
                ->values(),
            'rooms' => $world['rooms']->map(fn (Room $room) => ['id' => $room->id, 'code' => $room->code])->values(),
        ]);
    }

    public function store(StoreTimetableChangeRequest $request): RedirectResponse
    {
        [$school, $term] = TimetableController::context($request);
        $live = $term ? TimetableVersion::liveFor($term) : null;

        if (! $term || ! $live) {
            throw ValidationException::withMessages(['change' => 'Changes apply to a published timetable, and none is live yet.']);
        }

        $data = $request->validated();

        $date = Carbon::parse($data['date']);
        $week = (bool) ($data['whole_week'] ?? false);
        $from = $week ? $date->copy()->startOfWeek() : $date;
        $until = $week ? $date->copy()->endOfWeek() : $date;
        $periods = $live->world()['periods']->keyBy('id');
        $slot = fn (string $id) => $live->slots->firstWhere('id', $id)
            ?? throw ValidationException::withMessages(['change' => 'That lesson is not on the live timetable.']);
        $at = fn (TimetableSlot $lesson) => substr(TimetableVersion::WEEKDAYS[$lesson->weekday], 0, 3).' '.$periods->get($lesson->period_id)?->label;
        $span = $week ? ' for the week' : '';
        $rows = [];

        if ($data['kind'] === 'cover') {
            foreach ($data['covers'] as $cover) {
                $lesson = $slot($cover['slot_id']);
                $stand = User::whereKey($cover['staff_id'])->firstOrFail();
                $teaches = ClassSubject::where('staff_id', $stand->id)->where('subject_id', $lesson->subject_id)->exists();

                $rows[] = [
                    'timetable_slot_id' => $lesson->id,
                    'staff_id' => $stand->id,
                    'summary' => "Cover · {$lesson->schoolClass?->name}, {$periods->get($lesson->period_id)?->label}. {$stand->full_name} for {$lesson->staff?->full_name}".($teaches ? '' : ' (supervised study)'),
                ];
            }
        } elseif ($data['kind'] === 'swap') {
            $first = $slot($data['slot_id']);
            $second = $slot($data['other_slot_id']);

            if ($first->school_class_id !== $second->school_class_id) {
                throw ValidationException::withMessages(['other_slot_id' => 'Swap two lessons of the same class.']);
            }

            $rows[] = [
                'timetable_slot_id' => $first->id,
                'other_slot_id' => $second->id,
                'summary' => "Swap · {$first->schoolClass?->name}, {$at($first)} with {$at($second)} ({$first->subject?->name}, {$second->subject?->name}){$span}",
            ];
        } else {
            $lesson = $slot($data['slot_id']);
            $room = Room::whereKey($data['room_id'])->firstOrFail();

            if ($room->id === $lesson->room_id) {
                throw ValidationException::withMessages(['room_id' => 'The lesson is already in that room.']);
            }

            $rows[] = [
                'timetable_slot_id' => $lesson->id,
                'room_id' => $room->id,
                'summary' => "Room · {$lesson->schoolClass?->name} {$lesson->subject?->name}, {$at($lesson)}, moved from ".($lesson->room->code ?? 'no room')." to {$room->code}{$span}",
            ];
        }

        DB::transaction(function () use ($request, $school, $live, $data, $rows, $from, $until) {
            foreach ($rows as $row) {
                $change = TimetableChange::create([
                    ...$row,
                    'school_id' => $school->id,
                    'timetable_version_id' => $live->id,
                    'kind' => $data['kind'],
                    'starts_on' => $from->toDateString(),
                    'ends_on' => $until->toDateString(),
                    'created_by' => $request->user()?->id,
                ]);

                $this->audit($request, $school, $change);
            }
        });

        return back();
    }

    /**
     * Who could stand in for a lesson: teachers free in that period,
     * those who teach the subject first.
     *
     * @return list<array{id: string, name: string, teaches: bool}>
     */
    protected function covers(TimetableVersion $live, School $school, TimetableSlot $slot, int $weekday): array
    {
        $world = $live->world();
        $key = TimetableVersion::key($weekday, $slot->period_id);
        $period = $world['periods']->firstWhere('id', $slot->period_id);
        $busy = $live->busy();
        $subjectTeachers = $world['lessons']->where('subject_id', $slot->subject_id)->pluck('staff_id')->filter()->all();

        return array_values($world['teachers']
            ->filter(fn (User $teacher) => $teacher->id !== $slot->staff_id
                && ! isset($busy['staff'][$teacher->id][$key])
                && $period instanceof Period
                && TimetableVersion::teacherWorks($teacher, $school, $weekday, $period, $world['periods']))
            ->map(fn (User $teacher) => [
                'id' => $teacher->id,
                'name' => $teacher->full_name,
                'teaches' => in_array($teacher->id, $subjectTeachers, true),
            ])
            ->sortByDesc('teaches')
            ->values()
            ->all());
    }

    /**
     * The day being changed: the one asked for when it is inside the
     * term, else today or the term's first day.
     */
    protected function date(string $value, Term $term): CarbonInterface
    {
        $date = rescue(fn () => $value !== '' ? Carbon::parse($value) : today(), today(), false);

        return $date->between($term->starts_on, $term->ends_on) ? $date : $term->starts_on->copy();
    }

    protected function audit(Request $request, School $school, TimetableChange $change): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'timetable_change',
            'entity_id' => $change->id,
            'action' => $change->kind,
            'diff' => ['summary' => $change->summary, 'from' => $change->starts_on->toDateString(), 'until' => $change->ends_on->toDateString()],
        ]);
    }
}
