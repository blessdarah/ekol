<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\Room;
use App\Models\School;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TimetableSlotController extends Controller
{
    /**
     * Place one lesson that has no place yet.
     */
    public function store(Request $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
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
            throw ValidationException::withMessages(['move' => __('That lesson is no longer on the list.')]);
        }

        $placed = $draft->slots->where('school_class_id', $class->id)->where('subject_id', $lesson->subject_id)->count();

        if ($placed >= $lesson->weekly_periods) {
            throw ValidationException::withMessages(['move' => __('Every lesson of that subject is already placed.')]);
        }

        $weekday = (int) $data['weekday'];
        $this->guard($draft, $school, $class->id, $lesson->staff_id, null, $weekday, $data['period_id'], null, ['time']);
        $room = $draft->pickRoom($class, $lesson->subject?->room_kind, $weekday, $data['period_id']);

        if ($room === false) {
            throw ValidationException::withMessages([
                'move' => __('No :kind is free at that time.', ['kind' => $lesson->subject?->room_kind?->label()]),
            ]);
        }

        $slot = TimetableSlot::create([
            ...$draft->row($class->id, $lesson->subject_id, $lesson->staff_id, $room?->id, $weekday, $data['period_id']),
        ]);

        AuditEvent::record($school, $request->user(), 'timetable_slot', $slot->id, 'placed', ['weekday' => $weekday, 'period_id' => $data['period_id']]);

        return back();
    }

    /**
     * Move a lesson, change its teacher or room, or lock it. A change
     * that would put someone in two places at once is refused.
     */
    public function update(Request $request, string $slot): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
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

        AuditEvent::record($school, $request->user(), 'timetable_slot', $target->id, 'changed', ['before' => $before, 'after' => $data]);

        return back();
    }

    /**
     * Take a lesson off the grid; it goes back to the not-placed list.
     */
    public function destroy(Request $request, string $slot): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $draft = $this->draft($term);
        $target = $draft->slots->firstWhere('id', $slot) ?? abort(404);

        TimetableSlot::whereKey($target->id)->delete();
        AuditEvent::record($school, $request->user(), 'timetable_slot', $target->id, 'unplaced', $target->only(['weekday', 'period_id', 'subject_id']));

        return back();
    }

    protected function draft(?Term $term): TimetableVersion
    {
        $draft = $term ? TimetableVersion::draftFor($term) : null;

        return $draft ?? throw ValidationException::withMessages([
            'move' => __('There is no draft timetable to change. The live timetable changes through Changes.'),
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
                throw ValidationException::withMessages(['move' => __('The class already has a lesson on :when.', ['when' => $when])]);
            }
        }

        if ($staffId && in_array('staff', $checks, true)) {
            $teacher = User::where('school_id', $school->id)->whereKey($staffId)->first();

            if ($others($busy['staff'][$staffId][$key] ?? []) !== []) {
                throw ValidationException::withMessages(['move' => __(':full_name already teaches on :when.', ['full_name' => $teacher?->full_name, 'when' => $when])]);
            }

            if ($teacher && $period && ! TimetableVersion::teacherWorks(
                $teacher,
                $school,
                $weekday,
                $period,
                $world['periods']
            )) {
                throw ValidationException::withMessages([
                    'move' => __(
                        ':full_name does not work on :when, by the staff record.',
                        ['full_name' => $teacher->full_name, 'when' => $when]
                    ),
                ]);
            }
        }

        if ($roomId && in_array('room', $checks, true)) {
            $room = $world['rooms']->get($roomId);

            if ($others($busy['room'][$roomId][$key] ?? []) !== []) {
                throw ValidationException::withMessages(['move' => __(':code is already booked on :when.', ['code' => $room?->code, 'when' => $when])]);
            }

            if ($room && ! TimetableVersion::roomOpen($room, $weekday, $periodId)) {
                throw ValidationException::withMessages(['move' => __(':code is closed on :when.', ['code' => $room->code, 'when' => $when])]);
            }
        }
    }
}
