<?php

namespace App\Http;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\Money;
use App\Models\Student;
use Illuminate\Support\Collection;

class StudentFeeSummary
{
    /**
     * Fee state across a student's invoices: what is still owed and how
     * the roster should label it.
     *
     * @param  Collection<int, Invoice>  $invoices
     * @return array{status: string|null, balance: float, due: float}
     */
    public static function summarize(Collection $invoices): array
    {
        if ($invoices->isEmpty()) {
            return ['status' => null, 'balance' => 0.0, 'due' => 0.0];
        }

        $due = (int) $invoices->sum(fn (Invoice $invoice) => Money::units($invoice->amount_due) - $invoice->exemptedMinor());
        $paid = Money::sum($invoices->flatMap(fn (Invoice $invoice) => $invoice->payments->pluck('amount')));
        $balance = max(0, $due - $paid);

        $status = match (true) {
            $balance <= 0 => 'paid',
            $invoices->contains(fn (Invoice $invoice) => $invoice->status === InvoiceStatus::Overdue) => 'overdue',
            $paid > 0 => 'partial',
            default => 'due',
        };

        return ['status' => $status, 'balance' => Money::number($balance), 'due' => Money::number($due)];
    }
}
