<?php

namespace App\Http\Controllers;

use App\Enums\ApplicationStage;
use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use App\Http\Requests\Enrolment\ClearClassRequest;
use App\Http\Requests\Enrolment\DecideReEnrolmentRequest;
use App\Http\Requests\Enrolment\PlaceLevelRequest;
use App\Http\Requests\Enrolment\PlaceStudentsRequest;
use App\Http\Requests\Enrolment\PromoteClassRequest;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Money;
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
 * Enrolment prepares the coming academic year: who continues, who is
 * new, which class each student sits in, and the final confirmation.
 */
class EnrolmentController extends Controller
{
    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();
        $current = $this->schoolContext->year();

        if (! $next) {
            return Inertia::render('enrolment/overview', [
                'enrolment' => null,
                'currentLabel' => $current?->label,
            ]);
        }

        $stages = Application::where('academic_year_id', $next->id)->pluck('stage');
        $successors = $school->successorLevels();
        $continuing = Enrolment::continuingFor($school, $this->schoolContext->year());
        $deciding = $continuing->filter(fn (Enrolment $enrolment) => isset($successors[(string) $enrolment->schoolClass?->level_id]));
        $progress = $next->enrolmentProgress($school, $this->schoolContext->year());

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
            'levels' => $next->enrolmentCapacity($school),
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
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $current = $this->schoolContext->year();

        if (SchoolClass::where('academic_year_id', $next->id)->exists()) {
            throw ValidationException::withMessages(['classes' => __(':label already has classes.', ['label' => $next->label])]);
        }

        $classes = $current
            ? SchoolClass::where('academic_year_id', $current->id)->orderBy('name')->get()
            : new Collection;

        if ($classes->isEmpty()) {
            throw ValidationException::withMessages(['classes' => __('This year has no classes to copy.')]);
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

        $this->notify('Classes copied to the coming year.');

        return back();
    }

    public function storeClass(Request $request, string $level): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $target = Level::where('school_id', $school->id)->where('id', $level)->firstOrFail();

        $taken = SchoolClass::withTrashed()
            ->where('academic_year_id', $next->id)
            ->where('level_id', $target->id)
            ->pluck('name')
            ->all();

        $name = collect(range('A', 'Z'))
            ->map(fn (string $letter) => SchoolClass::nameFor($target->name, $letter))
            ->first(fn (string $candidate) => ! in_array($candidate, $taken, true));

        if (! $name) {
            throw ValidationException::withMessages(['class' => __('This level already has every class from A to Z.')]);
        }

        $class = SchoolClass::create([
            'school_id' => $school->id,
            'academic_year_id' => $next->id,
            'level_id' => $target->id,
            'name' => $name,
            'capacity' => SchoolClass::DEFAULT_SEATS,
        ]);

        $this->audit($request, $school, 'school_class', $class->id, 'created', ['name' => $name, 'year' => $next->label]);

        $this->notify('Class added.');

        return back();
    }

    public function reEnrolment(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();
        $current = $this->schoolContext->year();

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $successors = $school->successorLevels();
        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->get();
        $continuing = Enrolment::continuingFor($school, $this->schoolContext->year());
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
            'enrolment' => $next->enrolmentProgress($school, $this->schoolContext->year()),
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

    public function decide(DecideReEnrolmentRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();

        $data = $request->validated();

        $enrolment = Enrolment::continuingFor($school, $this->schoolContext->year())->firstWhere('id', $data['enrolment_id']);
        $successors = $school->successorLevels();

        if (! $enrolment || ! isset($successors[(string) $enrolment->schoolClass?->level_id])) {
            throw ValidationException::withMessages([
                'decision' => __('That student is not one of this year\'s continuing students.'),
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
    public function promoteClass(PromoteClassRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $data = $request->validated();

        $successors = $school->successorLevels();
        $undecided = Enrolment::continuingFor($school, $this->schoolContext->year())
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

        $this->notify('Class promoted.');

        return back();
    }

    public function placement(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $capacity = collect($next->enrolmentCapacity($school));
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
            'enrolment' => $next->enrolmentProgress($school, $this->schoolContext->year()),
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

    public function place(PlaceStudentsRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();

        $data = $request->validated();

        $class = SchoolClass::whereKey($data['class_id'])->firstOrFail();
        $enrolments = Enrolment::where('academic_year_id', $next->id)
            ->where('level_id', $class->level_id)
            ->whereNull('school_class_id')
            ->whereIn('id', $data['enrolment_ids'])
            ->get();

        if ($enrolments->count() !== count($data['enrolment_ids'])) {
            throw ValidationException::withMessages([
                'enrolment_ids' => __('Some of those students are no longer waiting for a :name place. Reload and try again.', ['name' => $class->name]),
            ]);
        }

        $free = $class->capacity - Enrolment::where('school_class_id', $class->id)->count();

        if ($enrolments->count() > $free) {
            throw ValidationException::withMessages([
                'class_id' => $free > 0
                    ? __(':name has room for :free more, not :count.', ['name' => $class->name, 'free' => $free, 'count' => $enrolments->count()])
                    : __(':name is full. Choose another class or add one.', ['name' => $class->name]),
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

        $this->notify('Students placed.');

        return back();
    }

    /**
     * Fill a level's classes evenly with everyone still waiting, as far
     * as the seats go.
     */
    public function placeAll(PlaceLevelRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $data = $request->validated();

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
            throw ValidationException::withMessages(['level_id' => __('This level has no classes yet. Add one first.')]);
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

        $this->notify('Level placed.');

        return back();
    }

    /**
     * Send everyone in a class back to the waiting list.
     */
    public function clearClass(ClearClassRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $data = $request->validated();

        if ($next->enrolment_confirmed_at) {
            throw ValidationException::withMessages([
                'class_id' => __('Enrolment is confirmed, so a class can no longer be emptied.'),
            ]);
        }

        DB::transaction(function () use ($request, $school, $data) {
            $moved = Enrolment::where('school_class_id', $data['class_id'])
                ->update(['school_class_id' => null, 'status' => EnrolmentStatus::Admitted]);

            $this->audit($request, $school, 'school_class', $data['class_id'], 'students_unplaced', ['students' => $moved]);
        });

        $this->notify('Class cleared.');

        return back();
    }

    public function confirm(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $successors = $school->successorLevels();
        $continuing = Enrolment::continuingFor($school, $this->schoolContext->year());
        $enrolments = Enrolment::where('academic_year_id', $next->id)->get();
        $origins = $this->origins($school, $enrolments);
        $kinds = $enrolments->countBy(fn (Enrolment $enrolment) => $origins[$enrolment->student_id]['kind'] ?? 'new');
        $usesSeries = Level::where('school_id', $school->id)->where('uses_series', true)->pluck('id');

        return Inertia::render('enrolment/confirm', [
            'enrolment' => $next->enrolmentProgress($school, $this->schoolContext->year()),
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
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $progress = $next->enrolmentProgress($school, $this->schoolContext->year());

        if ($progress['confirmed']) {
            throw ValidationException::withMessages(['confirm' => __('Enrolment for :label is already confirmed.', ['label' => $next->label])]);
        }

        if (! $progress['ready']) {
            throw ValidationException::withMessages([
                'confirm' => __('Enrolment cannot be confirmed yet. Finish the checks that are still open.'),
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

        $this->notify('Enrolment confirmed.');

        return back();
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

        $plan->billTo($student, $term);
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
        $current = Enrolment::continuingFor($school, $this->schoolContext->year())->keyBy('student_id');
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
        $due = (int) $invoices->sum(fn (Invoice $invoice) => Money::units($invoice->amount_due) - $invoice->exemptedMinor());
        $paid = Money::sum($invoices->flatMap(fn (Invoice $invoice) => $invoice->payments->pluck('amount')));

        return Money::number(max(0, $due - $paid));
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
