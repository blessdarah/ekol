<?php

namespace App\Http\Controllers;

use App\Http\StudentFeeSummary;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\Student;
use App\Models\StudentGuardian;
use App\Models\StudentSeries;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class StudentController extends Controller
{
    public function show(Request $request, string $student): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $target = $this->student($school, $student)->load(['guardians', 'invoices.payments', 'invoices.exemption']);
        $private = (bool) $request->user()?->can('see-private-student-details');

        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)
                ->where('academic_year_id', $year->id)
                ->with('schoolClass.level')
                ->first()
            : null;
        $class = $enrolment?->schoolClass;
        $series = $term
            ? StudentSeries::where('student_id', $target->id)->where('term_id', $term->id)->with('series.subjects:id')->first()?->series
            : null;
        $fees = StudentFeeSummary::summarize($target->invoices);

        return Inertia::render('students/record', [
            'neighbours' => Student::neighbours($school, $target, $this->schoolContext->year()),
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'canSeePrivate' => $private,
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'surname' => $target->surname ?? Str::before($target->full_name, ' '),
                'given_names' => $target->given_names ?? Str::after($target->full_name, ' '),
                'matricule' => $target->admission_no,
                'gender' => $target->gender->value,
                'date_of_birth' => $target->date_of_birth->toDateString(),
                'place_of_birth' => $target->place_of_birth,
                'religion' => $private ? $target->religion : null,
                'disability' => $private && $target->has_disability
                    ? trim(implode(', ', $target->disability_types ?? []).($target->disability_support ? " · {$target->disability_support}" : ''), ' ·')
                    : null,
                'admitted_on' => $target->admitted_on->toDateString(),
                'transferred_from' => $target->transferred
                    ? trim("{$target->previous_school}".($target->previous_class ? ", {$target->previous_class}" : ''))
                    : null,
                'class' => $class ? [
                    'name' => $class->name,
                    'students' => Enrolment::where('school_class_id', $class->id)->count(),
                    'level' => $class->level?->name,
                    'uses_series' => (bool) $class->level?->uses_series,
                ] : null,
                'series' => $series ? [
                    'code' => $series->code,
                    'name' => $series->name,
                    'stream' => $series->stream ?? 'science',
                    'core' => $series->subjects->where('pivot.kind', 'core')->count(),
                    'electives' => $series->subjects->where('pivot.kind', 'elective')->count(),
                ] : null,
                'guardians' => $target->guardians
                    ->sortBy(fn (StudentGuardian $guardian) => array_search($guardian->relation, StudentGuardian::RELATIONS, true))
                    ->values()
                    ->map(fn (StudentGuardian $guardian) => $guardian->only(['relation', 'name', 'phone', 'occupation', 'is_main'])),
                'on_whatsapp' => $target->on_whatsapp,
                'lives_with' => $target->lives_with,
                'fees' => $target->invoices->isEmpty() ? null : [
                    'status' => $fees['status'],
                    'balance' => $fees['balance'],
                    'due' => $fees['due'],
                ],
            ],
        ]);
    }

    protected function student(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }
}
