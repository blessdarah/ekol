<?php

namespace App\Actions;

use App\Models\AuditEvent;
use App\Models\School;
use App\Models\Series;
use App\Models\StudentSeries;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Moves a student already registered for the term into another series of
 * the same level. Initial registration stays in RegisterStudentsForSeries.
 */
class ChangeStudentSeries
{
    public const array REASONS = ["Student's request", "Parent's request", 'Teacher advice', 'Placed in the wrong series', 'Other'];

    /**
     * @param  array{reason: string, note?: string|null, parent_agreed: bool}  $change
     */
    public function handle(School $school, ?User $actor, Term $term, StudentSeries $registration, Series $destination, array $change): StudentSeries
    {
        $registration->loadMissing(['student', 'series.subjects:id', 'electives:id']);
        $destination->loadMissing('subjects:id');
        $current = $registration->series;

        if ($term->school_id !== $school->id
            || $registration->term_id !== $term->id
            || $registration->student?->school_id !== $school->id
            || $current?->school_id !== $school->id
            || $destination->school_id !== $school->id) {
            throw ValidationException::withMessages(['series_id' => __('The registration must belong to the same school.')]);
        }

        if ($destination->level_id !== $current->level_id) {
            throw ValidationException::withMessages(['series_id' => __('The new series must be in the student’s current level.')]);
        }

        if ($destination->id === $current->id) {
            throw ValidationException::withMessages(['series_id' => __('The student is already in that series.')]);
        }

        if ($destination->subjects->where('pivot.kind', 'core')->isEmpty()) {
            throw ValidationException::withMessages([
                'series_id' => __(':name has no core subjects yet, so nobody can be moved into it.', ['name' => $destination->name]),
            ]);
        }

        if (! in_array($change['reason'], self::REASONS, true)) {
            throw ValidationException::withMessages(['reason' => __('Choose a reason for the series change.')]);
        }

        if ($change['parent_agreed'] !== true) {
            throw ValidationException::withMessages(['parent_agreed' => __('A parent or guardian must agree before the series changes.')]);
        }

        $note = $change['note'] ?? null;

        // Everything the student took and the new pool still offers is kept.
        $taken = [
            ...$registration->electives->modelKeys(),
            ...array_values($current->subjects->where('pivot.kind', 'core')->modelKeys()),
        ];
        $kept = array_values(array_intersect($taken, array_values($destination->subjects->where('pivot.kind', 'elective')->modelKeys())));

        DB::transaction(function () use ($school, $actor, $registration, $current, $destination, $kept, $change, $note) {
            $registration->update([
                'series_id' => $destination->id,
                'chosen_by' => $actor?->id,
                'chosen_at' => now(),
                'change_reason' => $change['reason'],
                'change_note' => $note,
                'parent_agreed' => true,
            ]);
            $registration->electives()->sync($kept);

            AuditEvent::record($school, $actor, 'student', $registration->student_id, 'series_changed', [
                'from' => $current->code,
                'to' => $destination->code,
                'reason' => $change['reason'],
                'note' => $note,
            ]);
        });

        return $registration->unsetRelation('series')->unsetRelation('electives');
    }
}
