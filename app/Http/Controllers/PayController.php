<?php

namespace App\Http\Controllers;

use App\Http\Requests\Pay\ChooseAmountRequest;
use App\Http\Requests\Pay\RequestMobilePaymentRequest;
use App\Models\Invoice;
use App\Models\MobilePayment;
use App\Models\Student;
use BlessDarah\PhpCampay\Campay;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A parent paying their child's school fees by mobile money, from the
 * parent services: choose the amount, then approve the operator's
 * prompt on the phone.
 */
class PayController extends Controller
{
    /**
     * How often, at most, a parent's status page asks Campay again.
     */
    protected const int CHECK_EVERY_SECONDS = 4;

    public function amount(Request $request): Response|RedirectResponse
    {
        [$school, $student] = ParentController::child($request);

        if (! $school || ! $student) {
            return redirect()->route('parents');
        }

        if ($waiting = $this->waitingFor($student)) {
            return redirect()->route('parents.pay.status', $waiting->id);
        }

        $ledger = ParentController::openInvoice($student)?->ledger();
        $next = collect($ledger['installments'] ?? [])->first(fn (array $row) => $row['state'] !== 'paid');
        $options = [];

        if ($ledger && $ledger['overdue'] > 0) {
            $options[] = ['key' => 'overdue', 'amount' => (int) round($ledger['overdue']), 'label' => __('What is overdue'), 'detail' => $next ? __(':installment, due :date', ['installment' => $next['label'], 'date' => $this->day($next['due_on'])]) : null, 'late' => true];
        } elseif ($next) {
            $options[] = ['key' => 'next', 'amount' => (int) round($next['amount'] - $next['paid']), 'label' => __('The next installment'), 'detail' => __(':installment, due :date', ['installment' => $next['label'], 'date' => $this->day($next['due_on'])]), 'late' => false];
        }

        if ($ledger && $ledger['balance'] > 0 && (! $options || $options[0]['amount'] < (int) round($ledger['balance']))) {
            $options[] = ['key' => 'all', 'amount' => (int) round($ledger['balance']), 'label' => __('Everything left'), 'detail' => __('The whole balance for the year'), 'late' => false];
        }

        return Inertia::render('pay/amount', [
            'issuer' => ParentController::issuer($school),
            'student' => ParentController::studentCard($student),
            'balance' => $ledger ? (int) round($ledger['balance']) : 0,
            'overdue' => $ledger ? (int) round($ledger['overdue']) : 0,
            'options' => $options,
            'chosen' => $request->session()->get('parent.amount'),
        ]);
    }

    public function chooseAmount(ChooseAmountRequest $request): RedirectResponse
    {
        [, $student] = ParentController::child($request);
        $invoice = $student ? ParentController::openInvoice($student) : null;

        if (! $invoice) {
            return redirect()->route($student ? 'parents.pay' : 'parents');
        }

        $amount = (int) $request->validated('amount');
        $balance = (int) round($invoice->ledger()['balance']);

        if ($amount > $balance) {
            throw ValidationException::withMessages(['amount' => __('That is more than the :amount still owed.', ['amount' => number_format($balance)])]);
        }

        $request->session()->put('parent.amount', $amount);

        return redirect()->route('parents.pay.phone');
    }

    public function phone(Request $request): Response|RedirectResponse
    {
        [$school, $student] = ParentController::child($request);
        $amount = (int) $request->session()->get('parent.amount', 0);

        if (! $school || ! $student) {
            return redirect()->route('parents');
        }

        if ($amount < 1 || ! ParentController::openInvoice($student)) {
            return redirect()->route('parents.pay');
        }

        return Inertia::render('pay/phone', [
            'issuer' => ParentController::issuer($school),
            'student' => ParentController::studentCard($student),
            'amount' => $amount,
            'phone' => (string) $request->session()->get('parent.phone', ''),
        ]);
    }

    /**
     * Send the payment prompt to the phone chosen.
     */
    public function store(RequestMobilePaymentRequest $request, Campay $campay): RedirectResponse
    {
        [, $student] = ParentController::child($request);
        $invoice = $student ? ParentController::openInvoice($student) : null;
        $amount = (int) $request->session()->get('parent.amount', 0);

        if (! $student) {
            return redirect()->route('parents');
        }

        if ($waiting = $this->waitingFor($student)) {
            return redirect()->route('parents.pay.status', $waiting->id);
        }

        $amount = $invoice ? min($amount, (int) round($invoice->ledger()['balance'])) : 0;

        if (! $invoice || $amount < 1) {
            return redirect()->route('parents.pay');
        }

        $payment = MobilePayment::start($invoice, $student, $amount, $request->validated('phone'), $campay);
        $request->session()->forget('parent.amount');

        return redirect()->route('parents.pay.status', $payment->id);
    }

    /**
     * Where a request stands. A pending one is checked with Campay, so
     * the page moves on by itself while it polls.
     */
    public function status(Request $request, string $payment, Campay $campay): Response|RedirectResponse
    {
        [$school, $student] = ParentController::child($request);

        if (! $school || ! $student) {
            return redirect()->route('parents');
        }

        $target = MobilePayment::where('student_id', $student->id)->whereKey($payment)->with('payment')->firstOrFail();

        if ($target->status === MobilePayment::PENDING
            && ($target->checked_at === null || $target->checked_at->lt(now()->subSeconds(static::CHECK_EVERY_SECONDS)))) {
            $target->refreshStatus($campay);
        }

        $invoice = Invoice::whereKey($target->invoice_id)->with(['installments', 'lines', 'payments', 'exemption'])->first();
        $ledger = $invoice?->ledger();
        $next = collect($ledger['installments'] ?? [])->first(fn (array $row) => $row['state'] !== 'paid');
        $state = match (true) {
            $target->status === MobilePayment::SUCCESSFUL => 'paid',
            $target->status === MobilePayment::FAILED => 'failed',
            $target->awaitingApproval() => 'waiting',
            default => 'late',
        };

        return Inertia::render('pay/status', [
            'issuer' => ParentController::issuer($school),
            'payment' => [
                'id' => $target->id,
                'state' => $state,
                'amount' => (int) round((float) $target->amount),
                'phone' => $target->phone,
                'operator' => $target->operator,
                'reason' => $target->failure_reason,
                'seconds_left' => max(0, MobilePayment::APPROVAL_SECONDS - (int) $target->created_at->diffInSeconds(now())),
                'paid_at' => $target->settled_at?->toIso8601String(),
                'receipt' => $target->payment?->receipt_no,
                'went_to' => $target->payment && $invoice ? $invoice->split($target->payment) : [],
            ],
            'student' => ParentController::studentCard($student),
            'balance' => $ledger ? (int) round($ledger['balance']) : 0,
            'next' => $next ? ['label' => $next['label'], 'due_on' => $next['due_on']] : null,
        ]);
    }

    /**
     * Send the same request again, after one that did not go through.
     */
    public function retry(Request $request, string $payment, Campay $campay): RedirectResponse
    {
        [, $student] = ParentController::child($request);

        if (! $student) {
            return redirect()->route('parents');
        }

        $target = MobilePayment::where('student_id', $student->id)->whereKey($payment)->firstOrFail();
        $invoice = ParentController::openInvoice($student);

        if ($target->status !== MobilePayment::FAILED || ! $invoice) {
            return redirect()->route('parents.pay.status', $target->id);
        }

        if ($waiting = $this->waitingFor($student)) {
            return redirect()->route('parents.pay.status', $waiting->id);
        }

        $amount = min((int) round((float) $target->amount), (int) round($invoice->ledger()['balance']));

        if ($amount < 1) {
            return redirect()->route('parents.pay.status', $target->id);
        }

        return redirect()->route('parents.pay.status', MobilePayment::start($invoice, $student, $amount, $target->phone, $campay)->id);
    }

    protected function waitingFor(Student $student): ?MobilePayment
    {
        return MobilePayment::where('student_id', $student->id)
            ->where('status', MobilePayment::PENDING)
            ->where('created_at', '>=', now()->subMinutes(MobilePayment::GIVE_UP_MINUTES))
            ->latest()
            ->first();
    }

    protected function day(string $iso): string
    {
        return Carbon::parse($iso)->translatedFormat('j M');
    }
}
