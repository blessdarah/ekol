<?php

namespace App\Actions\Fees;

use App\Models\AuditEvent;
use App\Models\Invoice;
use App\Models\Money;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class RecordFeePayment
{
    /** @param array<string, mixed> $data */
    public function handle(School $school, Student $student, Invoice $invoice, ?User $actor, array $data): Payment
    {
        if ($student->school_id !== $school->id || $invoice->student_id !== $student->id) {
            throw new InvalidArgumentException('The invoice and student must belong to the school.');
        }
        $invoice->load(['installments', 'lines', 'payments', 'exemption']);
        $balance = $invoice->ledgerMinor()['balance'];

        if (Money::units((string) $data['amount']) > $balance) {
            throw ValidationException::withMessages([
                'amount' => $balance > 0
                    ? __('That is more than the :amount still owed.', ['amount' => number_format(Money::number($balance), 2)])
                    : __('This invoice is already paid in full.'),
            ]);
        }

        return DB::transaction(function () use ($actor, $school, $invoice, $data) {
            $payment = $invoice->recordPayment(
                Money::decimal(Money::units((string) $data['amount'])),
                $data['method'],
                $actor,
                null,
                isset($data['reference']) ? trim($data['reference']) : null,
                Carbon::parse($data['date'])->setTimeFrom(now()),
            );

            AuditEvent::record($school, $actor, 'payment', $payment->id, 'recorded', [
                'receipt' => $payment->receipt_no,
                'amount' => $payment->amount,
                'method' => $payment->method->value,
            ]);

            return $payment;
        });
    }
}
