<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\MarkCorrection;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Planning assessments and following them to published results: the
 * calendar, the form, marks progress and the results of one assessment.
 */
class AssessmentController extends Controller
{
    /**
     * The school and its current year, for a role that runs assessments.
     *
     * @return array{0: School, 1: AcademicYear|null}
     */
    public static function context(Request $request): array
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        abort_unless((bool) $request->user()?->role->managesAssessments(), 403);

        return [$school, StructureController::currentYear($school)];
    }

    /**
     * The year's plans, oldest first, each moved to marks-open when its
     * window has started.
     *
     * @return Collection<int, AssessmentPlan>
     */
    public static function plans(School $school, ?AcademicYear $year): Collection
    {
        if (! $year) {
            return new Collection;
        }

        return AssessmentPlan::where('school_id', $school->id)
            ->whereIn('term_id', Term::where('academic_year_id', $year->id)->select('id'))
            ->with('term:id,label,sequence,is_current')
            ->get()
            ->each(fn (AssessmentPlan $plan) => $plan->refreshState())
            ->sortBy(fn (AssessmentPlan $plan) => [
                $plan->term?->sequence,
                $plan->held_from?->toDateString() ?? '9999',
                $plan->kind === AssessmentKind::Exam ? 1 : 0,
                $plan->name,
            ])
            ->values();
    }

    /**
     * The badges on the tab bar every assessment screen shares.
     *
     * @return array{missing: int, clashes: int, pending: int}
     */
    public static function tabs(School $school, ?AcademicYear $year): array
    {
        $plans = static::plans($school, $year);
        $open = $plans->where('state', AssessmentState::MarksOpen);

        return [
            'missing' => $open->isEmpty() ? 0 : AssessmentSubject::whereNull('submitted_at')
                ->whereHas('assessment', fn ($query) => $query->whereIn('assessment_plan_id', $open->modelKeys()))
                ->count(),
            'clashes' => (int) $plans
                ->filter(fn (AssessmentPlan $plan) => $plan->kind === AssessmentKind::Exam && $plan->schedule_published_at === null)
                ->sum(fn (AssessmentPlan $plan) => count(ExamScheduleController::clashes($plan))),
            'pending' => MarkCorrection::where('school_id', $school->id)->where('status', 'pending')->count(),
        ];
    }

    /**
     * A plan as the lists and pickers show it.
     *
     * @return array<string, mixed>
     */
    public static function summary(AssessmentPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'kind' => $plan->kind->value,
            'state' => $plan->state->value,
            'term' => $plan->term?->label,
            'held_from' => $plan->held_from?->toDateString(),
            'held_until' => $plan->held_until?->toDateString(),
            'window_starts_on' => $plan->window_starts_on?->toDateString(),
            'window_ends_on' => $plan->window_ends_on?->toDateString(),
            'days_left' => $plan->state === AssessmentState::MarksOpen && $plan->window_ends_on
                ? (int) today()->diffInDays($plan->window_ends_on, false)
                : null,
            'has_schedule' => $plan->schedule_published_at !== null,
            'closed_on' => $plan->closed_at?->toDateString(),
            'published_on' => $plan->published_at?->toDateString(),
        ];
    }

    public function index(Request $request): Response|RedirectResponse
    {
        if ($request->user() && ! $request->user()->role->managesAssessments()) {
            return redirect()->route('assessments.sheets');
        }

        [$school, $year] = static::context($request);
        $plans = static::plans($school, $year);
        $terms = $year ? Term::where('academic_year_id', $year->id)->orderBy('sequence')->get() : new Collection;

        return Inertia::render('assessments/calendar', [
            'yearLabel' => $year?->label,
            'tabs' => static::tabs($school, $year),
            'counts' => collect(AssessmentState::cases())->mapWithKeys(fn (AssessmentState $state) => [
                $state->value => $plans->where('state', $state)->count(),
            ]),
            'terms' => $terms->map(fn (Term $term) => [
                'id' => $term->id,
                'label' => $term->label,
                'current' => $term->is_current,
                'plans' => $plans->where('term_id', $term->id)->map(fn (AssessmentPlan $plan) => static::summary($plan))->values(),
            ]),
        ]);
    }

    public function create(Request $request): Response|RedirectResponse
    {
        [$school, $year] = static::context($request);

        return $year ? $this->form($request, $school, $year, null) : redirect()->route('assessments');
    }

    public function edit(Request $request, string $plan): Response|RedirectResponse
    {
        [$school, $year] = static::context($request);

        return $year ? $this->form($request, $school, $year, $this->plan($school, $plan)) : redirect()->route('assessments');
    }

    public function store(Request $request): RedirectResponse
    {
        [$school, $year] = static::context($request);
        $data = $this->validated($request, $school, $year, null);

        DB::transaction(function () use ($request, $school, $data) {
            $plan = AssessmentPlan::create([...$data['fields'], 'school_id' => $school->id, 'state' => AssessmentState::Draft]);
            $this->settle($plan, $data['schedule']);
            $this->audit($request, $school, $plan, $data['schedule'] ? 'scheduled' : 'drafted', $data['fields']);
        });

        return redirect()->route('assessments');
    }

    public function update(Request $request, string $plan): RedirectResponse
    {
        [$school, $year] = static::context($request);
        $target = $this->plan($school, $plan);

        if (! in_array($target->state, [AssessmentState::Draft, AssessmentState::Scheduled], true)) {
            throw ValidationException::withMessages([
                'name' => "{$target->name} has marks open or closed. Only its marks window can change now, under Marks progress.",
            ]);
        }

        $data = $this->validated($request, $school, $year, $target);

        DB::transaction(function () use ($request, $school, $target, $data) {
            $target->update($data['fields']);
            $this->settle($target, $data['schedule'] || $target->state === AssessmentState::Scheduled);
            $this->audit($request, $school, $target, 'updated', $data['fields']);
        });

        return redirect()->route('assessments');
    }

    /**
     * Start a term with the usual three drafts: two sequences and the exam.
     */
    public function usual(Request $request, string $term): RedirectResponse
    {
        [$school, $year] = static::context($request);
        $target = Term::where('school_id', $school->id)->where('academic_year_id', $year?->id)->where('id', $term)->firstOrFail();

        if (AssessmentPlan::where('term_id', $target->id)->exists()) {
            throw ValidationException::withMessages(['term' => "{$target->label} already has assessments."]);
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

        return back();
    }

    public function progress(Request $request): Response
    {
        [$school, $year] = static::context($request);
        $plans = static::plans($school, $year)->filter(fn (AssessmentPlan $plan) => $plan->state !== AssessmentState::Draft)->values();
        $plan = $plans->firstWhere('id', (string) $request->query('plan', ''))
            ?? $plans->firstWhere('state', AssessmentState::MarksOpen)
            ?? $plans->last(fn (AssessmentPlan $option) => in_array($option->state, [AssessmentState::MarksClosed, AssessmentState::Published], true))
            ?? $plans->first();

        if ($plan && in_array($plan->state, [AssessmentState::Scheduled, AssessmentState::MarksOpen], true)) {
            $plan->sync();
        }

        $sheets = $plan ? $plan->sheets() : new Collection;
        $unsubmitted = $sheets->whereNull('submitted_at');

        return Inertia::render('assessments/progress', [
            'tabs' => static::tabs($school, $year),
            'plans' => $plans->map(fn (AssessmentPlan $option) => static::summary($option)),
            'plan' => $plan ? static::summary($plan) : null,
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
                ->map(function (Collection $mine) {
                    $class = $mine->first()?->assessment?->schoolClass;

                    return [
                        'id' => $class?->id,
                        'name' => (string) $class?->name,
                        'form_master' => $class?->formMaster?->full_name,
                        'submitted' => $mine->whereNotNull('submitted_at')->count(),
                        'total' => $mine->count(),
                        'missing' => $mine->whereNull('submitted_at')->map(fn (AssessmentSubject $sheet) => [
                            'sheet_id' => $sheet->id,
                            'subject_id' => $sheet->subject_id,
                            'subject' => $sheet->subject?->name,
                            'teacher' => $sheet->examiner?->full_name,
                            'entered' => (int) $sheet->getAttribute('entered_count'),
                        ])->sortBy('subject')->values(),
                    ];
                })
                ->sortBy('name')
                ->values(),
        ]);
    }

    /**
     * Close marks entry: teachers can no longer enter marks and the
     * results open for review. Nothing is published yet.
     */
    public function close(Request $request, string $plan): RedirectResponse
    {
        [$school] = static::context($request);
        $target = $this->plan($school, $plan)->refreshState();

        if ($target->state !== AssessmentState::MarksOpen) {
            throw ValidationException::withMessages(['close' => "Marks are not open for {$target->name}."]);
        }

        $target->moveTo(AssessmentState::MarksClosed, ['closed_at' => now()]);
        $this->audit($request, $school, $target, 'marks_closed', []);

        return redirect()->route('assessments.results', ['plan' => $target->id]);
    }

    /**
     * Move the day the marks window closes. Extending a closed window
     * reopens marks entry, until results are published.
     */
    public function window(Request $request, string $plan): RedirectResponse
    {
        [$school] = static::context($request);
        $target = $this->plan($school, $plan)->refreshState();
        $ends = $target->term()->value('ends_on');

        if (! in_array($target->state, [AssessmentState::Scheduled, AssessmentState::MarksOpen, AssessmentState::MarksClosed], true)) {
            throw ValidationException::withMessages([
                'window_ends_on' => $target->state === AssessmentState::Published
                    ? 'Results are published, so the window cannot be reopened. Use Corrections.'
                    : 'Schedule the assessment first.',
            ]);
        }

        $data = $request->validate([
            'window_ends_on' => ['required', 'date', 'after_or_equal:today', 'after_or_equal:'.($target->window_starts_on?->toDateString() ?? 'today'), 'before_or_equal:'.$ends?->toDateString()],
        ], [
            'window_ends_on.after_or_equal' => 'Choose today or a later day, after the window opens.',
            'window_ends_on.before_or_equal' => 'The window must close inside the term.',
        ]);

        DB::transaction(function () use ($request, $school, $target, $data) {
            $before = $target->window_ends_on?->toDateString();
            $target->update(['window_ends_on' => $data['window_ends_on']]);
            $target->assessments()->update(['window_ends_on' => $data['window_ends_on']]);

            if ($target->state === AssessmentState::MarksClosed) {
                $target->moveTo(AssessmentState::MarksOpen, ['closed_at' => null]);
            }

            $this->audit($request, $school, $target, 'window_moved', ['from' => $before, 'to' => $data['window_ends_on']]);
        });

        return back();
    }

    public function results(Request $request): Response
    {
        [$school, $year] = static::context($request);
        $plans = static::plans($school, $year)
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
            'tabs' => static::tabs($school, $year),
            'plans' => $plans->map(fn (AssessmentPlan $option) => static::summary($option)),
            'plan' => $plan ? static::summary($plan) : null,
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
        [$school] = static::context($request);
        $target = $this->plan($school, $plan);

        if ($target->state !== AssessmentState::MarksClosed) {
            throw ValidationException::withMessages([
                'publish' => $target->state === AssessmentState::Published
                    ? "{$target->name} is already published."
                    : 'Close marks entry before publishing results.',
            ]);
        }

        $target->moveTo(AssessmentState::Published, ['published_at' => now(), 'published_by' => $request->user()?->id]);
        $this->audit($request, $school, $target, 'published', []);

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
            'tabs' => static::tabs($school, $year),
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
                ...static::summary($plan),
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
    protected function validated(Request $request, School $school, ?AcademicYear $year, ?AssessmentPlan $plan): array
    {
        $schedule = $request->boolean('schedule') || $plan?->state === AssessmentState::Scheduled;
        $term = Term::where('school_id', $school->id)
            ->where('academic_year_id', $year?->id)
            ->where('id', (string) $request->input('term_id'))
            ->first();
        $inside = $term ? ['after_or_equal:'.$term->starts_on->toDateString(), 'before_or_equal:'.$term->ends_on->toDateString()] : [];
        $need = $schedule ? 'required' : 'nullable';

        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('assessment_plans')->where('term_id', $term?->id)->ignore($plan?->id),
            ],
            'kind' => ['required', Rule::enum(AssessmentKind::class)],
            'term_id' => ['required', Rule::exists('terms', 'id')->where('school_id', $school->id)->where('academic_year_id', $year?->id)],
            'held_from' => [$need, 'date', ...$inside],
            'held_until' => [$need, 'date', 'after_or_equal:held_from', ...$inside],
            'window_starts_on' => [$need, 'date', 'after_or_equal:held_from', ...$inside],
            'window_ends_on' => [$need, 'date', 'after_or_equal:window_starts_on', 'after_or_equal:held_until', ...$inside],
            'level_ids' => ['required', 'array', 'min:1'],
            'level_ids.*' => ['distinct', Rule::exists('levels', 'id')->where('school_id', $school->id)->whereNull('deleted_at')],
        ], [
            'name.unique' => 'This term already has an assessment with that name.',
            'held_from.required' => 'Set the dates before scheduling.',
            'held_from.after_or_equal' => 'Keep the dates inside the term.',
            'held_from.before_or_equal' => 'Keep the dates inside the term.',
            'held_until.after_or_equal' => 'This must be on or after the first day, inside the term.',
            'held_until.before_or_equal' => 'Keep the dates inside the term.',
            'window_starts_on.after_or_equal' => 'The marks window opens with the tests, inside the term.',
            'window_starts_on.before_or_equal' => 'Keep the dates inside the term.',
            'window_ends_on.after_or_equal' => 'The window closes after it opens and after the last test.',
            'window_ends_on.before_or_equal' => 'Keep the dates inside the term.',
            'level_ids.required' => 'Choose at least one level.',
        ]);

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
