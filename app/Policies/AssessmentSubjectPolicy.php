<?php

namespace App\Policies;

use App\Models\AssessmentSubject;
use App\Models\User;

/**
 * Who may work on a mark sheet: its examiner, and those who manage
 * assessments.
 */
class AssessmentSubjectPolicy
{
    /**
     * Enter marks on the sheet, or ask to correct a published mark.
     */
    public function enterMarks(User $user, AssessmentSubject $sheet): bool
    {
        return $user->can('manage-assessments') || $sheet->examiner_id === $user->id;
    }
}
