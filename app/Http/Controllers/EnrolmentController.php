<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
use App\Enums\ApplicationStage;
use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Enrolment prepares the coming academic year: who continues, who is
 * new, which class each student sits in, and the final confirmation.
 */
class EnrolmentController extends Controller
{
    /**
     * The year enrolment is being prepared for: the first planned year
     * after the current one.
     */
    public static function nextYear(School $school): ?AcademicYear
    {
        $current = StructureController::currentYear($school);

        return AcademicYear::where('school_id', $school->id)
            ->where('status', AcademicYearStatus::Planned)
            ->when($current, fn (Builder $query) => $query->whereDate('starts_on', '>', $current?->starts_on))
            ->orderBy('starts_on')
            ->first();
    }

    /**
     * Where enrolment stands, shared by every enrolment page for its
     * tabs and for the checks before confirming.
     *
     * @return array{year: string, confirmed: bool, ready: bool, to_review: int, undecided: int, unplaced: int, expected: int, classes: int, over_levels: list<string>, over_classes: int, has_fee_plan: bool}
     */
    public static function progress(School $school, AcademicYear $next): array
    {
        $successors = static::successors($school);
        $undecided = static::continuing($school)
            ->filter(fn (Enrolment $enrolment) => $enrolment->decision === null
                && isset($successors[(string) $enrolment->schoolClass?->level_id]))
            ->count();
        $toReview = Application::where('academic_year_id', $next->id)
            ->where('stage', ApplicationStage::ToReview)
            ->count();
        $levels = static::capacity($school, $next);
        $expected = (int) array_sum(array_column($levels, 'expected'));
        $unplaced = $expected - (int) array_sum(array_column($levels, 'placed'));
        $overClasses = SchoolClass::where('academic_year_id', $next->id)
            ->withCount('enrolments')
            ->get()
            ->filter(fn (SchoolClass $class) => (int) $class->getAttribute('enrolments_count') > $class->capacity)
            ->count();

        return [
            'year' => $next->label,
            'confirmed' => $next->enrolment_confirmed_at !== null,
            'ready' => $toReview === 0 && $undecided === 0 && $unplaced === 0 && $expected > 0 && $overClasses === 0,
            'to_review' => $toReview,
            'undecided' => $undecided,
            'unplaced' => $unplaced,
            'expected' => $expected,
            'classes' => (int) array_sum(array_column($levels, 'classes')),
            'over_levels' => array_column(
                array_filter($levels, fn (array $level) => $level['expected'] > $level['seats']),
                'name',
            ),
            'over_classes' => $overClasses,
            'has_fee_plan' => FeePlan::where('school_id', $school->id)->where('academic_year_id', $next->id)->exists(),
        ];
    }

    /**
     * Each level's seats in the coming year against the students headed
     * for it: promoted, repeating and admitted.
     *
     * @return list<array{id: string, name: string, classes: int, seats: int, expected: int, placed: int}>
     */
    public static function capacity(School $school, AcademicYear $next): array
    {
        $classes = SchoolClass::where('academic_year_id', $next->id)->get(['id', 'level_id', 'capacity'])->groupBy('level_id');
        $enrolments = Enrolment::where('academic_year_id', $next->id)->get(['id', 'level_id', 'school_class_id'])->groupBy('level_id');

        return array_values(Level::where('school_id', $school->id)
            ->orderBy('ordinal')
            ->get()
            ->map(fn (Level $level) => [
                'id' => $level->id,
                'name' => $level->name,
                'classes' => $classes->get($level->id)?->count() ?? 0,
                'seats' => (int) ($classes->get($level->id)?->sum('capacity') ?? 0),
                'expected' => $enrolments->get($level->id)?->count() ?? 0,
                'placed' => $enrolments->get($level->id)?->whereNotNull('school_class_id')->count() ?? 0,
            ])
            ->all());
    }

    /**
     * The level each level leads to: the next one up in the same
     * subsystem. A level missing from the map is a final year.
     *
     * @return array<string, string>
     */
    public static function successors(School $school): array
    {
        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->get()->values();
        $map = [];

        foreach ($levels as $position => $level) {
            $next = $levels->slice($position + 1)
                ->first(fn (Level $candidate) => $candidate->subsystem === $level->subsystem && $candidate->ordinal > $level->ordinal);

            if ($next) {
                $map[$level->id] = $next->id;
            }
        }

        return $map;
    }

    /**
     * This year's students who sit in a class, with that class.
     *
     * @return Collection<int, Enrolment>
     */
    public static function continuing(School $school): Collection
    {
        $current = StructureController::currentYear($school);

        if (! $current) {
            return new Collection;
        }

        return Enrolment::where('academic_year_id', $current->id)
            ->whereNotNull('school_class_id')
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with('schoolClass:id,name,level_id')
            ->get();
    }

    public function index(Request $request): Response
    {
        $school = StudentController::schoolFor($request);
        $next = static::nextYear($school);
        $current = StructureController::currentYear($school);

        if (! $next) {
            return Inertia::render('enrolment/overview', [
                'enrolment' => null,
                'currentLabel' => $current?->label,
            ]);
        }

        $stages = Application::where('academic_year_id', $next->id)->pluck('stage');
        $successors = static::successors($school);
        $continuing = static::continuing($school);
        $deciding = $continuing->filter(fn (Enrolment $enrolment) => isset($successors[(string) $enrolment->schoolClass?->level_id]));
        $progress = static::progress($school, $next);

        return Inertia::render('enrolment/overview', [
            'enrolment' => $progress,
            'currentLabel' => $current?->label,
            'startsOn' => $next->starts_on->toDateString(),
            'applications' => [
                'total' => $stages->count(),
                'admitted' => $stages->filter(fn (ApplicationStage $stage) => $stage === ApplicationStage::Admitted)->count(),
                'to_review' => $progress['to_review'],
                'waitlist' => $stages->filter(fn (ApplicationStage $stage) => $stage === ApplicationStage::Waitlist)->count(),
                'declined' => $stages->filter(fn (ApplicationStage $stage) => $stage === ApplicationStage::Declined)->count(),
            ],
            'continuing' => [
                'total' => $deciding->count(),
                'promote' => $deciding->where('decision', EnrolmentDecision::Promote)->count(),
                'repeat' => $deciding->where('decision', EnrolmentDecision::Repeat)->count(),
                'leaving' => $deciding->where('decision', EnrolmentDecision::Leaving)->count(),
                'undecided' => $progress['undecided'],
                'graduating' => $continuing->count() - $deciding->count(),
            ],
            'levels' => static::capacity($school, $next),
            'copyable' => $current
                ? SchoolClass::where('academic_year_id', $current->id)->count()
                : 0,
        ]);
    }

    /**
     * Give the coming year the same classes as this year: names, seats,
     * streams and home rooms. Form masters are chosen again each year.
     */
    public function copyClasses(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);
        $current = StructureController::currentYear($school);

        if (SchoolClass::where('academic_year_id', $next->id)->exists()) {
            throw ValidationException::withMessages(['classes' => "{$next->label} already has classes."]);
        }

        $classes = $current
            ? SchoolClass::where('academic_year_id', $current->id)->orderBy('name')->get()
            : new Collection;

        if ($classes->isEmpty()) {
            throw ValidationException::withMessages(['classes' => 'This year has no classes to copy.']);
        }

        DB::transaction(function () use ($request, $school, $next, $classes) {
            foreach ($classes as $class) {
                SchoolClass::create([
                    'school_id' => $school->id,
                    'academic_year_id' => $next->id,
                    'level_id' => $class->level_id,
                    'name' => $class->name,
                    'capacity' => $class->capacity,
                    'stream' => $class->stream,
                    'home_room_id' => $class->home_room_id,
                ]);
            }

            $this->audit($request, $school, 'academic_year', $next->id, 'classes_copied', ['classes' => $classes->count()]);
        });

        return back();
    }

    public function storeClass(Request $request, string $level): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);
        $target = Level::where('school_id', $school->id)->where('id', $level)->firstOrFail();

        $taken = SchoolClass::withTrashed()
            ->where('academic_year_id', $next->id)
            ->where('level_id', $target->id)
            ->pluck('name')
            ->all();

        $name = collect(range('A', 'Z'))
            ->map(fn (string $letter) => "{$target->name} {$letter}")
            ->first(fn (string $candidate) => ! in_array($candidate, $taken, true));

        if (! $name) {
            throw ValidationException::withMessages(['class' => 'This level already has every class from A to Z.']);
        }

        $class = SchoolClass::create([
            'school_id' => $school->id,
            'academic_year_id' => $next->id,
            'level_id' => $target->id,
            'name' => $name,
            'capacity' => StructureController::DEFAULT_SEATS,
        ]);

        $this->audit($request, $school, 'school_class', $class->id, 'created', ['name' => $name, 'year' => $next->label]);

        return back();
    }

    public function reEnrolment(Request $request): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = static::nextYear($school);
        $current = StructureController::currentYear($school);

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $successors = static::successors($school);
        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->get();
        $continuing = static::continuing($school);
        $classes = $current
            ? SchoolClass::where('academic_year_id', $current->id)->orderBy('name')->get()
            : new Collection;
        $open = $classes->filter(fn (SchoolClass $class) => isset($successors[$class->level_id]))->values();

        $undecidedIn = fn (SchoolClass $class) => $continuing
            ->where('school_class_id', $class->id)
            ->whereNull('decision')
            ->count();

        $requested = (string) $request->query('class', '');
        $levelId = (string) $request->query('level', '');
        $inLevel = $levelId !== '' ? $open->where('level_id', $levelId)->values() : $open;
        $class = $open->firstWhere('id', $requested)
            ?? $inLevel->first(fn (SchoolClass $candidate) => $undecidedIn($candidate) > 0)
            ?? $inLevel->first()
            ?? $open->first();

        $level = $class ? $levels->firstWhere('id', $class->level_id) : null;
        $nextLevel = $level ? $levels->firstWhere('id', $successors[$level->id] ?? null) : null;

        $rows = $class
            ? Enrolment::whereIn('id', $continuing->where('school_class_id', $class->id)->modelKeys())
                ->with(['student.invoices.payments', 'student.invoices.exemption'])
                ->get()
                ->sortBy(fn (Enrolment $enrolment) => $enrolment->student?->full_name)
                ->values()
            : new Collection;

        return Inertia::render('enrolment/re-enrolment', [
            'enrolment' => static::progress($school, $next),
            'levels' => $levels
                ->filter(fn (Level $option) => isset($successors[$option->id]) && $open->contains('level_id', $option->id))
                ->map(fn (Level $option) => ['id' => $option->id, 'name' => $option->name])
                ->values(),
            'graduating' => $levels
                ->filter(fn (Level $option) => ! isset($successors[$option->id]) && $classes->contains('level_id', $option->id))
                ->pluck('name')
                ->values(),
            'level' => $level ? [
                'id' => $level->id,
                'name' => $level->name,
                'next' => $nextLevel?->name,
            ] : null,
            'classes' => $level
                ? $open->where('level_id', $level->id)->map(function (SchoolClass $option) use ($continuing, $undecidedIn) {
                    $total = $continuing->where('school_class_id', $option->id)->count();

                    return [
                        'id' => $option->id,
                        'name' => $option->name,
                        'total' => $total,
                        'decided' => $total - $undecidedIn($option),
                    ];
                })->values()
                : [],
            'class' => $class ? ['id' => $class->id, 'name' => $class->name] : null,
            'students' => $rows->map(fn (Enrolment $enrolment) => [
                'id' => $enrolment->id,
                'name' => $enrolment->student?->full_name,
                'matricule' => $enrolment->student?->admission_no,
                'decision' => $enrolment->decision?->value,
                'owed' => $this->owed($enrolment),
            ]),
        ]);
    }

    public function decide(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);

        $data = $request->validate([
            'enrolment_id' => ['required', 'uuid'],
            'decision' => ['nullable', Rule::enum(EnrolmentDecision::class)],
        ]);

        $enrolment = static::continuing($school)->firstWhere('id', $data['enrolment_id']);
        $successors = static::successors($school);

        if (! $enrolment || ! isset($successors[(string) $enrolment->schoolClass?->level_id])) {
            throw ValidationException::withMessages([
                'decision' => 'That student is not one of this year\'s continuing students.',
            ]);
        }

        $decision = isset($data['decision']) ? EnrolmentDecision::from($data['decision']) : null;

        DB::transaction(function () use ($request, $school, $next, $enrolment, $decision, $successors) {
            $this->applyDecision($enrolment, $decision, $next, $successors);
            $this->audit($request, $school, 'enrolment', $enrolment->id, 'decided', [
                'decision' => $decision?->value,
                'for' => $next->label,
            ]);
        });

        return back();
    }

    /**
     * Promote everyone in a class who has no decision yet.
     */
    public function promoteClass(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);
        $data = $request->validate(['class_id' => ['required', 'uuid']]);

        $successors = static::successors($school);
        $undecided = static::continuing($school)
            ->where('school_class_id', $data['class_id'])
            ->whereNull('decision')
            ->filter(fn (Enrolment $enrolment) => isset($successors[(string) $enrolment->schoolClass?->level_id]));

        DB::transaction(function () use ($request, $school, $next, $undecided, $successors, $data) {
            foreach ($undecided as $enrolment) {
                $this->applyDecision($enrolment, EnrolmentDecision::Promote, $next, $successors);
            }

            if ($undecided->isNotEmpty()) {
                $this->audit($request, $school, 'school_class', $data['class_id'], 'promoted_undecided', [
                    'students' => $undecided->count(),
                    'for' => $next->label,
                ]);
            }
        });

        return back();
    }

    public function placement(Request $request): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = static::nextYear($school);

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $capacity = collect(static::capacity($school, $next));
        $busy = $capacity->filter(fn (array $level) => $level['expected'] > 0 || $level['classes'] > 0)->values();
        $level = $busy->firstWhere('id', (string) $request->query('level', ''))
            ?? $busy->first(fn (array $option) => $option['expected'] > $option['placed'])
            ?? $busy->first();

        $enrolments = $level
            ? Enrolment::where('academic_year_id', $next->id)
                ->where('level_id', $level['id'])
                ->with('student:id,full_name,admission_no')
                ->get()
            : new Collection;
        $origins = $this->origins($school, $enrolments);
        $classes = $level
            ? SchoolClass::where('academic_year_id', $next->id)->where('level_id', $level['id'])->orderBy('name')->get()
            : new Collection;

        return Inertia::render('enrolment/placement', [
            'enrolment' => static::progress($school, $next),
            'levels' => $busy->map(fn (array $option) => [
                'id' => $option['id'],
                'name' => $option['name'],
                'over' => $option['expected'] > $option['seats'],
                'waiting' => $option['expected'] - $option['placed'],
            ]),
            'level' => $level,
            'waiting' => $enrolments
                ->whereNull('school_class_id')
                ->sortBy(fn (Enrolment $enrolment) => $enrolment->student?->full_name)
                ->map(fn (Enrolment $enrolment) => [
                    'id' => $enrolment->id,
                    'name' => $enrolment->student?->full_name,
                    'kind' => $origins[$enrolment->student_id]['kind'] ?? 'new',
                    'from' => $origins[$enrolment->student_id]['from'] ?? null,
                ])
                ->values(),
            'classes' => $classes->map(function (SchoolClass $class) use ($enrolments, $origins) {
                $placed = $enrolments->where('school_class_id', $class->id);
                $kinds = $placed->countBy(fn (Enrolment $enrolment) => $origins[$enrolment->student_id]['kind'] ?? 'new');

                return [
                    'id' => $class->id,
                    'name' => $class->name,
                    'capacity' => $class->capacity,
                    'placed' => $placed->count(),
                    'promoted' => (int) $kinds->get('promoted', 0),
                    'repeating' => (int) $kinds->get('repeating', 0),
                    'new' => (int) $kinds->get('new', 0),
                ];
            })->values(),
        ]);
    }

    public function place(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);

        $data = $request->validate([
            'class_id' => ['required', Rule::exists('school_classes', 'id')
                ->where('school_id', $school->id)
                ->where('academic_year_id', $next->id)],
            'enrolment_ids' => ['required', 'array', 'min:1'],
            'enrolment_ids.*' => ['uuid', 'distinct'],
        ], [
            'enrolment_ids.required' => 'Tick the students to place first.',
        ]);

        $class = SchoolClass::whereKey($data['class_id'])->firstOrFail();
        $enrolments = Enrolment::where('academic_year_id', $next->id)
            ->where('level_id', $class->level_id)
            ->whereNull('school_class_id')
            ->whereIn('id', $data['enrolment_ids'])
            ->get();

        if ($enrolments->count() !== count($data['enrolment_ids'])) {
            throw ValidationException::withMessages([
                'enrolment_ids' => "Some of those students are no longer waiting for a {$class->name} place. Reload and try again.",
            ]);
        }

        $free = $class->capacity - Enrolment::where('school_class_id', $class->id)->count();

        if ($enrolments->count() > $free) {
            throw ValidationException::withMessages([
                'class_id' => $free > 0
                    ? "{$class->name} has room for {$free} more, not {$enrolments->count()}."
                    : "{$class->name} is full. Choose another class or add one.",
            ]);
        }

        DB::transaction(function () use ($request, $school, $next, $class, $enrolments) {
            foreach ($enrolments as $enrolment) {
                $this->seat($school, $next, $enrolment, $class);
            }

            $this->audit($request, $school, 'school_class', $class->id, 'students_placed', [
                'students' => $enrolments->count(),
                'year' => $next->label,
            ]);
        });

        return back();
    }

    /**
     * Fill a level's classes evenly with everyone still waiting, as far
     * as the seats go.
     */
    public function placeAll(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);
        $data = $request->validate([
            'level_id' => ['required', Rule::exists('levels', 'id')->where('school_id', $school->id)],
        ]);

        $classes = SchoolClass::where('academic_year_id', $next->id)
            ->where('level_id', $data['level_id'])
            ->withCount('enrolments')
            ->orderBy('name')
            ->get();
        $waiting = Enrolment::where('academic_year_id', $next->id)
            ->where('level_id', $data['level_id'])
            ->whereNull('school_class_id')
            ->with('student:id,full_name')
            ->get()
            ->sortBy(fn (Enrolment $enrolment) => $enrolment->student?->full_name)
            ->values();

        if ($classes->isEmpty()) {
            throw ValidationException::withMessages(['level_id' => 'This level has no classes yet. Add one first.']);
        }

        $taken = $classes->mapWithKeys(fn (SchoolClass $class) => [$class->id => (int) $class->getAttribute('enrolments_count')])->all();

        DB::transaction(function () use ($request, $school, $next, $classes, $waiting, $taken, $data) {
            $placed = 0;

            foreach ($waiting as $enrolment) {
                $class = $classes
                    ->filter(fn (SchoolClass $candidate) => $taken[$candidate->id] < $candidate->capacity)
                    ->sortBy(fn (SchoolClass $candidate) => $taken[$candidate->id])
                    ->first();

                if (! $class) {
                    break;
                }

                $this->seat($school, $next, $enrolment, $class);
                $taken[$class->id]++;
                $placed++;
            }

            $this->audit($request, $school, 'level', $data['level_id'], 'students_placed', [
                'students' => $placed,
                'year' => $next->label,
            ]);
        });

        return back();
    }

    /**
     * Send everyone in a class back to the waiting list.
     */
    public function clearClass(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);
        $data = $request->validate([
            'class_id' => ['required', Rule::exists('school_classes', 'id')
                ->where('school_id', $school->id)
                ->where('academic_year_id', $next->id)],
        ]);

        if ($next->enrolment_confirmed_at) {
            throw ValidationException::withMessages([
                'class_id' => 'Enrolment is confirmed, so a class can no longer be emptied.',
            ]);
        }

        DB::transaction(function () use ($request, $school, $data) {
            $moved = Enrolment::where('school_class_id', $data['class_id'])
                ->update(['school_class_id' => null, 'status' => EnrolmentStatus::Admitted]);

            $this->audit($request, $school, 'school_class', $data['class_id'], 'students_unplaced', ['students' => $moved]);
        });

        return back();
    }

    public function confirm(Request $request): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = static::nextYear($school);

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $successors = static::successors($school);
        $continuing = static::continuing($school);
        $enrolments = Enrolment::where('academic_year_id', $next->id)->get();
        $origins = $this->origins($school, $enrolments);
        $kinds = $enrolments->countBy(fn (Enrolment $enrolment) => $origins[$enrolment->student_id]['kind'] ?? 'new');
        $usesSeries = Level::where('school_id', $school->id)->where('uses_series', true)->pluck('id');

        return Inertia::render('enrolment/confirm', [
            'enrolment' => static::progress($school, $next),
            'confirmedOn' => $next->enrolment_confirmed_at?->toDateString(),
            'who' => [
                'promoted' => (int) $kinds->get('promoted', 0),
                'repeating' => (int) $kinds->get('repeating', 0),
                'new' => (int) $kinds->get('new', 0),
                'graduating' => $continuing
                    ->filter(fn (Enrolment $enrolment) => ! isset($successors[(string) $enrolment->schoolClass?->level_id]))
                    ->count(),
                'leaving' => $continuing->where('decision', EnrolmentDecision::Leaving)->count(),
                'series' => $enrolments->whereIn('level_id', $usesSeries)->count(),
            ],
        ]);
    }

    public function storeConfirmation(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $next = $this->requireYear($school);
        $progress = static::progress($school, $next);

        if ($progress['confirmed']) {
            throw ValidationException::withMessages(['confirm' => "Enrolment for {$next->label} is already confirmed."]);
        }

        if (! $progress['ready']) {
            throw ValidationException::withMessages([
                'confirm' => 'Enrolment cannot be confirmed yet. Finish the checks that are still open.',
            ]);
        }

        DB::transaction(function () use ($request, $school, $next) {
            $placed = Enrolment::where('academic_year_id', $next->id)
                ->where('status', EnrolmentStatus::Placed)
                ->with('schoolClass:id,level_id')
                ->get();

            foreach ($placed as $enrolment) {
                $enrolment->update(['status' => EnrolmentStatus::Enrolled]);
                $this->bill($school, $next, $enrolment);
            }

            $next->update(['enrolment_confirmed_at' => now()]);
            $this->audit($request, $school, 'academic_year', $next->id, 'enrolment_confirmed', ['students' => $placed->count()]);
        });

        return back();
    }

    /**
     * The enrolment year, or a validation error when there is none.
     */
    protected function requireYear(School $school): AcademicYear
    {
        return static::nextYear($school) ?? throw ValidationException::withMessages([
            'year' => 'Enrolment needs a planned academic year. Add next year in School Setup first.',
        ]);
    }

    /**
     * Record a decision on this year's row and keep the student's row
     * for the coming year in step: one headed for the right level when
     * they continue, none when they leave or are undecided.
     *
     * @param  array<string, string>  $successors
     */
    protected function applyDecision(Enrolment $enrolment, ?EnrolmentDecision $decision, AcademicYear $next, array $successors): void
    {
        $levelId = (string) $enrolment->schoolClass?->level_id;
        $target = match ($decision) {
            EnrolmentDecision::Promote => $successors[$levelId] ?? null,
            EnrolmentDecision::Repeat => $levelId,
            default => null,
        };

        $enrolment->update(['decision' => $decision]);

        $coming = Enrolment::where('student_id', $enrolment->student_id)
            ->where('academic_year_id', $next->id)
            ->first();

        if (! $target) {
            $coming?->delete();

            return;
        }

        if (! $coming) {
            Enrolment::create([
                'student_id' => $enrolment->student_id,
                'academic_year_id' => $next->id,
                'level_id' => $target,
                'status' => EnrolmentStatus::Admitted,
            ]);

            return;
        }

        if ($coming->level_id !== $target) {
            $coming->update([
                'level_id' => $target,
                'school_class_id' => null,
                'status' => EnrolmentStatus::Admitted,
            ]);
        }
    }

    /**
     * Put a student in a class. Before confirmation they are Placed;
     * afterwards a late arrival is Enrolled straight away.
     */
    protected function seat(School $school, AcademicYear $next, Enrolment $enrolment, SchoolClass $class): void
    {
        $confirmed = $next->enrolment_confirmed_at !== null;

        $enrolment->update([
            'school_class_id' => $class->id,
            'status' => $confirmed ? EnrolmentStatus::Enrolled : EnrolmentStatus::Placed,
        ]);

        if ($confirmed) {
            $this->bill($school, $next, $enrolment);
        }
    }

    /**
     * Issue the coming year's invoice when its level has a fee plan and
     * the year has a first term to bill against.
     */
    protected function bill(School $school, AcademicYear $next, Enrolment $enrolment): void
    {
        $term = Term::where('academic_year_id', $next->id)->orderBy('sequence')->first();
        $plan = FeePlan::where('school_id', $school->id)
            ->where('academic_year_id', $next->id)
            ->where('level_id', $enrolment->level_id)
            ->first();
        $student = $enrolment->student;

        if (! $term || ! $plan || ! $student) {
            return;
        }

        if (Invoice::where('student_id', $student->id)->where('term_id', $term->id)->exists()) {
            return;
        }

        Invoice::issue($student, $term, $plan, (string) $plan->annual_amount);
    }

    /**
     * Where each student of the coming year comes from: promoted or
     * repeating from one of this year's classes, or new to the school.
     *
     * @param  Collection<int, Enrolment>  $enrolments
     * @return array<string, array{kind: string, from: string|null}>
     */
    protected function origins(School $school, Collection $enrolments): array
    {
        $current = static::continuing($school)->keyBy('student_id');
        $origins = [];

        foreach ($enrolments as $enrolment) {
            $before = $current->get($enrolment->student_id);

            $origins[$enrolment->student_id] = [
                'kind' => match (true) {
                    ! $before => 'new',
                    $before->decision === EnrolmentDecision::Repeat => 'repeating',
                    default => 'promoted',
                },
                'from' => $before?->schoolClass?->name,
            ];
        }

        return $origins;
    }

    /**
     * What the student still owes across every invoice.
     */
    protected function owed(Enrolment $enrolment): float
    {
        $student = $enrolment->student;
        $invoices = $student ? $student->invoices : new Collection;
        $due = (float) $invoices->sum(fn (Invoice $invoice) => (float) $invoice->amount_due - $invoice->exempted());
        $paid = (float) $invoices->sum(fn (Invoice $invoice) => (float) $invoice->payments->sum(fn (Payment $payment) => (float) $payment->amount));

        return max(0.0, $due - $paid);
    }

    protected function audit(Request $request, School $school, string $entity, string $entityId, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => $entity,
            'entity_id' => $entityId,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
