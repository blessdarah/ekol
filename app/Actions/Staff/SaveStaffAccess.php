<?php

namespace App\Actions\Staff;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaveStaffAccess
{
    public function __construct(private InviteStaffMember $invite) {}

    /**
     * Save who the person is to the portal (role, sign-in email and
     * phone, invitation channel) and, when asked, invite them once the
     * change is committed.
     *
     * @param  array{role: UserRole|string, email: string, phone: string, channel: string, create_now: bool}  $data
     */
    public function handle(School $school, User $member, ?User $actor, array $data): User
    {
        abort_unless($member->school_id === $school->id
            && ($actor === null || $actor->school_id === null || $actor->school_id === $school->id), 404);

        $role = $data['role'] instanceof UserRole ? $data['role'] : UserRole::tryFrom($data['role']);

        if ($role === null || ! in_array($role, UserRole::assignable(), true)) {
            throw ValidationException::withMessages(['role' => trans('validation.enum', ['attribute' => 'role'])]);
        }

        $invite = $data['create_now'];

        $member = DB::transaction(function () use ($school, $member, $actor, $data, $role, $invite): User {
            $target = User::where('school_id', $school->id)->whereKey($member->id)->lockForUpdate()->firstOrFail();

            $before = $target->only(['role', 'email', 'phone']);
            $target->update([
                'role' => $role,
                'email' => $data['email'],
                'phone' => $data['phone'],
                'invitation_channel' => $data['channel'],
            ]);

            AuditEvent::record($school, $actor, 'staff', $target->id, 'access_saved', [
                'before' => $before,
                'after' => $target->only(['role', 'email', 'phone']),
                'invited' => $invite,
            ]);

            return $target;
        });

        if ($invite) {
            $this->invite->handle($school, $member, $actor, $data['channel']);
        }

        return $member;
    }
}
