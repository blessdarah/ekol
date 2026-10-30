<?php

use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Mail\PasswordResetMail;
use App\Models\School;
use App\Models\User;
use App\Notifications\PasswordResetCode;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Undjike\CamooNotificationChannel\CamooChannel;

function resetSchool(string $slug): School
{
    return School::create([
        'name' => "Academy {$slug}", 'code' => strtoupper($slug), 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
}

function resetUser(School $school, array $overrides = []): User
{
    return User::factory()->create([
        'school_id' => $school->id, 'role' => UserRole::Teacher,
        'email' => 'eposi@example.com', 'phone' => '+237 677 12 34 56', 'password' => 'old-password-1',
        ...$overrides,
    ]);
}

/**
 * The token in the last reset link mailed.
 */
function mailedToken(): string
{
    $token = '';

    Mail::assertQueued(PasswordResetMail::class, function (PasswordResetMail $mail) use (&$token) {
        $token = basename(parse_url($mail->url, PHP_URL_PATH) ?: '');

        return true;
    });

    return $token;
}

test('an email gets a link for this school only, and says nothing about unknown addresses', function () {
    Mail::fake();
    $alpha = resetSchool('alpha');
    $user = resetUser($alpha, ['locale' => 'fr']);
    $other = resetUser(resetSchool('beta'), ['phone' => '+237 699 00 00 00']);

    $this->get('http://alpha.ekol.test/forgot-password')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/forgot-password')->where('school.name', 'Academy alpha'));

    $this->post('http://alpha.ekol.test/forgot-password', ['identifier' => 'Eposi@Example.com'])
        ->assertRedirect()
        ->assertSessionHas('password_reset_sent', 'eposi@example.com');

    Mail::assertQueued(PasswordResetMail::class, fn (PasswordResetMail $mail) => $mail->hasTo('eposi@example.com') && $mail->school->is($alpha) && $mail->locale === 'fr');
    expect($user->fresh()->password_reset_token_hash)->not->toBeNull()
        ->and($other->fresh()->password_reset_token_hash)->toBeNull();

    Mail::fake();
    $this->post('http://alpha.ekol.test/forgot-password', ['identifier' => 'nobody@example.com'])
        ->assertSessionHas('password_reset_sent', 'nobody@example.com');
    Mail::assertNothingOutgoing();
});

test('the link sets a new password once, signs the person in and then expires', function () {
    Mail::fake();
    $school = resetSchool('alpha');
    $user = resetUser($school);
    $this->post('http://alpha.ekol.test/forgot-password', ['identifier' => 'eposi@example.com']);
    $token = mailedToken();

    $this->get("http://alpha.ekol.test/reset-password/{$token}")
        ->assertInertia(fn (Assert $page) => $page->component('auth/reset-password')->where('member.name', $user->full_name));

    $this->post("http://alpha.ekol.test/reset-password/{$token}", ['password' => 'short'])->assertSessionHasErrors('password');
    $this->post("http://alpha.ekol.test/reset-password/{$token}", ['password' => 'new-password-22'])
        ->assertRedirect(route('dashboard'));

    $user->refresh();
    expect(Hash::check('new-password-22', $user->password))->toBeTrue()
        ->and($user->password_changed_at)->not->toBeNull()
        ->and($user->password_reset_token_hash)->toBeNull();
    $this->assertAuthenticatedAs($user);

    auth()->logout();
    $this->get("http://alpha.ekol.test/reset-password/{$token}")
        ->assertInertia(fn (Assert $page) => $page->where('member', null));
});

test('a link stops working after an hour', function () {
    Mail::fake();
    $school = resetSchool('alpha');
    $user = resetUser($school);
    $this->post('http://alpha.ekol.test/forgot-password', ['identifier' => 'eposi@example.com']);
    $token = mailedToken();

    $this->travel(61)->minutes();

    $this->post("http://alpha.ekol.test/reset-password/{$token}", ['password' => 'new-password-22'])->assertRedirect();
    expect(Hash::check('old-password-1', $user->fresh()->password))->toBeTrue();
});

test('a phone gets a code by SMS that leads to the new password, with limited tries', function () {
    Notification::fake();
    $school = resetSchool('alpha');
    $user = resetUser($school);

    $this->post('http://alpha.ekol.test/forgot-password', ['identifier' => '677123456'])
        ->assertRedirect(route('password.code'));

    $code = '';
    Notification::assertSentOnDemand(PasswordResetCode::class, function (PasswordResetCode $notification, array $channels, AnonymousNotifiable $notifiable) use (&$code) {
        $code = $notification->code;

        return $notifiable->routes[CamooChannel::class] === '+237677123456';
    });

    $this->get('http://alpha.ekol.test/forgot-password/code')
        ->assertInertia(fn (Assert $page) => $page->component('auth/reset-code')->where('phone', '•• •• 3456'));

    $wrong = $code === '111111' ? '222222' : '111111';
    $this->post('http://alpha.ekol.test/forgot-password/code', ['code' => $wrong])->assertSessionHasErrors('code');
    expect($user->fresh()->password_reset_attempts)->toBe(1);

    $response = $this->post('http://alpha.ekol.test/forgot-password/code', ['code' => $code]);
    $response->assertRedirect();
    expect($response->headers->get('Location'))->toContain('/reset-password/')
        ->and($user->fresh()->password_reset_code_hash)->toBeNull();

    Notification::fake();
    $this->post('http://alpha.ekol.test/forgot-password', ['identifier' => '677123456']);
    foreach (range(1, 5) as $attempt) {
        $this->post('http://alpha.ekol.test/forgot-password/code', ['code' => $wrong]);
    }
    $this->post('http://alpha.ekol.test/forgot-password/code', ['code' => $wrong])->assertSessionHasErrors('code');
});

test('one account gets at most three resets an hour', function () {
    Mail::fake();
    $school = resetSchool('alpha');
    resetUser($school);

    foreach (range(1, 4) as $attempt) {
        $this->post('http://alpha.ekol.test/forgot-password', ['identifier' => 'eposi@example.com']);
    }

    Mail::assertQueued(PasswordResetMail::class, 3);
});
