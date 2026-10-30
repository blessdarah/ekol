<?php

namespace App\Policies;

use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\User;

/**
 * Who may follow and approve a scheme of work. The rules themselves
 * live on the scheme: a principal, academic lead or administrator
 * always; a head of department for their department when heads approve.
 */
class SchemePolicy
{
    /**
     * Approve a submitted scheme, or send it back.
     */
    public function approve(User $user, Scheme $scheme, ?SchemeOpening $opening): bool
    {
        return $scheme->canBeApprovedBy($user, $opening);
    }

    /**
     * Open a scheme from the school's list: those who manage schemes,
     * and those who may approve it.
     */
    public function view(User $user, Scheme $scheme, ?SchemeOpening $opening): bool
    {
        return $user->can('manage-schemes') || $this->approve($user, $scheme, $opening);
    }
}
