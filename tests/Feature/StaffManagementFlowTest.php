<?php

use App\Enums\EmploymentType;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Mail\StaffInvitationMail;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function staffSchool(array $overrides = []): School
{
    return School::create(array_merge([
        'name' => 'Roster Academy',
        'code' => 'RA',
        'slug' => 'rostera',
        'cycle' => SchoolCycle::Secondary,
        'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ], $overrides));
}

function staffAdmin(School $school, array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'school_id' => $school->id,
        'role' => UserRole::Admin,
    ], $overrides));
}

function staffPayload(array $overrides = []): array
{
    return array_merge([
        'given_name' => 'Gabriel',
        'family_name' => 'Ngonda',
        'gender' => 'female',
        'email' => 'g.ngonda@example.com',
        'phone' => '+237677214000',
        'address' => 'Quartier Mvolyé, Douala',
        'qualification' => 'Master of Science · Physics',
        'employment_type' => 'government',
    ], $overrides);
}

function registeredMember(School $school, array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'school_id' => $school->id,
        'given_name' => 'Gabriel',
        'family_name' => 'Ngonda',
        'full_name' => 'Gabriel Ngonda',
        'password' => null,
    ], $overrides));
}

test('registering a staff member puts her on the roster without an account', function () {
    Storage::fake('public');
    $school = staffSchool();
    $admin = staffAdmin($school);

    $response = $this->actingAs($admin)
        ->post('http://rostera.ekol.test/staff', staffPayload([
            'photo' => UploadedFile::fake()->image('photo.jpg', 300, 300),
        ]));

    $member = User::where('email', 'g.ngonda@example.com')->firstOrFail();

    $response->assertRedirect(route('staff.access', $member->id));

    expect($member->full_name)->toBe('Gabriel Ngonda')
        ->and($member->initials)->toBe('GN')
        ->and($member->school_id)->toBe($school->id)
        ->and($member->employment_type)->toBe(EmploymentType::Government)
        ->and($member->hasPortalAccount())->toBeFalse()
        ->and($member->staff_code)->not->toBe($admin->staff_code)
        ->and(AuditEvent::where('entity', 'staff')->where('action', 'registered')->count())->toBe(1);

    Storage::disk('public')->assertExists($member->photo_path);
});

test('all seven fields are required and contacts must be unused', function () {
    $school = staffSchool();
    $admin = staffAdmin($school, ['email' => 'taken@example.com', 'phone' => '+237600000009']);

    $this->actingAs($admin)
        ->post('http://rostera.ekol.test/staff', [])
        ->assertSessionHasErrors([
            'given_name', 'family_name', 'gender', 'email', 'phone',
            'address', 'qualification', 'employment_type',
        ]);

    $this->actingAs($admin)
        ->post('http://rostera.ekol.test/staff', staffPayload([
            'email' => 'taken@example.com',
            'phone' => '+237600000009',
        ]))
        ->assertSessionHasErrors(['email', 'phone']);
});

test('creating the account sends a seven-day invitation link', function () {
    Mail::fake();
    $school = staffSchool();
    $admin = staffAdmin($school);
    $member = registeredMember($school);
    $member->update(['locale' => 'fr']);

    $this->actingAs($admin)
        ->post("http://rostera.ekol.test/staff/{$member->id}/access", [
            'role' => 'head_of_department',
            'email' => $member->email,
            'phone' => $member->phone,
            'channel' => 'email',
            'create_now' => true,
        ])
        ->assertRedirect(route('staff.show', $member->id));

    $member->refresh();

    expect($member->role)->toBe(UserRole::HeadOfDepartment)
        ->and($member->invitation_token_hash)->not->toBeNull()
        ->and((int) round(now()->diffInDays($member->invitation_expires_at)))->toBe(7)
        ->and($member->hasPortalAccount())->toBeFalse();

    Mail::assertQueued(StaffInvitationMail::class, fn (StaffInvitationMail $mail) => $mail->hasTo($member->email)
        && hash('sha256', basename($mail->url)) === $member->invitation_token_hash
        && $mail->locale === 'fr');
});

test('access can wait: no invitation goes out when the account is left off', function () {
    Mail::fake();
    $school = staffSchool();
    $admin = staffAdmin($school);
    $member = registeredMember($school);

    $this->actingAs($admin)
        ->post("http://rostera.ekol.test/staff/{$member->id}/access", [
            'role' => 'teacher',
            'email' => $member->email,
            'phone' => $member->phone,
            'channel' => 'email',
            'create_now' => false,
        ])
        ->assertRedirect();

    Mail::assertNothingOutgoing();
    expect($member->fresh()->invitation_token_hash)->toBeNull();
});

test('the principal role cannot be handed out from portal access', function () {
    $school = staffSchool();
    $admin = staffAdmin($school);
    $member = registeredMember($school);

    $this->actingAs($admin)
        ->post("http://rostera.ekol.test/staff/{$member->id}/access", [
            'role' => 'principal',
            'email' => $member->email,
            'phone' => $member->phone,
            'channel' => 'email',
            'create_now' => false,
        ])
        ->assertSessionHasErrors('role');
});

test('the invited person sets her password and is signed in', function () {
    $school = staffSchool();
    $member = registeredMember($school, [
        'invitation_token_hash' => hash('sha256', 'open-token'),
        'invitation_expires_at' => now()->addDays(3),
    ]);

    $this->get('http://rostera.ekol.test/invitation/open-token')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/set-password')
            ->where('member.formal_name', 'NGONDA Gabriel'));

    $this->post('http://rostera.ekol.test/invitation/open-token', ['password' => 'short1'])
        ->assertSessionHasErrors('password');

    $this->post('http://rostera.ekol.test/invitation/open-token', ['password' => 'nodigitshere'])
        ->assertSessionHasErrors('password');

    $this->post('http://rostera.ekol.test/invitation/open-token', ['password' => 'correct-horse-9'])
        ->assertRedirect(route('dashboard'));

    $member->refresh();

    $this->assertAuthenticatedAs($member);
    expect(Hash::check('correct-horse-9', $member->password))->toBeTrue()
        ->and($member->invitation_token_hash)->toBeNull();
});

test('expired, used and foreign invitation links open nothing', function () {
    $school = staffSchool();
    $other = staffSchool(['name' => 'Other Academy', 'code' => 'OA', 'slug' => 'othera']);
    $expired = registeredMember($school, [
        'invitation_token_hash' => hash('sha256', 'old-token'),
        'invitation_expires_at' => now()->subDay(),
    ]);
    $foreign = registeredMember($other, [
        'invitation_token_hash' => hash('sha256', 'foreign-token'),
        'invitation_expires_at' => now()->addDays(3),
    ]);

    $this->get('http://rostera.ekol.test/invitation/old-token')
        ->assertInertia(fn (Assert $page) => $page->where('member', null));

    foreach (['old-token', 'foreign-token', 'never-issued'] as $token) {
        $this->post("http://rostera.ekol.test/invitation/{$token}", ['password' => 'correct-horse-9'])
            ->assertRedirect(route('invitation.show', $token));
    }

    $this->assertGuest();
    expect($expired->fresh()->password)->toBeNull()
        ->and($foreign->fresh()->password)->toBeNull();
});

test('a reminder replaces the old link', function () {
    Mail::fake();
    $school = staffSchool();
    $admin = staffAdmin($school);
    $member = registeredMember($school, [
        'invitation_token_hash' => hash('sha256', 'first-token'),
        'invitation_expires_at' => now()->subDay(),
    ]);

    $this->actingAs($admin)
        ->post("http://rostera.ekol.test/staff/{$member->id}/reminder")
        ->assertRedirect();

    Mail::assertQueued(StaffInvitationMail::class, 1);
    expect($member->fresh()->invitation_token_hash)->not->toBe(hash('sha256', 'first-token'))
        ->and($member->fresh()->invitation_expires_at->isFuture())->toBeTrue();
});

test('the roster counts, filters and searches the school own staff only', function () {
    $school = staffSchool();
    $other = staffSchool(['name' => 'Other Academy', 'code' => 'OA', 'slug' => 'othera']);
    $admin = staffAdmin($school, ['full_name' => 'Zed Admin']);
    registeredMember($school, ['employment_type' => EmploymentType::Government, 'address' => 'Douala']);
    User::factory()->create([
        'school_id' => $school->id, 'full_name' => 'Marie Fotso',
        'given_name' => 'Marie', 'family_name' => 'Fotso',
        'employment_type' => EmploymentType::SchoolPaid, 'address' => 'Bamenda',
    ]);
    registeredMember($other, ['full_name' => 'Hidden Person', 'family_name' => 'Person']);

    $this->actingAs($admin)
        ->get('http://rostera.ekol.test/staff')
        ->assertInertia(fn (Assert $page) => $page
            ->component('staff/roster')
            ->where('counts.total', 3)
            ->where('counts.government', 1)
            ->where('counts.school_paid', 1)
            ->where('counts.no_account', 1)
            ->where('staff.rows.0.name', 'Marie Fotso')
            ->has('staff.rows', 3));

    $this->actingAs($admin)
        ->get('http://rostera.ekol.test/staff?portal=none')
        ->assertInertia(fn (Assert $page) => $page
            ->has('staff.rows', 1)
            ->where('staff.rows.0.name', 'Gabriel Ngonda')
            ->where('staff.rows.0.has_account', false));

    $this->actingAs($admin)
        ->get('http://rostera.ekol.test/staff?q=bamenda')
        ->assertInertia(fn (Assert $page) => $page
            ->has('staff.rows', 1)
            ->where('staff.rows.0.name', 'Marie Fotso'));

    $this->actingAs($admin)
        ->get('http://rostera.ekol.test/staff?employment=government,school_paid&sort=-name')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.employment', ['government', 'school_paid'])
            ->has('staff.rows', 2)
            ->where('staff.rows.0.name', 'Gabriel Ngonda'));

    $csv = $this->actingAs($admin)
        ->get('http://rostera.ekol.test/staff/export?employment=school_paid&columns=name,employment')
        ->assertDownload()
        ->streamedContent();

    expect($csv)->toContain('Marie Fotso')
        ->and($csv)->not->toContain('Gabriel Ngonda')
        ->and($csv)->not->toContain('Hidden Person')
        ->and(AuditEvent::where('entity', 'export')->where('school_id', $school->id)->count())->toBe(1);
});

test('corrections and teaching hours are saved and logged', function () {
    $school = staffSchool();
    $admin = staffAdmin($school);
    $member = registeredMember($school);

    $this->actingAs($admin)
        ->patch("http://rostera.ekol.test/staff/{$member->id}", staffPayload([
            'email' => $member->email,
            'phone' => $member->phone,
            'family_name' => 'Nkonda',
        ]))
        ->assertRedirect(route('staff.show', $member->id));

    $this->actingAs($admin)
        ->patch("http://rostera.ekol.test/staff/{$member->id}/hours", [
            'teaching_days' => 15,
            'max_periods_week' => 24,
            'max_periods_day' => 6,
            'unavailable_times' => [
                ['weekday' => 2, 'from' => 'P5', 'to' => 'P6', 'reason' => 'staff meeting'],
            ],
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $member->refresh();

    expect($member->full_name)->toBe('Gabriel Nkonda')
        ->and($member->teaching_days)->toBe(15)
        ->and($member->unavailable_times[0]['reason'])->toBe('staff meeting')
        ->and(AuditEvent::where('entity', 'staff')->where('entity_id', $member->id)->count())->toBe(2);

    $this->actingAs($admin)
        ->get("http://rostera.ekol.test/staff/{$member->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('staff/record')
            ->where('member.max_periods_week', 24)
            ->where('lastEdit.by', 'administrator'));
});

test('staff management is closed to teachers and to other schools', function () {
    $school = staffSchool();
    $other = staffSchool(['name' => 'Other Academy', 'code' => 'OA', 'slug' => 'othera']);
    $admin = staffAdmin($school);
    $teacher = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Teacher]);
    $foreign = registeredMember($other);

    $this->actingAs($teacher)->get('http://rostera.ekol.test/staff')->assertForbidden();
    $this->actingAs($teacher)->post('http://rostera.ekol.test/staff', staffPayload())->assertForbidden();

    $this->actingAs($admin)->get("http://rostera.ekol.test/staff/{$foreign->id}")->assertNotFound();
    $this->actingAs($admin)
        ->patch("http://rostera.ekol.test/staff/{$foreign->id}", staffPayload())
        ->assertNotFound();
});

test('a person without a password cannot sign in', function () {
    $school = staffSchool();
    $member = registeredMember($school);

    $this->post('http://rostera.ekol.test/login', [
        'identifier' => $member->email,
        'password' => '',
    ])->assertSessionHasErrors('password');

    $this->post('http://rostera.ekol.test/login', [
        'identifier' => $member->email,
        'password' => 'anything-at-all',
    ])->assertSessionHasErrors('identifier');

    $this->assertGuest();
});

test('a teacher who works in two schools has an account in each with the same email', function () {
    $first = staffSchool();
    $second = staffSchool(['name' => 'Second Academy', 'code' => 'SA', 'slug' => 'seconda']);
    staffAdmin($first, ['role' => UserRole::Teacher, 'email' => 'part.time@example.com', 'phone' => '+237600000101']);
    $admin = staffAdmin($second);

    $this->actingAs($admin)
        ->post('http://seconda.ekol.test/staff', staffPayload(['email' => 'part.time@example.com']))
        ->assertSessionHasNoErrors();

    $accounts = User::where('email', 'part.time@example.com')->get();

    expect($accounts)->toHaveCount(2)
        ->and($accounts->pluck('school_id')->sort()->values()->all())
        ->toBe(collect([$first->id, $second->id])->sort()->values()->all());

    $this->actingAs($admin)
        ->post('http://seconda.ekol.test/staff', staffPayload(['email' => 'part.time@example.com', 'phone' => '+237600000102']))
        ->assertSessionHasErrors('email');
});
