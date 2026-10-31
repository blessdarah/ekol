<?php

namespace App\Actions\Fees;

use App\Models\AuditEvent;
use App\Models\FeeExemption;
use App\Models\Invoice;
use App\Models\Money;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class GrantInvoiceExemption
{
    /** @param array<string, mixed> $data */
    public function handle(School $school, Invoice $target, ?User $actor, array $data): void
    {
        if (! $target->student()->where('school_id', $school->id)->exists()) {
            throw new InvalidArgumentException('The invoice must belong to the school.');
        }
        $target->load(['payments', 'exemption']);

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

        DB::transaction(function () use ($actor, $school, $target, $data, $percentBasisPoints, $amount) {
            $exemption = FeeExemption::updateOrCreate(['invoice_id' => $target->id], [
                'kind' => $data['kind'],
                'percent' => $percentBasisPoints !== null ? Money::decimal($percentBasisPoints) : null,
                'amount' => Money::decimal($amount),
                'reason' => trim($data['reason']),
                'granted_by' => $actor?->id,
            ]);

            $target->unsetRelation('exemption')->refresh();

            AuditEvent::record($school, $actor, 'invoice', $target->id, 'exemption_granted', $exemption->only(['kind', 'percent', 'amount', 'reason']));
        });
    }
}
