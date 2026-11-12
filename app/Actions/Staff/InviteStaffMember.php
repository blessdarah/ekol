<?php

namespace App\Actions\Staff;

use App\Mail\StaffInvitationMail;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Throwable;

class InviteStaffMember
{
    public const int INVITATION_DAYS = 7;

    public const array CHANNELS = ['email', 'sms', 'both'];

    /**
     * Issue a fresh seven-day link and deliver it once the link is
     * committed. The link replaces any earlier one and only its hash is
     * stored. People who already set a password are left alone.
     *
     * Returns whether an invitation was issued.
     */
    public function handle(School $school, User $member, ?User $actor, ?string $channel = null): bool
    {
        abort_unless($member->school_id === $school->id
            && ($actor === null || $actor->school_id === null || $actor->school_id === $school->id), 404);

        $channel ??= $member->invitation_channel ?? 'email';

        if (! in_array($channel, self::CHANNELS, true)) {
            throw new InvalidArgumentException("Unknown invitation channel [{$channel}].");
        }

        $token = DB::transaction(function () use ($school, $member, $actor, $channel): ?string {
            $target = User::where('school_id', $school->id)->whereKey($member->id)->lockForUpdate()->firstOrFail();

            if ($target->hasPortalAccount()) {
                return null;
            }

            $token = Str::random(64);

            $target->update([
                'invitation_token_hash' => hash('sha256', $token),
                'invitation_channel' => $channel,
                'invitation_expires_at' => now()->addDays(self::INVITATION_DAYS),
                'invited_at' => now(),
            ]);

            AuditEvent::record($school, $actor, 'staff', $target->id, 'invitation_sent', ['channel' => $channel]);

            return $token;
        });

        if ($token === null) {
            return false;
        }

        $member->refresh();
        $this->deliver($school, $member, $actor, $channel, $token);

        return true;
    }

    protected function deliver(School $school, User $member, ?User $actor, string $channel, string $token): void
    {
        if (in_array($channel, ['email', 'both'], true)) {
            try {
                Mail::to($member->email)->locale($member->locale ?? $school->locale)->send(new StaffInvitationMail(
                    $school,
                    $member->salutation(),
                    (string) $actor?->full_name,
                    $this->link($school, $token),
                ));
            } catch (Throwable $exception) {
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

    /**
     * The link opens on the school's own subdomain, whatever host (or
     * none, from the console or a queue) asked for it.
     */
    protected function link(School $school, string $token): string
    {
        $parent = parse_url((string) config('app.url'));

        if (! is_array($parent) || ! isset($parent['host'])) {
            throw new InvalidArgumentException('The application URL has no host.');
        }

        return ($parent['scheme'] ?? 'https').'://'.$school->slug.'.'.$parent['host']
            .(isset($parent['port']) ? ':'.$parent['port'] : '')
            .route('invitation.show', $token, absolute: false);
    }
}
