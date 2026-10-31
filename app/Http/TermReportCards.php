<?php

namespace App\Http;

use App\Enums\EnrolmentDecision;
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

class TermReportCards
{
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
    public function cards(School $school, ?AcademicYear $year, Collection $plans, SchoolClass $class, array $scope, ?AcademicYear $nextYear): array
    {
        $standings = $plans->mapWithKeys(fn (AssessmentPlan $plan) => [$plan->id => $plan->standings($class)]);
        $rows = AssessmentPlan::termRows($plans, $class);
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
        $outcomes = $theYear ? $this->outcomes($school, $class, $nextYear) : [];
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

        $all = AssessmentPlan::forYear($school, $year);
        $terms = [];

        foreach (Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() as $term) {
            $rows = AssessmentPlan::termRows($all->where('term_id', $term->id)->values(), $class);
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
    protected function outcomes(School $school, SchoolClass $class, ?AcademicYear $nextYear): array
    {
        $levels = Level::where('school_id', $school->id)->pluck('name', 'id');
        $successor = $school->successorLevels()[$class->level_id] ?? null;
        $enrolments = Enrolment::where('school_class_id', $class->id)->get(['student_id', 'decision']);

        if (! $successor) {
            return $enrolments->mapWithKeys(fn (Enrolment $enrolment) => [$enrolment->student_id => ['kind' => 'completed', 'level' => $levels[$class->level_id] ?? null]])->all();
        }

        if (! $nextYear) {
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
     * Whether the cards are for the last term of the year, the ones
     * that close it with the annual results and each decision.
     *
     * @param  array{kind: string, id: string}  $scope
     */
    public function closesYear(array $scope, ?AcademicYear $year): bool
    {
        if ($scope['kind'] !== 'term' || ! $year) {
            return false;
        }

        $last = Term::where('academic_year_id', $year->id)->orderByDesc('sequence')->first();

        return $last?->id === $scope['id'];
    }
}
