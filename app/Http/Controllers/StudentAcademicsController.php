<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Models\AssessmentPlan;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\GradeBand;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Term;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Academics tab of a student record: the term's marks subject by
 * subject, the average and the position in class.
 */
class StudentAcademicsController extends Controller
{
    /**
     * Assessment states from which marks exist to be read.
     */
    protected const array WITH_MARKS = [AssessmentState::MarksOpen, AssessmentState::MarksClosed, AssessmentState::Published];

    public function show(Request $request, string $student): Response
    {
        $school = $this->schoolContext->school();
        $target = Student::where('school_id', $school->id)->where('id', $student)->firstOrFail();
        $year = $this->schoolContext->year();
        $terms = $year ? Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() : new Collection;
        $term = $terms->firstWhere('id', (string) $request->query('term', '')) ?? $terms->firstWhere('is_current', true) ?? $terms->first();
        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)->where('academic_year_id', $year->id)->with('schoolClass.level', 'schoolClass.formMaster:id,full_name')->first()
            : null;
        $class = $enrolment?->schoolClass;
        $plans = $term && $class
            ? AssessmentPlan::forYear($school, $year)
                ->filter(fn (AssessmentPlan $plan) => $plan->term_id === $term->id && $plan->state !== AssessmentState::Draft)
                ->values()
            : new Collection;

        $registration = $term
            ? StudentSeries::where('student_id', $target->id)->where('term_id', $term->id)->with(['series.subjects:id', 'electives:id'])->first()
            : null;
        $core = $registration?->series?->subjects->where('pivot.kind', 'core')->modelKeys() ?? [];
        $electives = $registration ? $registration->electives->modelKeys() : [];
        $teachers = $class
            ? ClassSubject::where('school_class_id', $class->id)->with(['subject:id,name', 'staff'])->get()->keyBy(fn (ClassSubject $row) => (string) $row->subject?->name)
            : collect();

        $columns = [];
        $subjects = [];
        $focus = null;

        foreach ($plans as $plan) {
            $readable = in_array($plan->state, static::WITH_MARKS, true);
            $standings = $readable && $class ? $plan->standings($class) : [];
            $mine = $standings[$target->id] ?? null;
            $ranks = AssessmentPlan::rank(array_map(
                fn (array $row) => (float) $row['average'],
                array_filter($standings, fn (array $row) => $row['complete']),
            ));

            $columns[] = [
                'id' => $plan->id,
                'name' => $plan->name,
                'state' => $plan->state->value,
                'window_ends_on' => $plan->window_ends_on?->toDateString(),
                'average' => $mine['average'] ?? null,
                'complete' => $mine['complete'] ?? false,
                'position' => $ranks[$target->id] ?? null,
                'of' => count($standings),
            ];

            foreach ($mine['subjects'] ?? [] as $subject) {
                $subjects[$subject['subject']] ??= ['subject' => $subject['subject'], 'coefficient' => $subject['coefficient'], 'marks' => []];
                $subjects[$subject['subject']]['marks'][$plan->id] = $subject['absent'] ? 'ABS' : $subject['score'];
            }

            if ($mine && $mine['average'] !== null) {
                $focus = count($columns) - 1;
            }
        }

        $shown = $focus !== null ? $columns[$focus] : null;
        $band = GradeBand::forScore($school->id, $shown['average'] ?? null);
        $termRows = $class ? AssessmentPlan::termRows($plans, $class) : [];
        $allPublished = $plans->isNotEmpty() && $plans->every(fn (AssessmentPlan $plan) => $plan->state === AssessmentState::Published);

        return Inertia::render('students/academics', [
            'neighbours' => Student::neighbours($school, $target, $this->schoolContext->year()),
            'canOpenReports' => (bool) $request->user()?->can('manage-assessments'),
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'matricule' => $target->admission_no,
                'class' => $class?->name,
                'class_id' => $class?->id,
                'level' => $class?->level?->name,
                'admitted_year' => $target->admitted_on->format('Y'),
                'series' => $registration?->series?->code,
            ],
            'terms' => $terms->map(fn (Term $option) => ['id' => $option->id, 'label' => $option->label]),
            'term' => $term ? ['id' => $term->id, 'label' => $term->label] : null,
            'columns' => $columns,
            'focus' => $shown,
            'subjects' => collect($subjects)->sortKeys()->values()->map(function (array $subject) use ($teachers, $core, $electives) {
                $row = $teachers->get($subject['subject']);

                return [
                    ...$subject,
                    'kind' => match (true) {
                        $row && in_array($row->subject_id, $core, true) => 'core',
                        $row && in_array($row->subject_id, $electives, true) => 'elective',
                        default => null,
                    },
                    'teacher' => $row?->staff?->formalName(),
                ];
            }),
            'coefficients' => (float) collect($subjects)->sum('coefficient'),
            'remark' => $band ? [
                'grade' => "{$band['letter']} · {$band['meaning']}",
                'text' => $band['remark'],
                'form_master' => $class?->formMaster?->full_name,
            ] : null,
            'termAverage' => $allPublished ? ($termRows[$target->id]['average'] ?? null) : null,
            'termComplete' => $allPublished,
        ]);
    }
}
