<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Staff\SaveStaffAccessRequest;
use App\Http\StaffPresentation;
use App\Mail\StaffInvitationMail;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StaffAccessController extends Controller
{
    public const int INVITATION_DAYS = 7;

    protected function member(School $school, string $id): User
    {
        return User::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    public function access(Request $request, string $staff): Response
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff);
        $term = Term::where('school_id', $school->id)->where('is_current', true)->first();

        return Inertia::render('staff/access', [
            'yearLabel' => StaffPresentation::yearLabel($school),
            'member' => [
                'id' => $member->id,
                'formal_name' => $member->formalName(),
                'salutation' => StaffPresentation::salutation($member),
                'gender' => $member->gender?->value,
                'role' => $member->role->value,
                'email' => $member->email,
                'phone' => $member->phone,
                'has_account' => $member->hasPortalAccount(),
                'channel' => $member->invitation_channel ?? 'email',
            ],
            'roles' => StaffPresentation::roleOptions(UserRole::assignable()),
            'schoolName' => $school->name,
            'termLabel' => $term?->label,
        ]);
    }

    public function saveAccess(SaveStaffAccessRequest $request, string $staff): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff);

        $data = $request->validated();

        $before = $member->only(['role', 'email', 'phone']);
        $member->update([
            'role' => $data['role'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'invitation_channel' => $data['channel'],
        ]);

        AuditEvent::record($school, $request->user(), 'staff', $member->id, 'access_saved', [
            'before' => $before,
            'after' => $member->only(['role', 'email', 'phone']),
            'invited' => (bool) $data['create_now'],
        ]);

        if ($data['create_now'] && ! $member->hasPortalAccount()) {
            $this->invite($request, $school, $member, $data['channel']);
        }

        $this->notify('Portal access saved.');

        return redirect()->route('staff.show', $member->id);
    }

    public function remind(Request $request, string $staff): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff);

        if (! $member->hasPortalAccount()) {
            $this->invite($request, $school, $member, $member->invitation_channel ?? 'email');
            AuditEvent::record($school, $request->user(), 'staff', $member->id, 'invitation_sent', [
                'channel' => $member->invitation_channel,
            ]);
        }

        $this->notify('Invitation sent again.');

        return back();
    }

    /**
     * Issue a fresh seven-day link and deliver it. The link replaces any
     * earlier one; only its hash is stored.
     */
    protected function invite(Request $request, School $school, User $member, string $channel): void
    {
        $token = Str::random(64);

        $member->update([
            'invitation_token_hash' => hash('sha256', $token),
            'invitation_channel' => $channel,
            'invitation_expires_at' => now()->addDays(static::INVITATION_DAYS),
            'invited_at' => now(),
        ]);

        if (in_array($channel, ['email', 'both'], true)) {
            try {
                Mail::to($member->email)->locale($member->locale ?? $school->locale)->send(new StaffInvitationMail(
                    $school,
                    StaffPresentation::salutation($member),
                    (string) $request->user()?->full_name,
                    route('invitation.show', $token),
                ));
            } catch (\Throwable $exception) {
                Log::warning('Staff invitation email failed.', [
                    'staff_id' => $member->id,
                    'error' => $exception->getMessage(),
                ]);

                throw ValidationException::withMessages([
                    'invitation' => __('The invitation email could not be sent. Check the address and send it again.'),
                ]);
            }
        }

        if (in_array($channel, ['sms', 'both'], true)) {
            Log::warning('Staff invitation SMS pending: no SMS provider is configured.', [
                'staff_id' => $member->id,
            ]);
        }
    }
}
