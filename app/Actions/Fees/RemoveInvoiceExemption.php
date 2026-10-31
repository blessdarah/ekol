<?php

namespace App\Actions\Fees;

use App\Models\AuditEvent;
use App\Models\Invoice;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class RemoveInvoiceExemption
{
    public function handle(School $school, Invoice $target, ?User $actor): void
    {
        if (! $target->student()->where('school_id', $school->id)->exists()) {
            throw new InvalidArgumentException('The invoice must belong to the school.');
        }
        $target->load(['payments', 'exemption']);

        $exemption = $target->exemption;

        if ($exemption) {
            DB::transaction(function () use ($actor, $school, $target, $exemption) {
                $exemption->delete();
                $target->unsetRelation('exemption')->refresh();
                AuditEvent::record($school, $actor, 'invoice', $target->id, 'exemption_removed', $exemption->only(['kind', 'percent', 'amount', 'reason']));
            });
        }
    }
}
