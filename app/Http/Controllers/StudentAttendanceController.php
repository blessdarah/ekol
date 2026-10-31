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
        $school = $this->schoolContext->school();
        $target = $this->student($school, $student);
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)->where('academic_year_id', $year->id)->with('schoolClass.level')->first()
            : null;
        $summary = Attendance::summary($target, $term);

        return Inertia::render('students/attendance', [
            'neighbours' => Student::neighbours($school, $target, $this->schoolContext->year()),
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
        $school = $this->schoolContext->school();
        $target = $this->student($school, $student);
        $record = Attendance::where('student_id', $target->id)->where('id', $attendance)->firstOrFail();

        $data = $request->validated();

        if ($record->status !== AttendanceStatus::Absent) {
            throw ValidationException::withMessages(['note' => __('Only an absence can be excused.')]);
        }

        $record->update(['status' => AttendanceStatus::Excused, 'note' => trim($data['note'])]);

        AuditEvent::record($school, $request->user(), 'attendance', $record->id, 'excused', ['date' => $record->date->toDateString(), 'note' => $record->note]);

        $this->notify('Absence excused.');

        return back();
    }

    protected function student(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }
}
