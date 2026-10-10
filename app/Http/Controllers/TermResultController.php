<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\Enrolment;
use App\Models\GradeBand;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Results across assessments: the term and annual averages, and the
 * report cards made from published marks.
 */
class TermResultController extends Controller
{
    /**
     * Each student of a class across a term's assessments. Only
     * published assessments count. The term average is the mean of
     * the assessment averages, and exists once the student has one in
     * every published assessment.
     *
     * @param  Collection<int, AssessmentPlan>  $plans
     * @return array<string, array{name: string, matricule: string, values: array<string, float|null>, average: float|null}>
     */
    public static function termRows(Collection $plans, SchoolClass $class): array
    {
        $published = $plans->where('state', AssessmentState::Published);
        $rows = [];

        foreach ($published as $plan) {
            foreach ($plan->standings($class) as $studentId => $row) {
                $rows[$studentId] ??= ['name' => $row['name'], 'matricule' => $row['matricule'], 'values' => [], 'average' => null];
                $rows[$studentId]['values'][$plan->id] = $row['complete'] ? $row['average'] : null;
            }
        }

        foreach ($rows as $studentId => $row) {
            $values = array_filter($row['values'], fn (?float $value) => $value !== null);
            $rows[$studentId]['average'] = $values !== [] && count($values) === $published->count()
                ? round(array_sum($values) / count($values), 2)
                : null;
        }

        return $rows;
    }

    public function term(Request $request): Response
    {
        [$school, $year] = AssessmentController::context($request);
        $terms = $year ? Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() : new Collection;
        $plans = AssessmentController::plans($school, $year)->filter(fn (AssessmentPlan $plan) => $plan->state !== AssessmentState::Draft)->values();
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
                'rows' => static::termRows($mine, $class),
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
            'tabs' => AssessmentController::tabs($school, $year),
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

    public function reports(Request $request): Response
    {
        [$school, $year] = AssessmentController::context($request);
        [$scope, $plans, $options] = $this->scope($request, $school, $year);
        $classes = $this->classes($plans);
        $class = $classes->firstWhere('id', (string) $request->query('class', '')) ?? $classes->first();
        $cards = $class && $scope ? $this->cards($school, $plans, $class, $scope['label']) : [];
        $studentId = (string) $request->query('student', '');
        $preview = collect($cards)->firstWhere('id', $studentId) ?? ($cards[0] ?? null);

        return Inertia::render('assessments/reports', [
            'tabs' => AssessmentController::tabs($school, $year),
            'issuer' => ['name' => $school->name, 'code' => $school->code],
            'yearLabel' => $year?->label,
            'options' => $options,
            'scope' => $scope,
            'classes' => $classes->map(fn (SchoolClass $option) => [
                'id' => $option->id,
                'name' => $option->name,
                'pupils' => Enrolment::where('school_class_id', $option->id)->where('status', '!=', EnrolmentStatus::Left)->count(),
            ]),
            'class' => $class ? ['id' => $class->id, 'name' => $class->name] : null,
            'students' => collect($cards)->map(fn (array $card) => [
                'id' => $card['id'],
                'name' => $card['name'],
                'average' => $card['average'],
                'position' => $card['position'],
            ]),
            'preview' => $preview,
        ]);
    }

    /**
     * Every card of a class on one page, ready to print or save as PDF.
     */
    public function print(Request $request): Response|RedirectResponse
    {
        [$school, $year] = AssessmentController::context($request);
        [$scope, $plans] = $this->scope($request, $school, $year);
        $class = $this->classes($plans)->firstWhere('id', (string) $request->query('class', ''));

        if (! $scope || ! $class) {
            return redirect()->route('assessments.reports');
        }

        return Inertia::render('assessments/report-print', [
            'issuer' => ['name' => $school->name, 'code' => $school->code],
            'yearLabel' => $year?->label,
            'scope' => $scope,
            'class' => ['id' => $class->id, 'name' => $class->name],
            'cards' => $this->cards($school, $plans, $class, $scope['label']),
        ]);
    }

    /**
     * What the cards are for: one published assessment, or a whole
     * term once all of its assessments are published.
     *
     * @return array{0: array{kind: string, id: string, label: string, published_on: string|null}|null, 1: Collection<int, AssessmentPlan>, 2: list<array{kind: string, id: string, label: string}>}
     */
    protected function scope(Request $request, School $school, ?AcademicYear $year): array
    {
        $all = AssessmentController::plans($school, $year);
        $published = $all->where('state', AssessmentState::Published)->values();
        $terms = $year ? Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() : new Collection;
        $done = $terms->filter(fn (Term $term) => $all->where('term_id', $term->id)->isNotEmpty()
            && $all->where('term_id', $term->id)->every(fn (AssessmentPlan $plan) => $plan->state === AssessmentState::Published));
        $options = [
            ...$published->map(fn (AssessmentPlan $plan) => ['kind' => 'plan', 'id' => $plan->id, 'label' => $plan->name])->all(),
            ...$done->map(fn (Term $term) => ['kind' => 'term', 'id' => $term->id, 'label' => "{$term->label} report"])->values()->all(),
        ];

        $term = $done->firstWhere('id', (string) $request->query('term', ''));

        if ($term) {
            return [
                ['kind' => 'term', 'id' => $term->id, 'label' => "{$term->label} report", 'published_on' => null],
                $published->where('term_id', $term->id)->values(),
                $options,
            ];
        }

        $plan = $published->firstWhere('id', (string) $request->query('plan', '')) ?? $published->last();

        return [
            $plan ? ['kind' => 'plan', 'id' => $plan->id, 'label' => "{$plan->name} report", 'published_on' => $plan->published_at?->toDateString()] : null,
            new Collection($plan ? [$plan] : []),
            $options,
        ];
    }

    /**
     * @param  Collection<int, AssessmentPlan>  $plans
     * @return Collection<int, SchoolClass>
     */
    protected function classes(Collection $plans): Collection
    {
        $first = $plans->first();

        return $first
            ? SchoolClass::whereIn('id', $first->assessments()->select('school_class_id'))->orderBy('name')->get()
            : new Collection;
    }

    /**
     * The report card of every student in a class: each subject's
     * mark (averaged over the assessments on the card), the overall
     * average, position, grade and the standard remark for the grade.
     *
     * @param  Collection<int, AssessmentPlan>  $plans
     * @return list<array<string, mixed>>
     */
    protected function cards(School $school, Collection $plans, SchoolClass $class, string $title): array
    {
        $standings = $plans->mapWithKeys(fn (AssessmentPlan $plan) => [$plan->id => $plan->standings($class)]);
        $rows = static::termRows($plans, $class);
        $ranks = AssessmentPlan::rank(array_map(
            fn (array $row) => (float) $row['average'],
            array_filter($rows, fn (array $row) => $row['average'] !== null),
        ));
        $cards = [];

        foreach ($rows as $studentId => $row) {
            $subjects = [];

            foreach ($plans as $plan) {
                foreach ($standings[$plan->id][$studentId]['subjects'] ?? [] as $subject) {
                    $subjects[$subject['subject']] ??= ['subject' => $subject['subject'], 'coefficient' => $subject['coefficient'], 'scores' => [], 'absent' => false];
                    $subjects[$subject['subject']]['absent'] = $subjects[$subject['subject']]['absent'] || $subject['absent'];

                    if ($subject['score'] !== null) {
                        $subjects[$subject['subject']]['scores'][] = $subject['score'];
                    }
                }
            }

            $band = GradeBand::forScore($school->id, $row['average']);

            $cards[] = [
                'id' => $studentId,
                'name' => $row['name'],
                'matricule' => $row['matricule'],
                'class' => $class->name,
                'title' => $title,
                'subjects' => array_values(array_map(fn (array $subject) => [
                    'subject' => $subject['subject'],
                    'coefficient' => $subject['coefficient'],
                    'score' => $subject['scores'] !== [] ? round(array_sum($subject['scores']) / count($subject['scores']), 2) : null,
                    'absent' => $subject['absent'] && $subject['scores'] === [],
                ], $subjects)),
                'average' => $row['average'],
                'position' => $ranks[$studentId] ?? null,
                'of' => count($rows),
                'grade' => $band ? "{$band['letter']} · {$band['meaning']}" : null,
                'remark' => $band['remark'] ?? null,
            ];
        }

        usort($cards, fn (array $a, array $b) => $a['name'] <=> $b['name']);

        return $cards;
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
