<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Models\AssessmentPlan;
use App\Models\Enrolment;
use App\Models\SchoolClass;
use App\Models\Term;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TermResultController extends Controller
{
    public function term(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $terms = $year ? Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() : new Collection;
        $plans = AssessmentPlan::forYear($school, $year)->filter(fn (AssessmentPlan $plan) => $plan->state !== AssessmentState::Draft)->values();
        $classes = $year
            ? SchoolClass::where('school_id', $school->id)->where('academic_year_id', $year->id)->orderBy('name')->get()
            : new Collection;
        $class = $classes->firstWhere('id', (string) $request->query('class', '')) ?? $classes->first();
        $annual = $request->query('term') === 'annual';
        $term = $annual ? null : ($terms->firstWhere('id', (string) $request->query('term', '')) ?? $terms->firstWhere('is_current', true) ?? $terms->first());
        $perTerm = [];

        foreach ($class ? $terms : [] as $option) {
            $mine = $plans->where('term_id', $option->id)->values();
            $perTerm[$option->id] = [
                'rows' => AssessmentPlan::termRows($mine, $class),
                'complete' => $mine->isNotEmpty() && $mine->every(fn (AssessmentPlan $plan) => $plan->state === AssessmentState::Published),
            ];
        }

        $columns = [];
        $rows = [];

        if ($term && $class) {
            $columns = $plans->where('term_id', $term->id)->map(fn (AssessmentPlan $plan) => [
                'id' => $plan->id,
                'label' => $plan->name,
                'published' => $plan->state === AssessmentState::Published,
            ])->values()->all();
            $rows = $perTerm[$term->id]['rows'];
        } elseif ($class) {
            $columns = $terms->map(fn (Term $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'published' => $perTerm[$option->id]['complete'],
            ])->all();

            foreach ($this->students($class) as $studentId => $student) {
                $values = [];

                foreach ($terms as $option) {
                    $values[$option->id] = $perTerm[$option->id]['complete']
                        ? ($perTerm[$option->id]['rows'][$studentId]['average'] ?? null)
                        : null;
                }

                $filled = array_filter($values, fn (?float $value) => $value !== null);
                $rows[$studentId] = [
                    ...$student,
                    'values' => $values,
                    'average' => $terms->isNotEmpty() && count($filled) === $terms->count() ? round(array_sum($filled) / count($filled), 2) : null,
                ];
            }
        }

        $ranks = AssessmentPlan::rank(array_map(
            fn (array $row) => (float) $row['average'],
            array_filter($rows, fn (array $row) => $row['average'] !== null),
        ));

        return Inertia::render('assessments/term', [
            'tabs' => AssessmentPlan::tabs($school, $year),
            'passMark' => (float) $school->pass_mark,
            'terms' => $terms->map(fn (Term $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'complete' => $perTerm[$option->id]['complete'] ?? false,
            ]),
            'term' => $term ? ['id' => $term->id, 'label' => $term->label, 'complete' => $perTerm[$term->id]['complete'] ?? false] : null,
            'annual' => $annual,
            'classes' => $classes->map(fn (SchoolClass $option) => ['id' => $option->id, 'name' => $option->name]),
            'class' => $class ? ['id' => $class->id, 'name' => $class->name] : null,
            'columns' => $columns,
            'rows' => collect($rows)
                ->map(fn (array $row, string $id) => [...$row, 'id' => $id, 'rank' => $ranks[$id] ?? null])
                ->sortBy([
                    fn (array $a, array $b) => ($a['rank'] ?? PHP_INT_MAX) <=> ($b['rank'] ?? PHP_INT_MAX),
                    fn (array $a, array $b) => $a['name'] <=> $b['name'],
                ])
                ->values(),
        ]);
    }

    /**
     * @return array<string, array{name: string, matricule: string}>
     */
    protected function students(SchoolClass $class): array
    {
        return Enrolment::where('school_class_id', $class->id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student')
            ->with('student:id,full_name,admission_no')
            ->get()
            ->mapWithKeys(fn (Enrolment $enrolment) => [$enrolment->student_id => [
                'name' => (string) $enrolment->student?->full_name,
                'matricule' => (string) $enrolment->student?->admission_no,
            ]])
            ->all();
    }
}
