<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\PaymentMethod;
use App\Http\Requests\Fees\BillFeesRequest;
use App\Http\Requests\Fees\ExemptInvoiceRequest;
use App\Http\Requests\Fees\RecordPaymentRequest;
use App\Http\Requests\Fees\UpdateFeeStructureRequest;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeeExemption;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Fees: what each level costs in a year, who has been billed, what
 * each student has paid, and the receipts for it.
 */
class FeeController extends Controller
{
    protected const int PER_PAGE = 10;

    protected const array FILTERS = ['all', 'overdue', 'owing', 'paid', 'unbilled'];

    /**
     * The bound school, for a signed-in user allowed to handle fees.
     */
    public static function schoolFor(Request $request): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        abort_unless((bool) $request->user()?->role->managesFees(), 403);

        return $school;
    }

    /**
     * Everyone enrolled this year with what they were billed and paid.
     */
    public function index(Request $request): Response
    {
        $school = static::schoolFor($request);
        $year = StructureController::currentYear($school);
        $filter = in_array($request->query('show'), static::FILTERS, true) ? (string) $request->query('show') : 'all';
        $search = mb_strtolower(trim((string) $request->query('q', '')));
        $page = max(1, (int) $request->query('page', 1));

        $rows = collect($year ? $this->enrolled($school, $year) : [])->map(function (Enrolment $enrolment) {
            $ledgers = ($enrolment->student->invoices ?? new Collection)
                ->map(fn (Invoice $invoice) => $invoice->syncStatus()->ledger());
            $due = (float) $ledgers->sum('due');
            $balance = (float) $ledgers->sum('balance');
            $overdue = (float) $ledgers->sum('overdue');

            return [
                'id' => $enrolment->student_id,
                'name' => (string) $enrolment->student?->full_name,
                'matricule' => (string) $enrolment->student?->admission_no,
                'class' => $enrolment->schoolClass?->name,
                'due' => $due,
                'paid' => (float) $ledgers->sum('paid'),
                'balance' => $balance,
                'overdue' => $overdue,
                'state' => match (true) {
                    $ledgers->isEmpty() => 'unbilled',
                    $balance <= 0 => 'paid',
                    $overdue > 0 => 'overdue',
                    default => 'owing',
                },
            ];
        });

        $counts = ['all' => $rows->count(), ...$rows->countBy('state')->all()];
        $listed = $rows
            ->filter(fn (array $row) => $filter === 'all' || $row['state'] === $filter)
            ->filter(fn (array $row) => $search === ''
                || str_contains(mb_strtolower($row['name']), $search)
                || str_contains(mb_strtolower($row['matricule']), $search))
            ->sortBy([['overdue', 'desc'], ['balance', 'desc'], ['name', 'asc']])
            ->values();

        return Inertia::render('fees/index', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'totals' => [
                'billed' => (float) $rows->sum('due'),
                'collected' => (float) $rows->sum('paid'),
                'outstanding' => (float) $rows->sum('balance'),
                'overdue' => (float) $rows->sum('overdue'),
            ],
            'counts' => [
                'all' => $counts['all'],
                'overdue' => $counts['overdue'] ?? 0,
                'owing' => $counts['owing'] ?? 0,
                'paid' => $counts['paid'] ?? 0,
                'unbilled' => $counts['unbilled'] ?? 0,
            ],
            'filters' => ['show' => $filter, 'q' => trim((string) $request->query('q', ''))],
            'students' => [
                'rows' => $listed->forPage($page, static::PER_PAGE)->values(),
                'page' => $page,
                'lastPage' => max(1, (int) ceil($listed->count() / static::PER_PAGE)),
                'total' => $listed->count(),
            ],
            'hasPlans' => $year !== null && FeePlan::where('school_id', $school->id)->where('academic_year_id', $year->id)->exists(),
        ]);
    }

    /**
     * What each level costs for a year, and who still has to be billed.
     */
    public function structure(Request $request): Response
    {
        $school = static::schoolFor($request);
        $years = AcademicYear::where('school_id', $school->id)
            ->where('status', '!=', AcademicYearStatus::Closed)
            ->orderBy('starts_on')
            ->get();
        $year = $years->firstWhere('id', (string) $request->query('year', ''))
            ?? $years->firstWhere('status', AcademicYearStatus::Current)
            ?? $years->first();

        if (! $year) {
            return Inertia::render('fees/structure', ['year' => null, 'currency' => $school->currency]);
        }

        $plans = FeePlan::where('school_id', $school->id)->where('academic_year_id', $year->id)->get()->keyBy('level_id');
        $previous = AcademicYear::where('school_id', $school->id)->whereDate('starts_on', '<', $year->starts_on)->orderByDesc('starts_on')->first();
        $before = $previous
            ? FeePlan::where('school_id', $school->id)->where('academic_year_id', $previous->id)->pluck('annual_amount', 'level_id')
            : collect();
        $enrolled = collect($this->enrolled($school, $year))->groupBy(fn (Enrolment $enrolment) => (string) ($enrolment->level_id ?? $enrolment->schoolClass?->level_id));

        return Inertia::render('fees/structure', [
            'currency' => $school->currency,
            'years' => $years->map(fn (AcademicYear $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'current' => $option->status === AcademicYearStatus::Current,
            ]),
            'year' => ['id' => $year->id, 'label' => $year->label, 'current' => $year->status === AcademicYearStatus::Current],
            'previousLabel' => $previous?->label,
            'billingTerm' => $this->billingTerm($school, $year)?->label,
            'installments' => FeeInstallmentTemplate::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->orderBy('seq')
                ->get()
                ->map(fn (FeeInstallmentTemplate $template) => [
                    'seq' => $template->seq,
                    'label' => Invoice::ordinal($template->seq),
                    'percent' => (float) $template->percent,
                    'due_on' => $template->due_on?->toDateString(),
                ]),
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get()->map(function (Level $level) use ($plans, $before, $enrolled) {
                $students = $enrolled->get($level->id);
                $billed = $students
                    ? $students->filter(fn (Enrolment $enrolment) => (bool) $enrolment->student?->invoices->isNotEmpty())->count()
                    : 0;
                $plan = $plans->get($level->id);

                return [
                    'id' => $level->id,
                    'name' => $level->name,
                    'amount' => $plan ? (float) $plan->annual_amount : null,
                    'previous' => $before->has($level->id) ? (float) $before->get($level->id) : null,
                    'students' => $students ? $students->count() : 0,
                    'billed' => $billed,
                ];
            }),
        ]);
    }

    public function updateStructure(UpdateFeeStructureRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request);

        $data = $request->validated();

        $levels = Level::where('school_id', $school->id)->pluck('id')->all();
        $year = AcademicYear::whereKey($data['year_id'])->firstOrFail();

        if ($year->status === AcademicYearStatus::Closed) {
            throw ValidationException::withMessages(['year_id' => "{$year->label} is closed. Its fees can no longer change."]);
        }

        DB::transaction(function () use ($request, $school, $year, $data, $levels) {
            $changes = [];

            foreach ($data['amounts'] as $levelId => $amount) {
                if (! in_array($levelId, $levels, true)) {
                    continue;
                }

                $plan = FeePlan::where('school_id', $school->id)
                    ->where('level_id', $levelId)
                    ->where('academic_year_id', $year->id)
                    ->first();
                $value = $amount === null || $amount === '' ? null : number_format((float) $amount, 2, '.', '');

                if ($value === null) {
                    if ($plan && Invoice::where('fee_plan_id', $plan->id)->exists()) {
                        throw ValidationException::withMessages([
                            "amounts.{$levelId}" => 'Students are already billed on this fee, so it cannot be removed.',
                        ]);
                    }

                    if ($plan) {
                        $changes[$levelId] = ['from' => $plan->annual_amount, 'to' => null];
                        $plan->delete();
                    }

                    continue;
                }

                if ($plan && number_format((float) $plan->annual_amount, 2, '.', '') === $value) {
                    continue;
                }

                $changes[$levelId] = ['from' => $plan?->annual_amount, 'to' => $value];
                FeePlan::updateOrCreate(
                    ['school_id' => $school->id, 'level_id' => $levelId, 'academic_year_id' => $year->id],
                    ['annual_amount' => $value, 'currency' => $school->currency, 'is_active' => true],
                );
            }

            if ($changes !== []) {
                $this->audit($request, $school, 'academic_year', $year->id, 'fees_set', $changes);
            }
        });

        return back();
    }

    /**
     * Issue the year's invoice to every enrolled student who has none,
     * in the levels that have a fee.
     */
    public function bill(BillFeesRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request);

        $data = $request->validated();

        $year = AcademicYear::whereKey($data['year_id'])->firstOrFail();
        $term = $this->billingTerm($school, $year);

        if (! $term) {
            throw ValidationException::withMessages([
                'bill' => "{$year->label} has no term to bill against. Add its terms in School Setup first.",
            ]);
        }

        $plans = FeePlan::where('school_id', $school->id)->where('academic_year_id', $year->id)->get()->keyBy('level_id');

        DB::transaction(function () use ($request, $school, $year, $term, $plans, $data) {
            $billed = 0;

            foreach ($this->enrolled($school, $year) as $enrolment) {
                $levelId = (string) ($enrolment->level_id ?? $enrolment->schoolClass?->level_id);
                $plan = $plans->get($levelId);
                $student = $enrolment->student;

                if (! $plan || ! $student || $student->invoices->isNotEmpty()) {
                    continue;
                }

                if (($data['level_id'] ?? null) && $data['level_id'] !== $levelId) {
                    continue;
                }

                if ($enrolment->status !== EnrolmentStatus::Enrolled) {
                    continue;
                }

                Invoice::issue($student, $term, $plan, (string) $plan->annual_amount);
                $billed++;
            }

            $this->audit($request, $school, 'academic_year', $year->id, 'students_billed', [
                'students' => $billed,
                'level_id' => $data['level_id'] ?? null,
            ]);
        });

        return back();
    }

    /**
     * One student's ledger: installments, payments and what is owed.
     */
    public function student(Request $request, string $student): Response
    {
        $school = static::schoolFor($request);
        $target = $this->findStudent($school, $student);
        $year = StructureController::currentYear($school);
        $invoices = Invoice::where('student_id', $target->id)
            ->with(['installments', 'exemption.granter:id,full_name', 'payments.receiver:id,full_name', 'term.academicYear'])
            ->orderBy('issued_on')
            ->get();
        $invoice = $invoices->firstWhere('id', (string) $request->query('invoice', ''))
            ?? $invoices->first(fn (Invoice $candidate) => $candidate->syncStatus()->ledger()['balance'] > 0)
            ?? $invoices->last();
        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)->where('academic_year_id', $year->id)->with('schoolClass.level')->first()
            : null;
        $ledger = $invoice?->ledger();

        return Inertia::render('fees/student', [
            'currency' => $school->currency,
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'matricule' => $target->admission_no,
                'guardian' => $target->guardian_name,
                'phone' => $target->guardian_phone,
                'level' => $enrolment?->schoolClass?->level?->name,
                'class' => $enrolment?->schoolClass?->name,
            ],
            'invoices' => $invoices->map(fn (Invoice $option) => [
                'id' => $option->id,
                'year' => $option->term?->academicYear?->label,
                'balance' => $option->ledger()['balance'],
            ]),
            'invoice' => $invoice && $ledger ? [
                'id' => $invoice->id,
                'year' => $invoice->term?->academicYear?->label,
                ...$ledger,
                'exemption' => $this->exemptionOf($invoice),
                'payments' => $invoice->payments->sortByDesc('received_at')->values()->map(fn (Payment $payment) => [
                    'id' => $payment->id,
                    'on' => $payment->received_at->toDateString(),
                    'method' => $payment->method->label(),
                    'reference' => $payment->reference,
                    'by' => $payment->receiver?->full_name,
                    'amount' => (float) $payment->amount,
                    'receipt' => $payment->receipt_no,
                ]),
            ] : null,
            'today' => today()->toDateString(),
            'methods' => collect([PaymentMethod::Cash, PaymentMethod::MobileMoney, PaymentMethod::BankTransfer])
                ->map(fn (PaymentMethod $method) => ['value' => $method->value, 'label' => $method->label()]),
        ]);
    }

    public function pay(RecordPaymentRequest $request, string $student): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = $this->findStudent($school, $student);

        $data = $request->validated();

        $invoice = Invoice::whereKey($data['invoice_id'])->with(['installments', 'payments', 'exemption'])->firstOrFail();
        $balance = $invoice->ledger()['balance'];

        if ((float) $data['amount'] > $balance) {
            throw ValidationException::withMessages([
                'amount' => $balance > 0
                    ? 'That is more than the '.number_format($balance).' still owed.'
                    : 'This invoice is already paid in full.',
            ]);
        }

        $payment = DB::transaction(function () use ($request, $school, $invoice, $data) {
            $payment = $invoice->recordPayment(
                number_format((float) $data['amount'], 2, '.', ''),
                $data['method'],
                $request->user(),
                null,
                isset($data['reference']) ? trim($data['reference']) : null,
                Carbon::parse($data['date'])->setTimeFrom(now()),
            );

            $this->audit($request, $school, 'payment', $payment->id, 'recorded', [
                'receipt' => $payment->receipt_no,
                'amount' => $payment->amount,
                'method' => $payment->method->value,
            ]);

            return $payment;
        });

        return redirect()->route('fees.receipt', $payment->id);
    }

    public function receipt(Request $request, string $payment): Response
    {
        $school = static::schoolFor($request);
        $target = Payment::whereKey($payment)
            ->whereHas('invoice.student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with(['invoice.installments', 'invoice.exemption', 'invoice.payments', 'invoice.student', 'invoice.term.academicYear', 'receiver:id,full_name'])
            ->firstOrFail();
        $invoice = $target->invoice;
        $student = $invoice?->student;
        $year = StructureController::currentYear($school);

        return Inertia::render('fees/receipt', [
            'issuer' => ['name' => $school->name, 'town' => $school->town],
            'currency' => $school->currency,
            'receipt' => [
                'number' => $target->receipt_no,
                'on' => $target->received_at->toDateString(),
                'amount' => (float) $target->amount,
                'method' => $target->method->label(),
                'reference' => $target->reference,
                'by' => $target->receiver?->full_name,
                'year' => $invoice?->term?->academicYear?->label,
                'balance' => $invoice ? $invoice->ledger()['balance'] : 0.0,
                'due' => $invoice ? $invoice->ledger()['due'] : 0.0,
            ],
            'student' => [
                'id' => $student?->id,
                'name' => $student?->full_name,
                'matricule' => $student?->admission_no,
                'class' => $student && $year
                    ? Enrolment::where('student_id', $student->id)->where('academic_year_id', $year->id)->with('schoolClass:id,name')->first()?->schoolClass?->name
                    : null,
            ],
        ]);
    }

    /**
     * The Fees tab of a student record: the plan, each installment,
     * the payments, and any exemption. Roles that keep student records
     * can read it; only fee roles can act on it.
     */
    public function studentTab(Request $request, string $student): Response
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;
        $role = $request->user()?->role;

        if (! $school instanceof School) {
            abort(404);
        }

        abort_unless($role && ($role->managesStudents() || $role->managesFees()), 403);

        $target = $this->findStudent($school, $student)->load('guardians');
        $year = StructureController::currentYear($school);
        $invoices = Invoice::where('student_id', $target->id)
            ->with(['installments', 'exemption.granter:id,full_name', 'payments.receiver:id,full_name,role', 'term.academicYear'])
            ->orderBy('issued_on')
            ->get();
        $invoice = $invoices->firstWhere('id', (string) $request->query('invoice', ''))
            ?? $invoices->first(fn (Invoice $candidate) => $candidate->term?->academic_year_id === $year?->id)
            ?? $invoices->last();
        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)->where('academic_year_id', $year->id)->with('schoolClass.level')->first()
            : null;
        $ledger = $invoice?->syncStatus()->ledger();
        $open = collect($ledger['installments'] ?? [])->first(fn (array $row) => $row['state'] !== 'paid');
        $main = $target->guardians->firstWhere('is_main', true);

        return Inertia::render('students/fees', [
            'currency' => $school->currency,
            'canManageFees' => $role->managesFees(),
            'canManageStudents' => $role->managesStudents(),
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'matricule' => $target->admission_no,
                'class' => $enrolment?->schoolClass?->name,
                'level' => $enrolment?->schoolClass?->level?->name,
                'admitted_year' => $target->admitted_on->format('Y'),
                'contact' => $main ? $main->name : $target->guardian_name,
            ],
            'invoices' => $invoices->map(fn (Invoice $option) => [
                'id' => $option->id,
                'year' => $option->term?->academicYear?->label,
                'balance' => $option->ledger()['balance'],
            ]),
            'invoice' => $invoice && $ledger ? [
                'id' => $invoice->id,
                'year' => $invoice->term?->academicYear?->label,
                ...$ledger,
                'exemption' => $this->exemptionOf($invoice),
                'next' => $open ? [
                    'amount' => $open['amount'] - $open['paid'],
                    'label' => $open['label'],
                    'late' => $open['state'] === 'overdue',
                ] : null,
                'payments' => $invoice->payments->sortBy('received_at')->values()->map(fn (Payment $payment) => [
                    'id' => $payment->id,
                    'on' => $payment->received_at->toDateString(),
                    'method' => $payment->method->label(),
                    'by' => $payment->receiver ? mb_strtolower($payment->receiver->role->label()) : null,
                    'amount' => (float) $payment->amount,
                    'receipt' => $payment->receipt_no,
                ]),
            ] : null,
        ]);
    }

    /**
     * Grant or replace the exemption on an invoice. It can never take
     * the bill below what has already been paid.
     */
    public function exempt(ExemptInvoiceRequest $request, string $invoice): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = $this->findInvoice($school, $invoice);

        $data = $request->validated();

        $gross = (float) $target->amount_due;
        $paid = (float) $target->payments->sum(fn (Payment $payment) => (float) $payment->amount);
        $percent = $data['kind'] === 'percent' ? (float) $data['value'] : null;

        if ($percent !== null && $percent > 100) {
            throw ValidationException::withMessages(['value' => 'A discount cannot be more than 100%.']);
        }

        $amount = $percent !== null ? round($gross * $percent / 100) : (float) $data['value'];

        if ($amount > $gross - $paid) {
            throw ValidationException::withMessages([
                'value' => $paid > 0
                    ? number_format($paid).' is already paid, so at most '.number_format($gross - $paid).' can be taken off.'
                    : 'That is more than the '.number_format($gross).' billed.',
            ]);
        }

        DB::transaction(function () use ($request, $school, $target, $data, $percent, $amount) {
            $exemption = FeeExemption::updateOrCreate(['invoice_id' => $target->id], [
                'kind' => $data['kind'],
                'percent' => $percent,
                'amount' => number_format($amount, 2, '.', ''),
                'reason' => trim($data['reason']),
                'granted_by' => $request->user()?->id,
            ]);

            $target->unsetRelation('exemption')->syncStatus();
            $this->audit($request, $school, 'invoice', $target->id, 'exemption_granted', $exemption->only(['kind', 'percent', 'amount', 'reason']));
        });

        return back();
    }

    public function removeExemption(Request $request, string $invoice): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = $this->findInvoice($school, $invoice);
        $exemption = $target->exemption;

        if ($exemption) {
            DB::transaction(function () use ($request, $school, $target, $exemption) {
                $exemption->delete();
                $target->unsetRelation('exemption')->syncStatus();
                $this->audit($request, $school, 'invoice', $target->id, 'exemption_removed', $exemption->only(['kind', 'percent', 'amount', 'reason']));
            });
        }

        return back();
    }

    /**
     * @return array{kind: string, percent: float|null, amount: float, reason: string, by: string|null, on: string}|null
     */
    protected function exemptionOf(Invoice $invoice): ?array
    {
        $exemption = $invoice->exemption;

        return $exemption ? [
            'kind' => $exemption->kind,
            'percent' => $exemption->percent !== null ? (float) $exemption->percent : null,
            'amount' => (float) $exemption->amount,
            'reason' => $exemption->reason,
            'by' => $exemption->granter?->full_name,
            'on' => $exemption->created_at->toDateString(),
        ] : null;
    }

    protected function findInvoice(School $school, string $id): Invoice
    {
        return Invoice::whereKey($id)
            ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with(['installments', 'payments', 'exemption'])
            ->firstOrFail();
    }

    /**
     * A year's enrolments with each student's invoices for that year.
     *
     * @return list<Enrolment>
     */
    protected function enrolled(School $school, AcademicYear $year): array
    {
        $terms = Term::where('academic_year_id', $year->id)->pluck('id');

        return array_values(Enrolment::where('academic_year_id', $year->id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with([
                'schoolClass:id,name,level_id',
                'student' => fn ($query) => $query->with([
                    'invoices' => fn ($invoices) => $invoices->whereIn('term_id', $terms)->with(['installments', 'payments', 'exemption']),
                ]),
            ])
            ->get()
            ->all());
    }

    /**
     * The term a year's invoices are issued against: the active term
     * when it belongs to the year, else the year's first term.
     */
    protected function billingTerm(School $school, AcademicYear $year): ?Term
    {
        $current = StudentController::currentTerm($school);

        return $current && $current->academic_year_id === $year->id
            ? $current
            : Term::where('academic_year_id', $year->id)->orderBy('sequence')->first();
    }

    protected function findStudent(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
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
