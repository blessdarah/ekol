<?php

use App\Actions\Staff\InviteStaffMember;
use App\Actions\Staff\SaveStaffAccess;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Mail\StaffInvitationMail;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * @return array{school: School, actor: User, member: User}
 */
function staffAccessWorld(string $slug = 'access-academy'): array
{
    $school = School::create([
        'name' => 'Access Academy '.$slug, 'code' => 'AA', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
        'locale' => 'en',
    ]);
    $actor = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin, 'full_name' => 'Ada Principal']);
    $member = User::factory()->create([
        'school_id' => $school->id, 'role' => UserRole::Teacher, 'password' => null,
        'given_name' => 'Gabriel', 'family_name' => 'Ngonda', 'full_name' => 'Gabriel Ngonda',
    ]);

    return compact('school', 'actor', 'member');
}

/**
 * @return array{role: string, email: string, phone: string, channel: string, create_now: bool}
 */
function staffAccessData(User $member, array $overrides = []): array
{
    return array_merge([
        'role' => 'head_of_department',
        'email' => 'g.ngonda@example.com',
        'phone' => '+237677214000',
        'channel' => 'email',
        'create_now' => true,
    ], $overrides);
}

test('saving access with an invitation runs without a request and sends a seven-day link from the school', function () {
    Mail::fake();
    $this->travelTo('2026-11-12 09:00:00');
    $world = staffAccessWorld();
    $world['member']->update(['locale' => 'fr']);

    app(SaveStaffAccess::class)->handle($world['school'], $world['member'], $world['actor'], staffAccessData($world['member']));

    $member = $world['member']->fresh();
    expect($member->role)->toBe(UserRole::HeadOfDepartment)
        ->and($member->email)->toBe('g.ngonda@example.com')
        ->and($member->invitation_channel)->toBe('email')
        ->and($member->invitation_expires_at->toDateTimeString())->toBe('2026-11-19 09:00:00')
        ->and($member->hasPortalAccount())->toBeFalse();

    Mail::assertQueued(StaffInvitationMail::class, function (StaffInvitationMail $mail) use ($member) {
        $token = basename($mail->url);

        return $mail->hasTo('g.ngonda@example.com')
            && $mail->locale === 'fr'
            && $mail->sender === 'Ada Principal'
            && $mail->url === 'http://access-academy.ekol.test/invitation/'.$token
            && strlen($token) === 64
            && $member->invitation_token_hash === hash('sha256', $token);
    });

    expect(AuditEvent::orderBy('action')->get(['action', 'actor_id'])->toArray())->toBe([
        ['action' => 'access_saved', 'actor_id' => $world['actor']->id],
        ['action' => 'invitation_sent', 'actor_id' => $world['actor']->id],
    ]);
});

test('saving access without an invitation changes access only', function () {
    Mail::fake();
    $world = staffAccessWorld();

    app(SaveStaffAccess::class)->handle($world['school'], $world['member'], $world['actor'], staffAccessData($world['member'], [
        'role' => 'bursar', 'channel' => 'sms', 'create_now' => false,
    ]));

    $member = $world['member']->fresh();
    Mail::assertNothingOutgoing();
    expect($member->role)->toBe(UserRole::Bursar)
        ->and($member->invitation_channel)->toBe('sms')
        ->and($member->invitation_token_hash)->toBeNull()
        ->and(AuditEvent::sole()->diff['invited'])->toBeFalse();
});

test('saving access refuses roles that cannot be handed out', function () {
    $world = staffAccessWorld();

    expect(fn () => app(SaveStaffAccess::class)->handle($world['school'], $world['member'], $world['actor'], staffAccessData($world['member'], [
        'role' => 'principal',
    ])))->toThrow(ValidationException::class);

    expect($world['member']->fresh()->role)->toBe(UserRole::Teacher)
        ->and(AuditEvent::count())->toBe(0);
});

test('a reminder replaces the previous link and restarts the seven days', function () {
    Mail::fake();
    $world = staffAccessWorld();
    $world['member']->update([
        'invitation_token_hash' => hash('sha256', 'first-token'),
        'invitation_channel' => 'email',
        'invitation_expires_at' => now()->subDay(),
    ]);
    $this->travelTo('2026-11-12 09:00:00');

    $sent = app(InviteStaffMember::class)->handle($world['school'], $world['member'], $world['actor']);

    $member = $world['member']->fresh();
    expect($sent)->toBeTrue()
        ->and($member->invitation_token_hash)->not->toBe(hash('sha256', 'first-token'))
        ->and($member->invitation_expires_at->toDateTimeString())->toBe('2026-11-19 09:00:00')
        ->and(User::where('invitation_token_hash', hash('sha256', 'first-token'))->exists())->toBeFalse();
    Mail::assertQueued(StaffInvitationMail::class, fn (StaffInvitationMail $mail) => hash('sha256', basename($mail->url)) === $member->invitation_token_hash);
    expect(AuditEvent::sole()->only(['action', 'actor_id', 'diff']))->toBe([
        'action' => 'invitation_sent', 'actor_id' => $world['actor']->id, 'diff' => ['channel' => 'email'],
    ]);
});

test('an sms-only invitation stores the link without sending mail', function () {
    Mail::fake();
    $world = staffAccessWorld();

    expect(app(InviteStaffMember::class)->handle($world['school'], $world['member'], $world['actor'], 'sms'))->toBeTrue();

    Mail::assertNothingOutgoing();
    expect($world['member']->fresh()->invitation_token_hash)->not->toBeNull();
});

test('people who already have a portal account are not invited again', function () {
    Mail::fake();
    $world = staffAccessWorld();
    $world['member']->update(['password' => 'correct-horse-9', 'invitation_token_hash' => null]);

    $sent = app(InviteStaffMember::class)->handle($world['school'], $world['member'], $world['actor']);
    app(SaveStaffAccess::class)->handle($world['school'], $world['member'], $world['actor'], staffAccessData($world['member']));

    expect($sent)->toBeFalse()
        ->and($world['member']->fresh()->invitation_token_hash)->toBeNull()
        ->and(AuditEvent::pluck('action')->all())->toBe(['access_saved']);
    Mail::assertNothingOutgoing();
});

test('a failed invitation email is reported as a validation error', function () {
    $world = staffAccessWorld();
    Mail::shouldReceive('to')->andThrow(new RuntimeException('Mailer is down'));

    expect(fn () => app(InviteStaffMember::class)->handle($world['school'], $world['member'], $world['actor']))
        ->toThrow(fn (ValidationException $exception) => expect($exception->errors())->toHaveKey('invitation'));
});

test('access and invitations stay inside the school', function () {
    Mail::fake();
    $world = staffAccessWorld();
    $other = staffAccessWorld('other-academy');

    expect(fn () => app(InviteStaffMember::class)->handle($world['school'], $other['member'], $world['actor']))
        ->toThrow(NotFoundHttpException::class)
        ->and(fn () => app(InviteStaffMember::class)->handle($world['school'], $world['member'], $other['actor']))
        ->toThrow(NotFoundHttpException::class)
        ->and(fn () => app(SaveStaffAccess::class)->handle($world['school'], $other['member'], $world['actor'], staffAccessData($other['member'])))
        ->toThrow(NotFoundHttpException::class);

    Mail::assertNothingOutgoing();
    expect($other['member']->fresh()->invitation_token_hash)->toBeNull()
        ->and($other['member']->fresh()->role)->toBe(UserRole::Teacher)
        ->and(AuditEvent::count())->toBe(0);
});
