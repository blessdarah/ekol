<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Http\SchoolContext;
use App\Http\TermReportCards;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TermReportController extends Controller
{
    public function __construct(SchoolContext $schoolContext, protected TermReportCards $page)
    {
        parent::__construct($schoolContext);
    }

    public function reports(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        [$scope, $plans, $options] = $this->scope($request, $school, $year);
        $classes = $this->classes($plans);
        $class = $classes->firstWhere('id', (string) $request->query('class', '')) ?? $classes->first();
        $cards = $class && $scope ? $this->page->cards($school, $year, $plans, $class, $scope, $this->schoolContext->nextYear()) : [];
        $studentId = (string) $request->query('student', '');
        $preview = collect($cards)->firstWhere('id', $studentId) ?? ($cards[0] ?? null);

        return Inertia::render('assessments/reports', [
            'tabs' => AssessmentPlan::tabs($school, $year),
            'issuer' => $this->issuer($school),
            'yearLabel' => $year?->label,
            'options' => $options,
            'scope' => $scope,
            'closesYear' => $scope !== null && $this->page->closesYear($scope, $year),
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
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
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
            'cards' => $this->page->cards($school, $year, $plans, $class, $scope, $this->schoolContext->nextYear()),
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
        $all = AssessmentPlan::forYear($school, $year);
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
     * How many students of a class still have no decision on cards
     * that need one. Nothing waits before the next year is planned,
     * since decisions are only made for it.
     *
     * @param  array{kind: string, id: string}  $scope
     */
    protected function undecided(School $school, ?AcademicYear $year, SchoolClass $class, array $scope): int
    {
        if (! $this->page->closesYear($scope, $year)
            || ! $this->schoolContext->nextYear()
            || ! isset($school->successorLevels()[$class->level_id])) {
            return 0;
        }

        return Enrolment::where('school_class_id', $class->id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student')
            ->whereNull('decision')
            ->count();
    }
}
