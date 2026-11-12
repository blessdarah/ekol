<?php

namespace App\Actions\Assessments;

use App\Models\AuditEvent;
use App\Models\Mark;
use App\Models\MarkCorrection;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Approve or decline a pending correction. Approval writes the new
 * score to the mark and clears its absence; a decline leaves it alone.
 */
class DecideMarkCorrection
{
    /** @param array<string, mixed> $data */
    public function handle(School $school, MarkCorrection $correction, ?User $actor, array $data): MarkCorrection
    {
        if ($correction->school_id !== $school->id) {
            throw new InvalidArgumentException('The correction must belong to the school.');
        }

        if ($actor !== null && $actor->school_id !== null && $actor->school_id !== $school->id) {
            throw new InvalidArgumentException('The actor must belong to the school.');
        }

        return DB::transaction(function () use ($school, $correction, $actor, $data): MarkCorrection {
            $target = MarkCorrection::where('school_id', $school->id)->whereKey($correction->id)->lockForUpdate()->firstOrFail();

            if ($target->status !== 'pending') {
                throw ValidationException::withMessages(['decision' => __('This correction has already been decided.')]);
            }

            $approved = $data['decision'] === 'approve';

            $target->update([
                'status' => $approved ? 'approved' : 'declined',
                'decided_by' => $actor?->id,
                'decided_at' => now(),
                'note' => isset($data['note']) ? trim($data['note']) : null,
            ]);

            if ($approved) {
                Mark::whereKey($target->mark_id)->lockForUpdate()->first()
                    ?->update(['score' => $target->new_score, 'is_absent' => false]);
            }

            AuditEvent::record($school, $actor, 'mark_correction', $target->id, $approved ? 'approved' : 'declined', $target->only(['reference', 'old_score', 'new_score', 'status', 'note']));

            return $target;
        });
    }
}
