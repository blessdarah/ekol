<?php

use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function profileSchool(string $slug, string $name): School
{
    return School::create([
        'name' => $name, 'code' => strtoupper(substr($slug, 0, 4)), 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
}

function profileUser(School $school, array $overrides = []): User
{
    return User::factory()->create([
        'school_id' => $school->id, 'role' => UserRole::Principal,
        'given_name' => 'Eposi', 'family_name' => 'Fonkem', 'full_name' => 'Eposi Fonkem',
        'email' => 'eposi@example.com', 'phone' => '+237677123456',
        ...$overrides,
    ]);
}

test('the profile shows the person and every school that knows their email', function () {
    $gbhs = profileSchool('gbhs', 'GBHS Bamenda');
    $user = profileUser($gbhs);
    profileUser(profileSchool('shc', 'Sacred Heart College'), ['role' => UserRole::Teacher, 'phone' => '+237677000001']);

    $this->actingAs($user)
        ->get('http://gbhs.ekol.test/profile')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('profile')
            ->where('profile.email', 'eposi@example.com')
            ->where('profile.given_name', 'Eposi')
            ->where('schools.0.name', 'GBHS Bamenda')
            ->where('schools.0.current', true)
            ->where('schools.1.name', 'Sacred Heart College')
            ->where('schools.1.role', 'Teacher')
            ->where('schools.1.login_url', '//shc.ekol.test/login')
            ->where('shellUser.email', 'eposi@example.com')
            ->has('shellUser.schools', 2));
});

test('a person changes their name, phone and photo but never their email', function () {
    Storage::fake('public');
    $school = profileSchool('gbhs', 'GBHS Bamenda');
    $user = profileUser($school);
    profileUser($school, ['email' => 'other@example.com', 'phone' => '+237699000000', 'role' => UserRole::Teacher]);

    $this->actingAs($user)
        ->post('http://gbhs.ekol.test/profile', [
            'given_name' => 'Eposi Ruth', 'family_name' => 'Fonkem', 'phone' => '+237699000000',
        ])
        ->assertSessionHasErrors('phone');

    $this->actingAs($user)
        ->post('http://gbhs.ekol.test/profile', [
            'given_name' => ' Eposi Ruth ', 'family_name' => 'Fonkem', 'phone' => '+237677999999',
            'email' => 'hacked@example.com',
            'photo' => UploadedFile::fake()->image('me.png', 200, 200),
        ])
        ->assertSessionHasNoErrors();

    $user->refresh();
    expect($user->full_name)->toBe('Eposi Ruth Fonkem')
        ->and($user->initials)->toBe('EF')
        ->and($user->phone)->toBe('+237677999999')
        ->and($user->email)->toBe('eposi@example.com')
        ->and($user->photo_path)->not->toBeNull();
    Storage::disk('public')->assertExists($user->photo_path);
});

test('changing a password needs the current one and records when', function () {
    $school = profileSchool('gbhs', 'GBHS Bamenda');
    $user = profileUser($school, ['password' => 'old-secret-1']);

    $this->actingAs($user)
        ->put('http://gbhs.ekol.test/profile/password', [
            'current_password' => 'wrong', 'password' => 'new-secret-123', 'password_confirmation' => 'new-secret-123',
        ])
        ->assertSessionHasErrors('current_password');

    $this->actingAs($user)
        ->put('http://gbhs.ekol.test/profile/password', [
            'current_password' => 'old-secret-1', 'password' => 'new-secret-123', 'password_confirmation' => 'different-123',
        ])
        ->assertSessionHasErrors('password');

    $this->actingAs($user)
        ->put('http://gbhs.ekol.test/profile/password', [
            'current_password' => 'old-secret-1', 'password' => 'new-secret-123', 'password_confirmation' => 'new-secret-123',
        ])
        ->assertSessionHasNoErrors();

    expect(Hash::check('new-secret-123', $user->fresh()->password))->toBeTrue()
        ->and($user->fresh()->password_changed_at)->not->toBeNull();

    auth()->logout();
    $this->get('http://gbhs.ekol.test/profile')->assertRedirect();
});
