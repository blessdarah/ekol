<?php

namespace App\Http\Controllers;

use App\Actions\Fees\RecordFeePayment;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Concerns\BuildsFeeReceipt;
use App\Http\Requests\Fees\RecordPaymentRequest;
use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Money;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FeePaymentController extends Controller
{
    use BuildsFeeReceipt;

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

    public function pay(RecordPaymentRequest $request, string $student, RecordFeePayment $record): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->findStudent($school, $student);

        $data = $request->validated();

        $invoice = Invoice::whereKey($data['invoice_id'])->with(['installments', 'lines', 'payments', 'exemption'])->firstOrFail();
        $payment = $record->handle($school, $target, $invoice, $request->user(), $data);
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

    protected function findStudent(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
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
}
