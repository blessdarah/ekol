<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Enrolment;
use App\Models\MobilePayment;
use App\Models\Payment;
use App\Models\School;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Number;

trait BuildsFeeReceipt
{
    /**
     * Both copies use the payment's own year and exclude later payments.
     *
     * @return array{
     *     issuer: array{name: string, code: string, town: string|null, motto: string|null, logo_url: string|null},
     *     currency: string,
     *     receipt: array{
     *         kind: 'digital'|'counter',
     *         number: string|null, on: string, time: string, amount: float, words: string,
     *         method: string, reference: string|null, paid_from: string|null, by: string|null,
     *         year: string|null, balance: float, due: float, paid: float, can_pay: bool,
     *         state: 'paid'|'partial', next: array{amount: float, due_on: string}|null,
     *         covers: list<array{name: string, amount: float}>,
     *         history: list<array{number: string|null, on: string, amount: float, method: string, current: bool}>,
     *         verification_url: string, qr: string
     *     },
     *     student: array{id: string|null, name: string|null, matricule: string|null, class: string|null}
     * }
     */
    protected function feeReceipt(School $school, Payment $payment): array
    {
        $payment->loadMissing(['invoice.installments', 'invoice.lines', 'invoice.exemption', 'invoice.payments', 'invoice.student', 'invoice.term.academicYear', 'receiver:id,full_name']);
        $invoice = clone $payment->invoice;
        $history = $invoice->payments
            ->filter(fn (Payment $other) => [$other->received_at, $other->receipt_no] <= [$payment->received_at, $payment->receipt_no])
            ->sortBy([['received_at', 'asc'], ['receipt_no', 'asc']])->values();
        $invoice->setRelation('payments', $history);
        $ledger = $invoice->ledger();
        $next = collect($ledger['installments'])->first(fn (array $row) => $row['state'] !== 'paid');
        $student = $invoice->student;
        $year = $invoice->term?->academicYear;
        $mobile = MobilePayment::where('payment_id', $payment->id)->where('status', MobilePayment::SUCCESSFUL)->first();
        $on = $payment->received_at->copy()->timezone($school->timezone);
        $verificationUrl = URL::signedRoute('receipts.verify', ['payment' => $payment->id]);
        $qr = (new Writer(new ImageRenderer(new RendererStyle(256, 4), new SvgImageBackEnd)))->writeString($verificationUrl);

        return [
            'issuer' => [
                'name' => $school->name, 'code' => $school->code, 'town' => $school->town,
                'motto' => $school->motto, 'logo_url' => $school->logo_path ? "/storage/{$school->logo_path}" : null,
            ],
            'currency' => $school->currency,
            'receipt' => [
                'kind' => $mobile ? 'digital' : 'counter',
                'number' => $payment->receipt_no,
                'on' => $on->toDateString(),
                'time' => $on->format('H:i'),
                'amount' => (float) $payment->amount,
                'words' => ucfirst((string) Number::spell((float) $payment->amount, app()->getLocale())).' '.($school->currency === 'XAF' ? __('CFA francs') : $school->currency),
                'method' => $mobile?->operator ? $mobile->operator.' Mobile Money' : $payment->method->label(),
                'reference' => $payment->reference,
                'paid_from' => $mobile?->phone,
                'by' => $payment->receiver?->full_name,
                'year' => $year?->label,
                'balance' => $ledger['balance'],
                'due' => $ledger['due'],
                'paid' => $ledger['paid'],
                'can_pay' => $payment->invoice->ledger()['balance'] > 0,
                'state' => $ledger['balance'] <= 0 ? 'paid' : 'partial',
                'next' => $next ? ['amount' => round($next['amount'] - $next['paid'], 2), 'due_on' => $next['due_on']] : null,
                'covers' => $invoice->split($payment),
                'history' => array_values($history->map(fn (Payment $entry) => [
                    'number' => $entry->receipt_no, 'on' => $entry->received_at->copy()->timezone($school->timezone)->toDateString(),
                    'amount' => (float) $entry->amount, 'method' => $entry->method->label(), 'current' => $entry->id === $payment->id,
                ])->all()),
                'verification_url' => $verificationUrl,
                'qr' => 'data:image/svg+xml;base64,'.base64_encode($qr),
            ],
            'student' => [
                'id' => $student?->id, 'name' => $student?->full_name, 'matricule' => $student?->admission_no,
                'class' => $student && $year
                    ? Enrolment::where('student_id', $student->id)->where('academic_year_id', $year->id)->with('schoolClass:id,name')->first()?->schoolClass?->name
                    : null,
            ],
        ];
    }
}
