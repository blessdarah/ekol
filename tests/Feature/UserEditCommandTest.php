<?php

use App\Enums\SchoolCycle;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

function commandSchool(string $slug): School
{
    return School::create([
        'name' => "Academy {$slug}", 'code' => strtoupper($slug), 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
}

test('user:edit changes the password of the user with that email', function () {
    $user = User::factory()->create(['school_id' => commandSchool('alpha')->id, 'email' => 'eposi@example.com']);

    $this->artisan('user:edit', ['--email' => 'eposi@example.com', '--password' => 'new-secret-123'])
        ->expectsOutputToContain('Password changed for')
        ->assertSuccessful();

    expect(Hash::check('new-secret-123', $user->fresh()->password))->toBeTrue();
});

test('user:edit refuses an unknown email or a password that breaks the rules', function () {
    $user = User::factory()->create(['school_id' => commandSchool('alpha')->id, 'email' => 'eposi@example.com']);
    $before = $user->password;

    $this->artisan('user:edit', ['--email' => 'nobody@example.com', '--password' => 'new-secret-123'])
        ->expectsOutputToContain('No user has the email nobody@example.com.')
        ->assertFailed();
    $this->artisan('user:edit', ['--email' => 'eposi@example.com', '--password' => 'short'])->assertFailed();
    $this->artisan('user:edit', ['--password' => 'new-secret-123'])->assertFailed();

    expect($user->fresh()->password)->toBe($before);
});

test('user:edit asks which school when the email is used in several', function () {
    $alpha = User::factory()->create(['school_id' => commandSchool('alpha')->id, 'email' => 'eposi@example.com']);
    $beta = User::factory()->create(['school_id' => commandSchool('beta')->id, 'email' => 'eposi@example.com']);

    $this->artisan('user:edit', ['--email' => 'eposi@example.com', '--password' => 'new-secret-123'])
        ->expectsOutputToContain('--school=beta')
        ->assertFailed();

    $this->artisan('user:edit', ['--email' => 'eposi@example.com', '--password' => 'new-secret-123', '--school' => 'beta'])
        ->assertSuccessful();

    expect(Hash::check('new-secret-123', $beta->fresh()->password))->toBeTrue()
        ->and(Hash::check('new-secret-123', $alpha->fresh()->password))->toBeFalse();
});
