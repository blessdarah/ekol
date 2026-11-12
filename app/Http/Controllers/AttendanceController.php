<?php

namespace App\Http\Controllers;

use App\Actions\Attendance\SaveLessonRegister;
use App\Enums\AttendanceStatus;
use App\Enums\EnrolmentStatus;
use App\Http\Requests\Attendance\SaveLessonRegisterRequest;
use App\Models\Attendance;
use App\Models\Enrolment;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A teacher's registers: one per lesson she teaches today, each kept
 * apart from the others, even for the same class.
 */
class AttendanceController extends Controller
{
    public function show(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $teacher = $request->user();
        $now = now($school->timezone);
        $term = $this->schoolContext->term();
        $live = $term ? TimetableVersion::liveFor($term) : null;
        $slots = $live ? TimetableSlot::lessonsOn($teacher, $school, $live, $now) : new Collection;
        $date = $now->toDateString();
        $clock = $now->format('H:i:s');
        $marked = Attendance::whereIn('timetable_slot_id', $slots->modelKeys())->whereDate('date', $date)->get()->groupBy('timetable_slot_id');
        $sizes = Enrolment::whereIn('school_class_id', $slots->pluck('school_class_id')->unique())
            ->where('status', '!=', EnrolmentStatus::Left)
            ->get(['school_class_id'])
            ->countBy('school_class_id');
        $started = fn (TimetableSlot $slot) => $slot->period !== null && $clock >= $slot->period->starts_at;

        $current = $slots->firstWhere('id', (string) $request->query('lesson', ''))
            ?? $slots->first(fn (TimetableSlot $slot) => $started($slot) && ! $marked->has($slot->id) && $clock < (string) $slot->period?->ends_at)
            ?? $slots->last(fn (TimetableSlot $slot) => $started($slot) && ! $marked->has($slot->id))
            ?? $slots->first(fn (TimetableSlot $slot) => ! $started($slot))
            ?? $slots->last();

        $roll = [];

        if ($current) {
            $mine = ($marked->get($current->id) ?? new Collection)->keyBy('student_id');
            $roll = Enrolment::where('school_class_id', $current->school_class_id)
                ->where('status', '!=', EnrolmentStatus::Left)
                ->whereHas('student')
                ->with('student:id,full_name')
                ->get()
                ->map(fn (Enrolment $enrolment) => $enrolment->student)
                ->filter()
                ->sortBy('full_name')
                ->values()
                ->map(fn ($student) => [
                    'student_id' => $student->id,
                    'name' => $student->full_name,
                    'status' => $mine->get($student->id)?->status->value,
                    'note' => $mine->get($student->id)?->note,
                ])
                ->all();
        }

        return Inertia::render('teacher/attendance', [
            'dateLabel' => $now->translatedFormat('l j M'),
            'date' => $date,
            'weekLabel' => $term ? $this->week($term, $now) : null,
            'hasTimetable' => $live !== null,
            'lessons' => $slots->map(fn (TimetableSlot $slot) => [
                'id' => $slot->id,
                'period' => (string) $slot->period?->label,
                'time' => substr((string) $slot->period?->starts_at, 0, 5).' – '.substr((string) $slot->period?->ends_at, 0, 5),
                'class' => (string) $slot->schoolClass?->name,
                'subject' => (string) $slot->subject?->name,
                'room' => $slot->room?->code,
                'students' => (int) $sizes->get($slot->school_class_id, 0),
                'present' => ($marked->get($slot->id) ?? new Collection)->whereIn('status', [AttendanceStatus::Present, AttendanceStatus::Late])->count(),
                'saved' => $marked->has($slot->id),
                'started' => $started($slot),
                'cover' => $slot->staff_id !== $teacher->id,
            ]),
            'lesson' => $current?->id,
            'roll' => $roll,
        ]);
    }

    /**
     * Save a lesson's register for today. Every student gets a mark;
     * saving again replaces the earlier marks, the same day only.
     */
    public function store(SaveLessonRegisterRequest $request, string $slot, SaveLessonRegister $register): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $lesson = Str::isUuid($slot) ? TimetableSlot::where('school_id', $school->id)->whereKey($slot)->first() : null;

        if (! $lesson) {
            throw SaveLessonRegister::notYourLesson();
        }

        $register->handle($school, $request->user(), $lesson, now($school->timezone), $request->validated('marks'));

        $this->notify('Register saved.');

        return back();
    }

    protected function week(Term $term, CarbonInterface $now): string
    {
        $week = (int) floor($term->starts_on->copy()->startOfWeek()->diffInDays($now->toDateString()) / 7) + 1;

        return 'Week '.max(1, min($week, $term->week_count))." of {$term->week_count}";
    }
}
