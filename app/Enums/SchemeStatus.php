<?php

namespace App\Enums;

/**
 * Where a scheme of work stands, from opening to the end of the term.
 */
enum SchemeStatus: string
{
    case NotStarted = 'not_started';
    case Draft = 'draft';
    case Submitted = 'submitted';
    case ChangesRequested = 'changes_requested';
    case Approved = 'approved';
    case Closed = 'closed';

    /**
     * Whether the teacher can still place and move topics.
     */
    public function isEditable(): bool
    {
        return in_array($this, [self::NotStarted, self::Draft, self::ChangesRequested], true);
    }

    /**
     * Whether the teacher has handed the scheme in at least once.
     */
    public function isSubmitted(): bool
    {
        return in_array($this, [self::Submitted, self::Approved, self::Closed], true);
    }
}
