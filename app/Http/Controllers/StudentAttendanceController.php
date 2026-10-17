<?php

namespace App\Http\Controllers;

use App\Enums\AttendanceStatus;
use App\Http\Requests\Students\ExcuseAbsenceRequest;
use App\Models\Attendance;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Attendance tab of a student record: the term day by day, read
 * from the lesson registers teachers save, and the absences the
 * office excuses.
 */
class StudentAttendanceController extends Controller
{
    /**
     * Unexcused lesson absences in a term at which the school looks closer.
     */
    protected const int ALERT_AT = 3;

    public function show(Request $request, string $student): Response
    {
        $school = StudentController::schoolFor($request);
        $target = $this->student($school, $student);
        $year = StructureController::currentYear($school);
        $term = StudentController::currentTerm($school);
        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)->where('academic_year_id', $year->id)->with('schoolClass.level')->first()
            : null;
        $summary = static::summary($target, $term);

        return Inertia::render('students/attendance', [
            'neighbours' => StudentController::neighbours($school, $target),
            'canExcuse' => true,
            'termLabel' => $term?->label,
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'matricule' => $target->admission_no,
                'class' => $enrolment?->schoolClass?->name,
                'level' => $enrolment?->schoolClass?->level?->name,
                'admitted_year' => $target->admitted_on->format('Y'),
            ],
            'stats' => $summary['stats'],
            'term' => $term ? ['starts_on' => $term->starts_on->toDateString(), 'ends_on' => $term->ends_on->toDateString()] : null,
            'schoolDays' => $school->school_days,
            'days' => $summary['days'] === [] ? new \stdClass : $summary['days'],
            'events' => $summary['events'],
            'unexcused' => $summary['unexcused'],
            'alertAt' => static::ALERT_AT,
        ]);
    }

    /**
     * Excuse an absence, with the reason the family gave.
     */
    public function excuse(ExcuseAbsenceRequest $request, string $student, string $attendance): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $target = $this->student($school, $student);
        $record = Attendance::where('student_id', $target->id)->where('id', $attendance)->firstOrFail();

        $data = $request->validated();

        if ($record->status !== AttendanceStatus::Absent) {
            throw ValidationException::withMessages(['note' => __('Only an absence can be excused.')]);
        }

        $record->update(['status' => AttendanceStatus::Excused, 'note' => trim($data['note'])]);

        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'attendance',
            'entity_id' => $record->id,
            'action' => 'excused',
            'diff' => ['date' => $record->date->toDateString(), 'note' => $record->note],
        ]);

        $this->notify('Absence excused.');

        return back();
    }

    /**
     * A student's term, day by day: each school day with a register is
     * present, late (late or away for some lessons), absent or excused.
     *
     * @return array{days: array<string, string>, stats: array{present: int, late: int, absent: int, days: int, rate: int|null}, events: array<int, array{id: string, on: string, status: string, lesson: string, note: string|null, by: string|null}>, unexcused: int}
     */
    public static function summary(Student $student, ?Term $term): array
    {
        $records = $term
            ? Attendance::where('student_id', $student->id)
                ->whereDate('date', '>=', $term->starts_on)
                ->whereDate('date', '<=', $term->ends_on)
                ->with(['timetableSlot.subject:id,name', 'timetableSlot.period:id,label,starts_at', 'marker:id,full_name'])
                ->get()
            : collect();

        $days = $records
            ->groupBy(fn (Attendance $record) => $record->date->toDateString())
            ->map(function ($day) {
                $away = $day->whereIn('status', [AttendanceStatus::Absent, AttendanceStatus::Excused])->count();

                return match (true) {
                    $away === $day->count() => $day->contains('status', AttendanceStatus::Absent) ? 'absent' : 'excused',
                    $away > 0 || $day->contains('status', AttendanceStatus::Late) => 'late',
                    default => 'present',
                };
            });
        $counted = $days->count();

        return [
            'days' => $days->all(),
            'stats' => [
                'present' => $days->filter(fn (string $state) => $state === 'present')->count(),
                'late' => $days->filter(fn (string $state) => $state === 'late')->count(),
                'absent' => $days->filter(fn (string $state) => in_array($state, ['absent', 'excused'], true))->count(),
                'days' => $counted,
                'rate' => $counted > 0 ? (int) round($days->filter(fn (string $state) => in_array($state, ['present', 'late'], true))->count() / $counted * 100) : null,
            ],
            'events' => $records
                ->where('status', '!=', AttendanceStatus::Present)
                ->sortByDesc(fn (Attendance $record) => $record->date->toDateString().$record->timetableSlot?->period?->starts_at)
                ->values()
                ->map(fn (Attendance $record) => [
                    'id' => $record->id,
                    'on' => $record->date->toDateString(),
                    'status' => $record->status->value,
                    'lesson' => collect([$record->timetableSlot?->period?->label, $record->timetableSlot?->subject?->name])->filter()->join(' · '),
                    'note' => $record->note,
                    'by' => $record->marker?->full_name,
                ])
                ->all(),
            'unexcused' => $records->where('status', AttendanceStatus::Absent)->count(),
        ];
    }

    protected function student(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }
}
