<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Http\Requests\Assessments\SaveAssessmentPlanRequest;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AssessmentController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        if ($request->user() && ! $request->user()->can('manage-assessments')) {
            return redirect()->route('assessments.sheets');
        }

        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $plans = AssessmentPlan::forYear($school, $year);
        $terms = $year ? Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() : new Collection;

        return Inertia::render('assessments/calendar', [
            'yearLabel' => $year?->label,
            'tabs' => AssessmentPlan::tabs($school, $year),
            'counts' => collect(AssessmentState::cases())->mapWithKeys(fn (AssessmentState $state) => [
                $state->value => $plans->where('state', $state)->count(),
            ]),
            'terms' => $terms->map(fn (Term $term) => [
                'id' => $term->id,
                'label' => $term->label,
                'current' => $term->is_current,
                'plans' => $plans->where('term_id', $term->id)->map(fn (AssessmentPlan $plan) => $plan->summary())->values(),
            ]),
        ]);
    }

    public function create(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();

        return $year ? $this->form($request, $school, $year, null) : redirect()->route('assessments');
    }

    public function edit(Request $request, string $plan): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();

        return $year ? $this->form($request, $school, $year, AssessmentPlan::forSchool($school->id)->whereKey($plan)->with('term')->firstOrFail()) : redirect()->route('assessments');
    }

    public function store(SaveAssessmentPlanRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $data = $this->validated($request);

        DB::transaction(function () use ($request, $school, $data) {
            $plan = AssessmentPlan::create([...$data['fields'], 'school_id' => $school->id, 'state' => AssessmentState::Draft]);
            $this->settle($plan, $data['schedule']);
            AuditEvent::record($school, $request->user(), 'assessment_plan', $plan->id, $data['schedule'] ? 'scheduled' : 'drafted', $data['fields']);
        });

        $this->notify('Assessment saved.');

        return redirect()->route('assessments');
    }

    public function update(SaveAssessmentPlanRequest $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = AssessmentPlan::forSchool($school->id)->whereKey($plan)->with('term')->firstOrFail();

        if (! in_array($target->state, [AssessmentState::Draft, AssessmentState::Scheduled], true)) {
            throw ValidationException::withMessages([
                'name' => __(':name has marks open or closed. Only its marks window can change now, under Marks progress.', ['name' => $target->name]),
            ]);
        }

        $data = $this->validated($request);

        DB::transaction(function () use ($request, $school, $target, $data) {
            $target->update($data['fields']);
            $this->settle($target, $data['schedule'] || $target->state === AssessmentState::Scheduled);
            AuditEvent::record($school, $request->user(), 'assessment_plan', $target->id, 'updated', $data['fields']);
        });

        $this->notify('Assessment saved.');

        return redirect()->route('assessments');
    }

    /**
     * Start a term with the usual three drafts: two sequences and the exam.
     */
    public function usual(Request $request, string $term): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $target = Term::where('school_id', $school->id)->where('academic_year_id', $year?->id)->where('id', $term)->firstOrFail();

        if (AssessmentPlan::where('term_id', $target->id)->exists()) {
            throw ValidationException::withMessages(['term' => __(':label already has assessments.', ['label' => $target->label])]);
        }

        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->pluck('id')->all();
        $first = ($target->sequence - 1) * 2 + 1;

        DB::transaction(function () use ($request, $school, $target, $levels, $first) {
            foreach ([["Sequence {$first}", AssessmentKind::Sequence], ['Sequence '.($first + 1), AssessmentKind::Sequence], ["{$target->label} exam", AssessmentKind::Exam]] as [$name, $kind]) {
                $plan = AssessmentPlan::create([
                    'school_id' => $school->id,
                    'term_id' => $target->id,
                    'kind' => $kind,
                    'name' => $name,
                    'state' => AssessmentState::Draft,
                    'level_ids' => $levels,
                ]);
                AuditEvent::record($school, $request->user(), 'assessment_plan', $plan->id, 'drafted', ['name' => $name]);
            }
        });

        $this->notify('The usual assessments were added as drafts.');

        return back();
    }

    protected function form(Request $request, School $school, AcademicYear $year, ?AssessmentPlan $plan): Response
    {
        $terms = Term::where('academic_year_id', $year->id)->orderBy('sequence')->get();
        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']);
        $unstaffed = ClassSubject::whereNull('staff_id')
            ->whereIn('school_class_id', SchoolClass::where('school_id', $school->id)->where('academic_year_id', $year->id)->select('id'))
            ->whereHas('subject')
            ->with(['subject:id,name', 'schoolClass:id,name,level_id'])
            ->get();

        return Inertia::render('assessments/form', [
            'yearLabel' => $year->label,
            'tabs' => AssessmentPlan::tabs($school, $year),
            'outOf' => AssessmentPlan::OUT_OF,
            'terms' => $terms->map(fn (Term $term) => [
                'id' => $term->id,
                'label' => $term->label,
                'starts_on' => $term->starts_on->toDateString(),
                'ends_on' => $term->ends_on->toDateString(),
                'current' => $term->is_current,
            ]),
            'levels' => $levels,
            'defaultTerm' => $terms->firstWhere('id', (string) $request->query('term', ''))->id
                ?? $terms->firstWhere('is_current', true)->id
                ?? $terms->first()?->id,
            'unstaffed' => $unstaffed->map(fn (ClassSubject $lesson) => [
                'level_id' => $lesson->schoolClass?->level_id,
                'text' => "{$lesson->subject?->name} has no teacher in {$lesson->schoolClass?->name}, so its marks cannot be entered.",
            ])->values(),
            'plan' => $plan ? [
                ...$plan->summary(),
                'term_id' => $plan->term_id,
                'level_ids' => $plan->level_ids,
            ] : null,
        ]);
    }

    /**
     * Once a plan is scheduled its classes get their mark sheets, and
     * marks open at once when the window has already started.
     */
    protected function settle(AssessmentPlan $plan, bool $schedule): void
    {
        if (! $schedule) {
            return;
        }

        if ($plan->state === AssessmentState::Draft) {
            $plan->moveTo(AssessmentState::Scheduled);
        }

        $plan->sync();
        $plan->refreshState();
    }

    /**
     * @return array{fields: array<string, mixed>, schedule: bool}
     */
    protected function validated(SaveAssessmentPlanRequest $request): array
    {
        $schedule = $request->scheduling();
        $data = $request->validated();

        return [
            'schedule' => $schedule,
            'fields' => [
                'name' => trim($data['name']),
                'kind' => $data['kind'],
                'term_id' => $data['term_id'],
                'held_from' => $data['held_from'] ?? null,
                'held_until' => $data['held_until'] ?? null,
                'window_starts_on' => $data['window_starts_on'] ?? null,
                'window_ends_on' => $data['window_ends_on'] ?? null,
                'level_ids' => array_values($data['level_ids']),
            ],
        ];
    }
}
