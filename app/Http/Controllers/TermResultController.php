<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\Enrolment;
use App\Models\GradeBand;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use App\Models\User;
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
        $cards = $class && $scope ? $this->cards($school, $year, $plans, $class, $scope) : [];
        $studentId = (string) $request->query('student', '');
        $preview = collect($cards)->firstWhere('id', $studentId) ?? ($cards[0] ?? null);

        return Inertia::render('assessments/reports', [
            'tabs' => AssessmentController::tabs($school, $year),
            'issuer' => $this->issuer($school),
            'yearLabel' => $year?->label,
            'options' => $options,
            'scope' => $scope,
            'closesYear' => $scope !== null && $this->closesYear($scope, $year),
            'classes' => $classes->map(fn (SchoolClass $option) => [
                'id' => $option->id,
                'name' => $option->name,
                'pupils' => Enrolment::where('school_class_id', $option->id)->where('status', '!=', EnrolmentStatus::Left)->count(),
                'undecided' => $scope ? $this->undecided($school, $year, $option, $scope) : 0,
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

        // The year's last cards carry each student's decision, so a
        // class waits until every one of them has one.
        if ($this->undecided($school, $year, $class, $scope) > 0) {
            return redirect()->route('assessments.reports', [$scope['kind'] => $scope['id'], 'class' => $class->id]);
        }

        return Inertia::render('assessments/report-print', [
            'issuer' => $this->issuer($school),
            'yearLabel' => $year?->label,
            'scope' => $scope,
            'class' => ['id' => $class->id, 'name' => $class->name],
            'cards' => $this->cards($school, $year, $plans, $class, $scope),
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
     * The school as it is printed at the top of every card.
     *
     * @return array{name: string, code: string, motto: string|null, town: string|null, logo_url: string|null}
     */
    protected function issuer(School $school): array
    {
        return [
            'name' => $school->name,
            'code' => $school->code,
            'motto' => $school->motto,
            'town' => $school->town,
            'logo_url' => $school->logo_path ? "/storage/{$school->logo_path}" : null,
        ];
    }

    /**
     * Whether the cards are for the last term of the year, the ones
     * that close it with the annual results and each decision.
     *
     * @param  array{kind: string, id: string}  $scope
     */
    protected function closesYear(array $scope, ?AcademicYear $year): bool
    {
        if ($scope['kind'] !== 'term' || ! $year) {
            return false;
        }

        $last = Term::where('academic_year_id', $year->id)->orderByDesc('sequence')->first();

        return $last?->id === $scope['id'];
    }

    /**
     * How many students of a class still have no decision on cards
     * that need one. Nothing waits before the next year is planned,
     * since decisions are only made for it.
     *
     * @param  array{kind: string, id: string}  $scope
     */
    protected function undecided(School $school, ?AcademicYear $year, SchoolClass $class, array $scope): int
    {
        if (! $this->closesYear($scope, $year)
            || ! EnrolmentController::nextYear($school)
            || ! isset(EnrolmentController::successors($school)[$class->level_id])) {
            return 0;
        }

        return Enrolment::where('school_class_id', $class->id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student')
            ->whereNull('decision')
            ->count();
    }

    /**
     * The report card of every student in a class: each subject's mark
     * in every assessment on the card and their mean, weighted by the
     * coefficient, with the student's place in the subject; the overall
     * average, position and the class's spread; how the student did
     * across the term (or the year, on its last cards); and, on the
     * last cards, the class council's decision.
     *
     * @param  Collection<int, AssessmentPlan>  $plans
     * @param  array{kind: string, id: string, label: string}  $scope
     * @return list<array<string, mixed>>
     */
    protected function cards(School $school, ?AcademicYear $year, Collection $plans, SchoolClass $class, array $scope): array
    {
        $standings = $plans->mapWithKeys(fn (AssessmentPlan $plan) => [$plan->id => $plan->standings($class)]);
        $rows = static::termRows($plans, $class);
        $ranks = static::ranks($rows);
        $planRanks = $plans->mapWithKeys(fn (AssessmentPlan $plan) => [$plan->id => AssessmentPlan::rank(array_map(
            fn (array $row) => (float) $row['average'],
            array_filter($standings[$plan->id], fn (array $row) => $row['complete']),
        ))]);
        $averages = array_values(array_filter(array_column($rows, 'average'), fn (?float $value) => $value !== null));
        $spread = $averages === [] ? null : [
            'average' => round(array_sum($averages) / count($averages), 2),
            'highest' => max($averages),
            'lowest' => min($averages),
        ];

        $marks = [];

        foreach ($rows as $studentId => $row) {
            foreach ($plans as $plan) {
                foreach ($standings[$plan->id][$studentId]['subjects'] ?? [] as $subject) {
                    $marks[$studentId][$subject['subject']] ??= ['coefficient' => $subject['coefficient'], 'scores' => [], 'absent' => false];
                    $marks[$studentId][$subject['subject']]['scores'][$plan->id] = $subject['score'];
                    $marks[$studentId][$subject['subject']]['absent'] = $marks[$studentId][$subject['subject']]['absent'] || $subject['absent'];
                }
            }
        }

        $means = [];

        foreach ($marks as $studentId => $subjects) {
            foreach ($subjects as $name => $subject) {
                $scores = array_filter($subject['scores'], fn (?float $score) => $score !== null);
                $means[$studentId][$name] = $scores !== [] ? round(array_sum($scores) / count($scores), 2) : null;
            }
        }

        $subjectRanks = [];

        foreach (collect($means)->flatMap(fn (array $subjects) => array_keys($subjects))->unique() as $name) {
            $subjectRanks[$name] = AssessmentPlan::rank(array_filter(
                array_map(fn (array $subjects) => $subjects[$name] ?? null, $means),
                fn (?float $score) => $score !== null,
            ));
        }

        $theYear = $this->closesYear($scope, $year) ? $this->year($school, $year, $class) : null;
        $outcomes = $theYear ? $this->outcomes($school, $class) : [];
        $classMaster = $class->formMaster?->full_name;
        $principal = User::where('school_id', $school->id)->where('role', UserRole::Principal)->orderBy('full_name')->value('full_name');
        $columns = $plans->map(fn (AssessmentPlan $plan) => ['id' => $plan->id, 'label' => $plan->name])->values()->all();
        $cards = [];

        foreach ($rows as $studentId => $row) {
            $subjects = [];

            foreach ($marks[$studentId] ?? [] as $name => $subject) {
                $mean = $means[$studentId][$name];
                $band = GradeBand::forScore($school->id, $mean);
                $subjects[] = [
                    'subject' => $name,
                    'coefficient' => $subject['coefficient'],
                    'scores' => array_map(fn (array $column) => $subject['scores'][$column['id']] ?? null, $columns),
                    'score' => $mean,
                    'points' => $mean !== null ? round($mean * $subject['coefficient'], 2) : null,
                    'rank' => $subjectRanks[$name][$studentId] ?? null,
                    'remark' => $band['meaning'] ?? null,
                    'absent' => $subject['absent'] && $mean === null,
                ];
            }

            $counted = array_filter($subjects, fn (array $subject) => $subject['points'] !== null);
            $band = GradeBand::forScore($school->id, $row['average']);

            $cards[] = [
                'id' => $studentId,
                'name' => $row['name'],
                'matricule' => $row['matricule'],
                'class' => $class->name,
                'title' => $scope['label'],
                'serial' => 'RC-'.strtoupper(hash('crc32b', $scope['id'].$studentId)),
                'columns' => $columns,
                'subjects' => $subjects,
                'total_coefficient' => array_sum(array_column($counted, 'coefficient')),
                'total_points' => round(array_sum(array_column($counted, 'points')), 2),
                'average' => $row['average'],
                'position' => $ranks[$studentId] ?? null,
                'of' => count($rows),
                'spread' => $spread,
                'grade' => $band ? "{$band['letter']} · {$band['meaning']}" : null,
                'remark' => $band['remark'] ?? null,
                'glance' => $theYear
                    ? [
                        'kind' => 'year',
                        'rows' => array_map(fn (array $term) => [
                            'label' => $term['label'],
                            'average' => $term['rows'][$studentId]['average'] ?? null,
                            'rank' => $term['ranks'][$studentId] ?? null,
                        ], $theYear['terms']),
                        'total' => ['label' => 'Annual', 'average' => $theYear['annual'][$studentId] ?? null, 'rank' => $theYear['ranks'][$studentId] ?? null],
                    ]
                    : ($scope['kind'] === 'term' ? [
                        'kind' => 'term',
                        'rows' => $plans->map(fn (AssessmentPlan $plan) => [
                            'label' => $plan->name,
                            'average' => ($standings[$plan->id][$studentId]['complete'] ?? false) ? $standings[$plan->id][$studentId]['average'] : null,
                            'rank' => $planRanks[$plan->id][$studentId] ?? null,
                        ])->values()->all(),
                        'total' => ['label' => $scope['label'], 'average' => $row['average'], 'rank' => $ranks[$studentId] ?? null],
                    ] : null),
                'outcome' => $theYear ? ($outcomes[$studentId] ?? null) : null,
                'class_master' => $classMaster,
                'principal' => $principal,
            ];
        }

        usort($cards, fn (array $a, array $b) => $a['name'] <=> $b['name']);

        return $cards;
    }

    /**
     * @param  array<string, array{average: float|null}>  $rows
     * @return array<string, int>
     */
    protected static function ranks(array $rows): array
    {
        return AssessmentPlan::rank(array_map(
            fn (array $row) => (float) $row['average'],
            array_filter($rows, fn (array $row) => $row['average'] !== null),
        ));
    }

    /**
     * Every term of the year for a class, and the annual average: the
     * mean of the term averages once each term has one.
     *
     * @return array{terms: list<array{label: string, rows: array<string, array{average: float|null}>, ranks: array<string, int>}>, annual: array<string, float>, ranks: array<string, int>}|null
     */
    protected function year(School $school, ?AcademicYear $year, SchoolClass $class): ?array
    {
        if (! $year) {
            return null;
        }

        $all = AssessmentController::plans($school, $year);
        $terms = [];

        foreach (Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() as $term) {
            $rows = static::termRows($all->where('term_id', $term->id)->values(), $class);
            $terms[] = ['label' => $term->label, 'rows' => $rows, 'ranks' => static::ranks($rows)];
        }

        $annual = [];

        foreach (array_keys($terms[count($terms) - 1]['rows'] ?? []) as $studentId) {
            $values = array_map(fn (array $term) => $term['rows'][$studentId]['average'] ?? null, $terms);

            if (! in_array(null, $values, true)) {
                $annual[$studentId] = round(array_sum($values) / count($values), 2);
            }
        }

        return [
            'terms' => $terms,
            'annual' => $annual,
            'ranks' => AssessmentPlan::rank($annual),
        ];
    }

    /**
     * What each student of a class does next, as the last card says:
     * the decision made for next year, or that a final class is done.
     *
     * @return array<string, array{kind: string, level: string|null}>
     */
    protected function outcomes(School $school, SchoolClass $class): array
    {
        $levels = Level::where('school_id', $school->id)->pluck('name', 'id');
        $successor = EnrolmentController::successors($school)[$class->level_id] ?? null;
        $enrolments = Enrolment::where('school_class_id', $class->id)->get(['student_id', 'decision']);

        if (! $successor) {
            return $enrolments->mapWithKeys(fn (Enrolment $enrolment) => [$enrolment->student_id => ['kind' => 'completed', 'level' => $levels[$class->level_id] ?? null]])->all();
        }

        if (! EnrolmentController::nextYear($school)) {
            return [];
        }

        return $enrolments->mapWithKeys(fn (Enrolment $enrolment) => [$enrolment->student_id => match ($enrolment->decision) {
            EnrolmentDecision::Promote => ['kind' => 'promoted', 'level' => $levels[$successor] ?? null],
            EnrolmentDecision::Repeat => ['kind' => 'repeats', 'level' => $levels[$class->level_id] ?? null],
            EnrolmentDecision::Leaving => ['kind' => 'leaving', 'level' => null],
            default => ['kind' => 'undecided', 'level' => null],
        }])->all();
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
