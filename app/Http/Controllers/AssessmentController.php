<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Http\Requests\Assessments\ExtendMarksWindowRequest;
use App\Http\Requests\Assessments\SaveAssessmentPlanRequest;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Enrolment;
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

/**
 * Planning assessments and following them to published results: the
 * calendar, the form, marks progress and the results of one assessment.
 */
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

        return $year ? $this->form($request, $school, $year, $this->plan($school, $plan)) : redirect()->route('assessments');
    }

    public function store(SaveAssessmentPlanRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $data = $this->validated($request);

        DB::transaction(function () use ($request, $school, $data) {
            $plan = AssessmentPlan::create([...$data['fields'], 'school_id' => $school->id, 'state' => AssessmentState::Draft]);
            $this->settle($plan, $data['schedule']);
            $this->audit($request, $school, $plan, $data['schedule'] ? 'scheduled' : 'drafted', $data['fields']);
        });

        $this->notify('Assessment saved.');

        return redirect()->route('assessments');
    }

    public function update(SaveAssessmentPlanRequest $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->plan($school, $plan);

        if (! in_array($target->state, [AssessmentState::Draft, AssessmentState::Scheduled], true)) {
            throw ValidationException::withMessages([
                'name' => __(':name has marks open or closed. Only its marks window can change now, under Marks progress.', ['name' => $target->name]),
            ]);
        }

        $data = $this->validated($request);

        DB::transaction(function () use ($request, $school, $target, $data) {
            $target->update($data['fields']);
            $this->settle($target, $data['schedule'] || $target->state === AssessmentState::Scheduled);
            $this->audit($request, $school, $target, 'updated', $data['fields']);
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
                $this->audit($request, $school, $plan, 'drafted', ['name' => $name]);
            }
        });

        $this->notify('The usual assessments were added as drafts.');

        return back();
    }

    public function progress(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $plans = AssessmentPlan::forYear($school, $year)->filter(fn (AssessmentPlan $plan) => $plan->state !== AssessmentState::Draft)->values();
        $plan = $plans->firstWhere('id', (string) $request->query('plan', ''))
            ?? $plans->firstWhere('state', AssessmentState::MarksOpen)
            ?? $plans->last(fn (AssessmentPlan $option) => in_array($option->state, [AssessmentState::MarksClosed, AssessmentState::Published], true))
            ?? $plans->first();

        if ($plan && in_array($plan->state, [AssessmentState::Scheduled, AssessmentState::MarksOpen], true)) {
            $plan->sync();
        }

        $sheets = $plan ? $plan->sheets() : new Collection;
        $unsubmitted = $sheets->whereNull('submitted_at');
        $sizes = Enrolment::whereIn('school_class_id', $sheets->map(fn (AssessmentSubject $sheet) => $sheet->assessment?->school_class_id)->filter()->unique())
            ->where('status', '!=', EnrolmentStatus::Left)
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id');
        $missing = fn (AssessmentSubject $sheet) => [
            'sheet_id' => $sheet->id,
            'subject_id' => $sheet->subject_id,
            'subject' => $sheet->subject?->name,
            'class' => $sheet->assessment?->schoolClass?->name,
            'teacher' => $sheet->examiner?->full_name,
            'initials' => $sheet->examiner?->initials,
            'entered' => (int) $sheet->getAttribute('entered_count'),
            'students' => (int) ($sizes[$sheet->assessment?->school_class_id] ?? 0),
        ];

        return Inertia::render('assessments/progress', [
            'tabs' => AssessmentPlan::tabs($school, $year),
            'plans' => $plans->map(fn (AssessmentPlan $option) => $option->summary()),
            'plan' => $plan ? $plan->summary() : null,
            'acceptsMarks' => (bool) $plan?->acceptsMarks(),
            'termEnds' => $plan?->term()->value('ends_on')?->toDateString(),
            'stats' => [
                'submitted' => $sheets->count() - $unsubmitted->count(),
                'total' => $sheets->count(),
                'teachers' => $unsubmitted->pluck('examiner_id')->filter()->unique()->count(),
                'unstaffed' => $unsubmitted->whereNull('examiner_id')->count(),
            ],
            'classes' => $sheets
                ->groupBy(fn (AssessmentSubject $sheet) => (string) $sheet->assessment?->school_class_id)
                ->map(function (Collection $mine) use ($missing) {
                    $class = $mine->first()?->assessment?->schoolClass;

                    return [
                        'id' => $class?->id,
                        'name' => (string) $class?->name,
                        'form_master' => $class?->formMaster?->full_name,
                        'submitted' => $mine->whereNotNull('submitted_at')->count(),
                        'total' => $mine->count(),
                        'missing' => $mine->whereNull('submitted_at')->map($missing)->sortBy('subject')->values(),
                    ];
                })
                ->sortBy('name')
                ->values(),
            'teachers' => $unsubmitted
                ->groupBy(fn (AssessmentSubject $sheet) => (string) $sheet->examiner_id)
                ->map(function (Collection $mine, string $examiner) use ($missing) {
                    $teacher = $mine->first()?->examiner;

                    return [
                        'id' => $examiner === '' ? null : $examiner,
                        'name' => $teacher?->full_name,
                        'initials' => $teacher?->initials,
                        'phone' => $teacher?->phone,
                        'missing' => $mine->map($missing)->sortBy([['class', 'asc'], ['subject', 'asc']])->values(),
                    ];
                })
                ->sortBy([
                    fn (array $a, array $b) => ($a['id'] === null) <=> ($b['id'] === null),
                    fn (array $a, array $b) => count($b['missing']) <=> count($a['missing']),
                    fn (array $a, array $b) => strcmp((string) $a['name'], (string) $b['name']),
                ])
                ->values(),
        ]);
    }

    /**
     * Close marks entry: teachers can no longer enter marks and the
     * results open for review. Nothing is published yet.
     */
    public function close(Request $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->plan($school, $plan)->refreshState();

        if ($target->state !== AssessmentState::MarksOpen) {
            throw ValidationException::withMessages(['close' => __('Marks are not open for :name.', ['name' => $target->name])]);
        }

        $target->moveTo(AssessmentState::MarksClosed, ['closed_at' => now()]);
        $this->audit($request, $school, $target, 'marks_closed', []);

        $this->notify('Marks entry closed.');

        return redirect()->route('assessments.results', ['plan' => $target->id]);
    }

    /**
     * Move the day the marks window closes. Extending a closed window
     * reopens marks entry, until results are published.
     */
    public function window(ExtendMarksWindowRequest $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->plan($school, $plan)->refreshState();

        if (! in_array($target->state, [AssessmentState::Scheduled, AssessmentState::MarksOpen, AssessmentState::MarksClosed], true)) {
            throw ValidationException::withMessages([
                'window_ends_on' => $target->state === AssessmentState::Published
                    ? __('Results are published, so the window cannot be reopened. Use Corrections.')
                    : __('Schedule the assessment first.'),
            ]);
        }

        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $target, $data) {
            $before = $target->window_ends_on?->toDateString();
            $target->update(['window_ends_on' => $data['window_ends_on']]);
            $target->assessments()->update(['window_ends_on' => $data['window_ends_on']]);

            if ($target->state === AssessmentState::MarksClosed) {
                $target->moveTo(AssessmentState::MarksOpen, ['closed_at' => null]);
            }

            $this->audit($request, $school, $target, 'window_moved', ['from' => $before, 'to' => $data['window_ends_on']]);
        });

        $this->notify('Marks window updated.');

        return back();
    }

    public function results(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $plans = AssessmentPlan::forYear($school, $year)
            ->filter(fn (AssessmentPlan $plan) => in_array($plan->state, [AssessmentState::MarksOpen, AssessmentState::MarksClosed, AssessmentState::Published], true))
            ->values();
        $plan = $plans->firstWhere('id', (string) $request->query('plan', ''))
            ?? $plans->firstWhere('state', AssessmentState::MarksClosed)
            ?? $plans->last();
        $classes = $plan
            ? SchoolClass::whereIn('id', $plan->assessments()->select('school_class_id'))->orderBy('name')->get()
            : new Collection;
        $classId = (string) $request->query('class', '');
        $shown = $classId === 'all' ? $classes : $classes->where('id', $classes->firstWhere('id', $classId)->id ?? $classes->first()?->id);
        $rows = [];

        foreach ($plan ? $shown : [] as $class) {
            foreach ($plan->standings($class) as $studentId => $row) {
                $rows[$studentId] = [...$row, 'id' => $studentId, 'class' => $class->name];
                unset($rows[$studentId]['subjects']);
            }
        }

        $ranks = AssessmentPlan::rank(array_map(
            fn (array $row) => (float) $row['average'],
            array_filter($rows, fn (array $row) => $row['complete']),
        ));
        $averages = collect($rows)->pluck('average')->filter(fn (?float $average) => $average !== null);
        $pass = (float) $school->pass_mark;
        $missing = (int) collect($rows)->sum(fn (array $row) => count($row['missing']));

        return Inertia::render('assessments/results', [
            'tabs' => AssessmentPlan::tabs($school, $year),
            'plans' => $plans->map(fn (AssessmentPlan $option) => $option->summary()),
            'plan' => $plan ? $plan->summary() : null,
            'classes' => $classes->map(fn (SchoolClass $class) => ['id' => $class->id, 'name' => $class->name]),
            'class' => $classId === 'all' ? 'all' : $shown->first()?->id,
            'passMark' => $pass,
            'stats' => [
                'average' => $averages->isNotEmpty() ? round((float) $averages->avg(), 2) : null,
                'highest' => $averages->max(),
                'lowest' => $averages->min(),
                'passed' => $averages->isNotEmpty() ? (int) round($averages->filter(fn (float $average) => $average >= $pass)->count() / $averages->count() * 100) : null,
            ],
            'missing' => $missing,
            'rows' => collect($rows)
                ->map(fn (array $row) => [...$row, 'rank' => $ranks[$row['id']] ?? null])
                ->sortBy([
                    fn (array $a, array $b) => ($a['rank'] ?? PHP_INT_MAX) <=> ($b['rank'] ?? PHP_INT_MAX),
                    fn (array $a, array $b) => ($b['average'] ?? -1) <=> ($a['average'] ?? -1),
                    fn (array $a, array $b) => $a['name'] <=> $b['name'],
                ])
                ->values(),
        ]);
    }

    /**
     * Publish an assessment's results for every class. Marks lock; a
     * later change goes through Corrections.
     */
    public function publish(Request $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->plan($school, $plan);

        if ($target->state !== AssessmentState::MarksClosed) {
            throw ValidationException::withMessages([
                'publish' => $target->state === AssessmentState::Published
                    ? __(':name is already published.', ['name' => $target->name])
                    : __('Close marks entry before publishing results.'),
            ]);
        }

        $target->moveTo(AssessmentState::Published, ['published_at' => now(), 'published_by' => $request->user()?->id]);
        $this->audit($request, $school, $target, 'published', []);

        $this->notify('Results published.');

        return redirect()->route('assessments.reports', ['plan' => $target->id]);
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

    protected function plan(School $school, string $id): AssessmentPlan
    {
        return AssessmentPlan::where('school_id', $school->id)->where('id', $id)->with('term')->firstOrFail();
    }

    protected function audit(Request $request, School $school, AssessmentPlan $plan, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'assessment_plan',
            'entity_id' => $plan->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
