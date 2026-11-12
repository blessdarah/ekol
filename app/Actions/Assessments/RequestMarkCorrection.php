<?php

namespace App\Actions\Assessments;

use App\Enums\AssessmentState;
use App\Models\AuditEvent;
use App\Models\Mark;
use App\Models\MarkCorrection;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Ask for a published mark to be changed. The mark itself stays as it
 * is until the principal approves.
 */
class RequestMarkCorrection
{
    /** @param array<string, mixed> $data */
    public function handle(School $school, Mark $mark, ?User $actor, array $data): MarkCorrection
    {
        if ($actor !== null && $actor->school_id !== null && $actor->school_id !== $school->id) {
            throw new InvalidArgumentException('The actor must belong to the school.');
        }

        return DB::transaction(function () use ($school, $mark, $actor, $data): MarkCorrection {
            School::whereKey($school->id)->lockForUpdate()->firstOrFail();
            $target = Mark::whereKey($mark->id)
                ->whereHas('assessmentSubject.assessment', fn ($query) => $query->where('school_id', $school->id))
                ->with('assessmentSubject.assessment.plan')
                ->lockForUpdate()
                ->first();

            if ($target === null || $target->assessmentSubject === null) {
                throw new InvalidArgumentException('The mark must belong to the school.');
            }

            $sheet = $target->assessmentSubject;
            $newScore = (float) $data['new_score'];

            if ($sheet->assessment?->plan?->state !== AssessmentState::Published) {
                throw ValidationException::withMessages(['new_score' => __('A correction is for a published mark. This one can still be edited on its sheet.')]);
            }

            if ($newScore > (float) $sheet->max_score) {
                throw ValidationException::withMessages(['new_score' => __('A mark can\'t be above :max_score.', ['max_score' => (float) $sheet->max_score])]);
            }

            if ($target->score !== null && abs((float) $target->score - $newScore) < 0.001) {
                throw ValidationException::withMessages(['new_score' => __('That is the mark already published.')]);
            }

            if (MarkCorrection::where('school_id', $school->id)->where('mark_id', $target->id)->where('status', 'pending')->exists()) {
                throw ValidationException::withMessages(['new_score' => __('A correction for this mark is already waiting for the principal.')]);
            }

            $correction = MarkCorrection::create([
                'school_id' => $school->id,
                'mark_id' => $target->id,
                'reference' => MarkCorrection::nextReference($school->id),
                'old_score' => $target->score,
                'new_score' => round($newScore, 2),
                'reason' => trim($data['reason']),
                'status' => 'pending',
                'requested_by' => $actor?->id,
            ]);

            AuditEvent::record($school, $actor, 'mark_correction', $correction->id, 'requested', $correction->only(['reference', 'old_score', 'new_score', 'status', 'note']));

            return $correction;
        });
    }
}
