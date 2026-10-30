<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Concerns\BuildsFeeReceipt;
use App\Http\Controllers\Concerns\ListsTables;
use App\Http\Requests\Fees\BillFeesRequest;
use App\Http\Requests\Fees\ExemptInvoiceRequest;
use App\Http\Requests\Fees\RecordPaymentRequest;
use App\Http\Requests\Fees\UpdateFeeStructureRequest;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeeExemption;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeeItem;
use App\Models\FeeItemAmount;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Money;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Fees: what each level costs in a year, who has been billed, what
 * each student has paid, and the receipts for it.
 *
 * @phpstan-type LedgerRow array{id: string, name: string, matricule: string, class: string|null, class_id: string|null, level_id: string|null, due: int, paid: int, balance: int, overdue: int, state: string}
 */
class FeeController extends Controller
{
    use BuildsFeeReceipt, ListsTables;

    /**
     * Where a student's fees stand, and how the list names it.
     */
    protected const array STATES = [
        'overdue' => 'Overdue',
        'owing' => 'Owing, not late',
        'paid' => 'Paid',
        'unbilled' => 'Not billed',
    ];

    /**
     * Everyone enrolled this year with what they were billed and paid.
     */
    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $rows = $this->ledgerRows($school, $year);
        [$listed, $filters] = $this->ledgerList($request, $rows);
        $perPage = $this->perPage($request);
        $lastPage = max(1, (int) ceil($listed->count() / $perPage));
        $page = min($lastPage, max(1, (int) $request->query('page', 1)));
        $counts = ['all' => $rows->count(), ...$rows->countBy('state')->all()];

        return Inertia::render('fees/index', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'totals' => [
                'billed' => Money::number((int) $rows->sum('due')),
                'collected' => Money::number((int) $rows->sum('paid')),
                'outstanding' => Money::number((int) $rows->sum('balance')),
                'overdue' => Money::number((int) $rows->sum('overdue')),
            ],
            'counts' => [
                'all' => $counts['all'],
                'overdue' => $counts['overdue'] ?? 0,
                'owing' => $counts['owing'] ?? 0,
                'paid' => $counts['paid'] ?? 0,
                'unbilled' => $counts['unbilled'] ?? 0,
            ],
            'filters' => $filters,
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'classes' => $rows->whereNotNull('class_id')->unique('class_id')->sortBy('class')
                ->map(fn (array $row) => ['id' => $row['class_id'], 'name' => $row['class'], 'level_id' => $row['level_id']])
                ->values(),
            'students' => [
                'rows' => $listed->forPage($page, $perPage)->map(fn (array $row) => [...$row, 'due' => Money::number($row['due']), 'paid' => Money::number($row['paid']), 'balance' => Money::number($row['balance']), 'overdue' => Money::number($row['overdue'])])->values(),
                'page' => $page,
                'lastPage' => $lastPage,
                'total' => $listed->count(),
                'perPage' => $perPage,
                'from' => $listed->isEmpty() ? null : ($page - 1) * $perPage + 1,
                'to' => $listed->isEmpty() ? null : min($page * $perPage, $listed->count()),
            ],
            'hasPlans' => $year !== null && FeePlan::where('school_id', $school->id)->where('academic_year_id', $year->id)->exists(),
        ]);
    }

    /**
     * The fee list as it is filtered on screen, as a CSV file or a list
     * to print. Selected rows narrow it to those students only.
     */
    public function export(Request $request): StreamedResponse|Response
    {
        $school = $this->schoolContext->school();
        [$listed, , $applied] = $this->ledgerList($request, $this->ledgerRows($school, $this->schoolContext->year()));
        $ids = $this->exportIds($request);
        $rows = $listed
            ->filter(fn (array $row) => $ids === [] || in_array($row['id'], $ids, true))
            ->map(fn (array $row) => [...$row, 'due' => Money::number($row['due']), 'paid' => Money::number($row['paid']), 'balance' => Money::number($row['balance']), 'overdue' => Money::number($row['overdue'])])
            ->map(fn (array $row) => [...$row, 'state' => $this->say(static::STATES[$row['state']])])
            ->values();

        return $this->sendExport($request, $school, $this->say('Fees'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Name'),
            'matricule' => $this->say('Matricule'),
            'class' => $this->say('Class'),
            'due' => $this->say('Annual fees'),
            'paid' => $this->say('Paid'),
            'balance' => $this->say('Balance'),
            'overdue' => $this->say('Overdue'),
            'state' => $this->say('Status'),
        ], $rows, $rows->count());
    }

    /**
     * One row per enrolled student, with what was billed, paid and owed.
     *
     * @return SupportCollection<int, LedgerRow>
     */
    protected function ledgerRows(School $school, ?AcademicYear $year): SupportCollection
    {
        return collect($year ? $this->enrolled($school, $year) : [])->map(function (Enrolment $enrolment) {
            $ledgers = ($enrolment->student->invoices ?? new Collection)
                ->map(fn (Invoice $invoice) => $invoice->syncStatus()->ledgerMinor());
            $balance = (int) $ledgers->sum('balance');
            $overdue = (int) $ledgers->sum('overdue');

            return [
                'id' => $enrolment->student_id,
                'name' => (string) $enrolment->student?->full_name,
                'matricule' => (string) $enrolment->student?->admission_no,
                'class' => $enrolment->schoolClass?->name,
                'class_id' => $enrolment->schoolClass?->id,
                'level_id' => $enrolment->level_id ?? $enrolment->schoolClass?->level_id,
                'due' => (int) $ledgers->sum('due'),
                'paid' => (int) $ledgers->sum('paid'),
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
    }

    /**
     * The rows with the filters, search and sort from the page address
     * applied, the filters as the page shows them, and the same in words.
     *
     * @param  SupportCollection<int, LedgerRow>  $rows
     * @return array{0: SupportCollection<int, LedgerRow>, 1: array<string, mixed>, 2: list<string>}
     */
    protected function ledgerList(Request $request, SupportCollection $rows): array
    {
        $search = trim((string) $request->query('q', ''));
        $needle = mb_strtolower($search);
        $states = $this->many($request, 'state', array_keys(static::STATES));
        $levelId = (string) $request->query('level', '');
        $classes = $this->many($request, 'class');
        [$sort, $direction] = $this->sorting($request, ['owed', 'name', 'class', 'balance'], 'owed');
        $descending = $direction === 'desc';

        $listed = $rows
            ->filter(fn (array $row) => ($states === [] || in_array($row['state'], $states, true))
                && ($levelId === '' || $row['level_id'] === $levelId)
                && ($classes === [] || in_array($row['class_id'], $classes, true))
                && ($needle === ''
                    || str_contains(mb_strtolower($row['name']), $needle)
                    || str_contains(mb_strtolower($row['matricule']), $needle)))
            ->sortBy(match ($sort) {
                'name' => [['name', $direction]],
                'class' => [['class', $direction], ['name', 'asc']],
                'balance' => [['balance', $direction], ['name', 'asc']],
                default => [['overdue', $descending ? 'asc' : 'desc'], ['balance', $descending ? 'asc' : 'desc'], ['name', 'asc']],
            })
            ->values();

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $states !== [] ? $this->say('Status: :value', ['value' => implode(', ', array_map(fn (string $state) => $this->say(static::STATES[$state]), $states))]) : null,
            $levelId !== '' ? $this->say('Level: :value', ['value' => Level::whereKey($levelId)->value('name')]) : null,
            $classes !== [] ? $this->say('Class: :value', ['value' => $rows->whereIn('class_id', $classes)->pluck('class')->unique()->sort()->join(', ')]) : null,
        ]));

        return [$listed, [
            'q' => $search,
            'state' => $states,
            'level' => $levelId,
            'class' => $classes,
            'sort' => ($descending ? '-' : '').$sort,
        ], $applied];
    }

    /**
     * What each level costs for a year, and who still has to be billed.
     */
    public function structure(Request $request): Response
    {
        $school = $this->schoolContext->school();
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
        $students = $this->enrolled($school, $year);
        $collected = $this->collected($students);
        $enrolled = collect($students)->groupBy(fn (Enrolment $enrolment) => (string) ($enrolment->level_id ?? $enrolment->schoolClass?->level_id));

        return Inertia::render('fees/structure', [
            'currency' => $school->currency,
            'years' => $years->map(fn (AcademicYear $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'current' => $option->status === AcademicYearStatus::Current,
            ]),
            'year' => ['id' => $year->id, 'label' => $year->label, 'current' => $year->status === AcademicYearStatus::Current],
            'previousLabel' => $previous?->label,
            'items' => $this->items($school, $year, $collected),
            'previousItems' => $previous ? $this->items($school, $previous) : [],
            'billingTerm' => $this->billingTerm($school, $year)?->label,
            'installments' => FeeInstallmentTemplate::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->orderBy('seq')
                ->get()
                ->map(fn (FeeInstallmentTemplate $template) => [
                    'seq' => $template->seq,
                    'label' => Invoice::ordinal($template->seq, true),
                    'percent' => (float) $template->percent,
                    'due_on' => $template->due_on?->toDateString(),
                ]),
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get()->map(function (Level $level) use ($plans, $enrolled) {
                $students = $enrolled->get($level->id);
                $billed = $students
                    ? $students->filter(fn (Enrolment $enrolment) => (bool) $enrolment->student?->invoices->isNotEmpty())->count()
                    : 0;

                return [
                    'id' => $level->id,
                    'name' => $level->name,
                    'has_fee' => $plans->has($level->id),
                    'students' => $students ? $students->count() : 0,
                    'billed' => $billed,
                ];
            }),
        ]);
    }

    public function updateStructure(UpdateFeeStructureRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();

        $data = $request->validated();

        $levels = Level::where('school_id', $school->id)->pluck('name', 'id');
        $year = AcademicYear::whereKey($data['year_id'])->firstOrFail();

        if ($year->status === AcademicYearStatus::Closed) {
            throw ValidationException::withMessages(['year_id' => __(':label is closed. Its fees can no longer change.', ['label' => $year->label])]);
        }

        $rows = $this->itemRows($data);
        $charged = collect($rows)->flatMap(fn (array $row) => array_keys(array_filter($row['amounts'], fn ($amount) => Money::units((string) ($amount ?? 0)) > 0)))->unique();
        $stranded = FeePlan::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->whereNotIn('level_id', $charged->all())
            ->whereHas('invoices')
            ->pluck('level_id')
            ->map(fn (string $levelId) => $levels->get($levelId))
            ->filter();

        if ($stranded->isNotEmpty()) {
            throw ValidationException::withMessages([
                'items' => __('Students in :levels are already billed, so the level has to keep at least one fee.', ['levels' => $stranded->join(', ')]),
            ]);
        }

        DB::transaction(function () use ($request, $school, $year, $rows, $levels) {
            $existing = FeeItem::where('school_id', $school->id)->where('academic_year_id', $year->id)->get()->keyBy('id');
            $kept = [];

            foreach ($rows as $position => $row) {
                $item = $existing->get((string) ($row['id'] ?? '')) ?? new FeeItem(['school_id' => $school->id, 'academic_year_id' => $year->id]);
                $item->fill([
                    'name' => trim($row['name']),
                    'position' => $position + 1,
                    'is_spread' => (bool) $row['spread'],
                    'new_students_only' => (bool) $row['new_only'],
                ])->save();
                $kept[] = $item->id;

                foreach ($levels->keys() as $levelId) {
                    $amount = Money::units((string) ($row['amounts'][$levelId] ?? 0));

                    if ($amount > 0) {
                        FeeItemAmount::updateOrCreate(
                            ['fee_item_id' => $item->id, 'level_id' => $levelId],
                            ['amount' => Money::decimal($amount)],
                        );
                    } else {
                        FeeItemAmount::where('fee_item_id', $item->id)->where('level_id', $levelId)->delete();
                    }
                }
            }

            FeeItem::where('school_id', $school->id)->where('academic_year_id', $year->id)->whereNotIn('id', $kept)->delete();
            FeePlan::syncFor($school, $year);

            $this->audit($request, $school, 'academic_year', $year->id, 'fees_set', [
                'items' => array_map(fn (array $row) => [
                    'name' => trim($row['name']),
                    'spread' => (bool) $row['spread'],
                    'new_only' => (bool) $row['new_only'],
                    'amounts' => array_filter($row['amounts'], fn ($amount) => Money::units((string) ($amount ?? 0)) > 0),
                ], $rows),
            ]);
        });

        $this->notify('Fees saved.');

        return back();
    }

    /**
     * Issue the year's invoice to every enrolled student who has none,
     * in the levels that have a fee.
     */
    public function bill(BillFeesRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();

        $data = $request->validated();

        $year = AcademicYear::whereKey($data['year_id'])->firstOrFail();
        $term = $this->billingTerm($school, $year);

        if (! $term) {
            throw ValidationException::withMessages([
                'bill' => __(':label has no term to bill against. Add its terms in School Setup first.', ['label' => $year->label]),
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

                $plan->billTo($student, $term);
                $billed++;
            }

            $this->audit($request, $school, 'academic_year', $year->id, 'students_billed', [
                'students' => $billed,
                'level_id' => $data['level_id'] ?? null,
            ]);
        });

        $this->notify('Billing done.');

        return back();
    }

    /**
     * One student's ledger: installments, payments and what is owed.
     */
    public function student(Request $request, string $student): Response
    {
        $school = $this->schoolContext->school();
        $target = $this->findStudent($school, $student);
        $year = $this->schoolContext->year();
        $invoices = Invoice::where('student_id', $target->id)
            ->with(['installments', 'lines', 'exemption.granter:id,full_name', 'payments.receiver:id,full_name', 'term.academicYear'])
            ->orderBy('issued_on')
            ->get();
        $invoice = $invoices->firstWhere('id', (string) $request->query('invoice', ''))
            ?? $invoices->first(fn (Invoice $candidate) => $candidate->syncStatus()->ledgerMinor()['balance'] > 0)
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
                    'amount' => Money::number(Money::units($payment->amount)),
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
        $school = $this->schoolContext->school();
        $target = $this->findStudent($school, $student);

        $data = $request->validated();

        $invoice = Invoice::whereKey($data['invoice_id'])->with(['installments', 'lines', 'payments', 'exemption'])->firstOrFail();
        $balance = $invoice->ledgerMinor()['balance'];

        if (Money::units((string) $data['amount']) > $balance) {
            throw ValidationException::withMessages([
                'amount' => $balance > 0
                    ? __('That is more than the :amount still owed.', ['amount' => number_format(Money::number($balance), 2)])
                    : __('This invoice is already paid in full.'),
            ]);
        }

        $payment = DB::transaction(function () use ($request, $school, $invoice, $data) {
            $payment = $invoice->recordPayment(
                Money::decimal(Money::units((string) $data['amount'])),
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

        $this->notify('Payment recorded.');

        return redirect()->route('fees.receipt', $payment->id);
    }

    public function receipt(Request $request, string $payment): Response
    {
        $school = $this->schoolContext->school();
        $target = Payment::whereKey($payment)
            ->whereHas('invoice.student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with(['invoice.installments', 'invoice.lines', 'invoice.exemption', 'invoice.payments', 'invoice.student', 'invoice.term.academicYear', 'receiver:id,full_name'])
            ->firstOrFail();

        return Inertia::render('fees/receipt', $this->feeReceipt($school, $target));
    }

    public function verifyReceipt(string $payment): Response
    {
        $target = Payment::whereKey($payment)->with('invoice.student')->firstOrFail();
        $school = School::whereKey($target->invoice?->student?->school_id)->first();
        abort_unless($school instanceof School, 404);

        return Inertia::render('fees/receipt-verify', [
            'issuer' => $school->name,
            'receipt' => [
                'number' => $target->receipt_no,
                'amount' => Money::number(Money::units($target->amount)),
                'currency' => $school->currency,
                'on' => $target->received_at->copy()->timezone($school->timezone)->toDateString(),
                'reference' => $target->reference,
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
        $school = $this->schoolContext->school();
        $user = $request->user();

        Gate::authorize('read-student-fees');

        $target = $this->findStudent($school, $student)->load('guardians');
        $year = $this->schoolContext->year();
        $invoices = Invoice::where('student_id', $target->id)
            ->with(['installments', 'lines', 'exemption.granter:id,full_name', 'payments.receiver:id,full_name,role', 'term.academicYear'])
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
            'neighbours' => Student::neighbours($school, $target, $this->schoolContext->year()),
            'currency' => $school->currency,
            'canManageFees' => (bool) $user?->can('manage-fees'),
            'canManageStudents' => (bool) $user?->can('manage-students'),
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
                    'amount' => Money::number(Money::units($payment->amount)),
                    'receipt' => $payment->receipt_no,
                ]),
            ] : null,
        ]);
    }

    /**
     * Grant or replace the exemption on an invoice. It can never take
     * the bill below what has already been paid. Percentage discounts
     * retain whole-currency-unit rounding.
     */
    public function exempt(ExemptInvoiceRequest $request, string $invoice): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->findInvoice($school, $invoice);

        $data = $request->validated();

        $gross = Money::units($target->amount_due);
        $paid = Money::sum($target->payments->pluck('amount'));
        $percentBasisPoints = $data['kind'] === 'percent' ? Money::units((string) $data['value']) : null;

        if ($percentBasisPoints !== null && $percentBasisPoints > 10_000) {
            throw ValidationException::withMessages(['value' => __('A discount cannot be more than 100%.')]);
        }

        $amount = match ($percentBasisPoints) {
            null => Money::units((string) $data['value']),
            10_000 => $gross,
            default => min($gross, Money::ratio($gross, $percentBasisPoints, 1_000_000) * 100),
        };

        if ($amount > $gross - $paid) {
            throw ValidationException::withMessages([
                'value' => $paid > 0
                    ? __(':paid is already paid, so at most :room can be taken off.', ['paid' => number_format(Money::number($paid), 2), 'room' => number_format(Money::number($gross - $paid), 2)])
                    : __('That is more than the :amount billed.', ['amount' => number_format(Money::number($gross), 2)]),
            ]);
        }

        DB::transaction(function () use ($request, $school, $target, $data, $percentBasisPoints, $amount) {
            $exemption = FeeExemption::updateOrCreate(['invoice_id' => $target->id], [
                'kind' => $data['kind'],
                'percent' => $percentBasisPoints !== null ? Money::decimal($percentBasisPoints) : null,
                'amount' => Money::decimal($amount),
                'reason' => trim($data['reason']),
                'granted_by' => $request->user()?->id,
            ]);

            $target->unsetRelation('exemption')->syncStatus();
            $this->audit($request, $school, 'invoice', $target->id, 'exemption_granted', $exemption->only(['kind', 'percent', 'amount', 'reason']));
        });

        $this->notify('Exemption saved.');

        return back();
    }

    public function removeExemption(Request $request, string $invoice): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->findInvoice($school, $invoice);
        $exemption = $target->exemption;

        if ($exemption) {
            DB::transaction(function () use ($request, $school, $target, $exemption) {
                $exemption->delete();
                $target->unsetRelation('exemption')->syncStatus();
                $this->audit($request, $school, 'invoice', $target->id, 'exemption_removed', $exemption->only(['kind', 'percent', 'amount', 'reason']));
            });
        }

        $this->notify('Exemption removed.');

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
            'amount' => Money::number(Money::units($exemption->amount)),
            'reason' => $exemption->reason,
            'by' => $exemption->granter?->full_name,
            'on' => $exemption->created_at->toDateString(),
        ] : null;
    }

    protected function findInvoice(School $school, string $id): Invoice
    {
        return Invoice::whereKey($id)
            ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with(['installments', 'lines', 'payments', 'exemption'])
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
                    'invoices' => fn ($invoices) => $invoices->whereIn('term_id', $terms)->with(['installments', 'lines', 'payments', 'exemption']),
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
        $current = $this->schoolContext->term();

        return $current && $current->academic_year_id === $year->id
            ? $current
            : Term::where('academic_year_id', $year->id)->orderBy('sequence')->first();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{id?: string|null, name: string, spread: bool, new_only: bool, amounts: array<string, float|int|string|null>}>
     */
    protected function itemRows(array $data): array
    {
        return array_values($data['items']);
    }

    /**
     * A year's fee items in the order money is shared out, each with
     * its amount per level and, when asked, what it has brought in.
     *
     * @param  array<string, array{billed: int, collected: int}>|null  $collected
     * @return list<array<string, mixed>>
     */
    protected function items(School $school, AcademicYear $year, ?array $collected = null): array
    {
        return array_values(FeeItem::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->orderBy('position')
            ->with('amounts')
            ->get()
            ->map(fn (FeeItem $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'spread' => $item->is_spread,
                'new_only' => $item->new_students_only,
                'amounts' => $item->amounts->mapWithKeys(fn (FeeItemAmount $amount) => [$amount->level_id => Money::number(Money::units($amount->amount))])->all(),
                'billed' => Money::number($collected[$item->name]['billed'] ?? 0),
                'collected' => Money::number($collected[$item->name]['collected'] ?? 0),
            ])
            ->all());
    }

    /**
     * What each item on the year's invoices was billed and has
     * received, by item name.
     *
     * @param  list<Enrolment>  $enrolments
     * @return array<string, array{billed: int, collected: int}>
     */
    protected function collected(array $enrolments): array
    {
        $totals = [];

        foreach ($enrolments as $enrolment) {
            foreach ($enrolment->student->invoices ?? [] as $invoice) {
                foreach ($invoice->ledgerMinor()['items'] as $item) {
                    $totals[$item['name']] ??= ['billed' => 0, 'collected' => 0];
                    $totals[$item['name']]['billed'] += $item['amount'];
                    $totals[$item['name']]['collected'] += $item['paid'];
                }
            }
        }

        return $totals;
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
