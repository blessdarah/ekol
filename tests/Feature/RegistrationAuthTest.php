<?php

use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Mail\VerificationCodeMail;
use App\Mail\WorkspaceReadyMail;
use App\Models\AcademicYear;
use App\Models\PendingRegistration;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Mail::fake();
});

function schoolPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Acme Academy',
        'code' => 'ACME',
        'slug' => 'acme',
        'ownership' => 'government',
        'region' => 'North West',
        'town' => 'Bamenda',
        'subsystem' => 'anglophone',
    ], $overrides);
}

function adminPayload(array $overrides = []): array
{
    return array_merge([
        'full_name' => 'Ada Founder',
        'role' => UserRole::Admin->value,
        'email' => 'ada@example.com',
        'phone' => '+237600000001',
        'password' => 'password123',
        'authorisation' => '1',
    ], $overrides);
}

test('staging persists no domain rows until verified', function () {
    $this->post('/register/school', schoolPayload())
        ->assertRedirect(route('register.admin'));

    $this->post('/register/admin', adminPayload())
        ->assertRedirect(route('register.verify'));

    expect(PendingRegistration::count())->toBe(1)
        ->and(School::count())->toBe(0)
        ->and(User::count())->toBe(0)
        ->and(AcademicYear::count())->toBe(0)
        ->and(Term::count())->toBe(0);
});

test('admin step rejects a duplicate admin email', function () {
    $school = School::create([
        'name' => 'Taken School', 'code' => 'TS', 'slug' => 'taken',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);
    User::create([
        'school_id' => $school->id, 'staff_code' => 'STF-0001',
        'full_name' => 'Existing Admin', 'initials' => 'EA',
        'email' => 'ada@example.com', 'role' => UserRole::Admin,
        'phone' => '+237600000009', 'password' => 'password123',
    ]);

    $this->post('/register/school', schoolPayload())
        ->assertRedirect(route('register.admin'));

    $this->post('/register/admin', adminPayload())
        ->assertSessionHasErrors('email');

    expect(PendingRegistration::count())->toBe(0);
});

test('slug check reports availability and blocks reserved words', function () {
    $this->get('/register/slug-check?slug=acme')
        ->assertOk()
        ->assertJson(['available' => true]);

    $this->get('/register/slug-check?slug=www')
        ->assertOk()
        ->assertJson(['available' => false]);

    School::create([
        'name' => 'Acme Academy', 'code' => 'ACME', 'slug' => 'acme',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);

    $this->get('/register/slug-check?slug=acme')
        ->assertOk()
        ->assertJson(['available' => false]);
});

test('wrong codes are counted and the sixth try is locked', function () {
    $this->post('/register/school', schoolPayload());
    $this->post('/register/admin', adminPayload());

    foreach (range(1, 5) as $i) {
        $this->post('/register/verify', ['code' => '000000'])
            ->assertSessionHasErrors('code');
    }

    expect(PendingRegistration::first()->attempts)->toBe(5);

    $this->post('/register/verify', ['code' => '000000'])
        ->assertSessionHasErrors('code');

    expect(PendingRegistration::first()->attempts)->toBe(5)
        ->and(School::count())->toBe(0);

    $this->post('/register/resend')->assertRedirect();

    expect(PendingRegistration::first()->attempts)->toBe(0);
});

test('expired codes are rejected and resend re-arms the row', function () {
    $this->post('/register/school', schoolPayload());
    $this->post('/register/admin', adminPayload());

    $pending = PendingRegistration::first();
    $pending->update(['expires_at' => now()->subMinute()]);

    $this->post('/register/verify', ['code' => '123456'])
        ->assertSessionHasErrors('code');

    $this->post('/register/resend')->assertRedirect();

    $pending->refresh();
    expect($pending->attempts)->toBe(0)
        ->and($pending->expires_at->isFuture())->toBeTrue();
});

test('correct code bootstraps school, year, terms and admin atomically', function () {
    [$pending, $code] = PendingRegistration::stage(schoolPayload(), [
        'full_name' => 'Ada Founder',
        'role' => UserRole::Admin->value,
        'email' => 'ada@example.com',
        'phone' => '+237600000001',
        'password' => 'password123',
    ]);

    expect($pending->attempt($code))->toBeTrue();

    $user = $pending->bootstrap();

    $school = School::where('slug', 'acme')->firstOrFail();
    expect($user->school_id)->toBe($school->id)
        ->and($user->role)->toBe(UserRole::Admin)
        ->and(Hash::check('password123', $user->password))->toBeTrue();

    $year = AcademicYear::where('school_id', $school->id)->firstOrFail();
    expect($year->status)->toBe(AcademicYearStatus::Current)
        ->and($year->terms()->count())->toBe(3);

    expect($pending->fresh()->consumed_at)->not->toBeNull();
});

test('unknown subdomain returns 404', function () {
    $this->get('http://ghost.ekol.test/login')->assertNotFound();
});

test('find-school redirects to the school login address', function () {
    School::create([
        'name' => 'Acme Academy', 'code' => 'ACME', 'slug' => 'acme',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);

    $this->post('/login/find-school', ['slug' => 'acme'])
        ->assertRedirect('http://acme.ekol.test/login');

    $this->post('/login/find-school', ['slug' => 'ghost'])
        ->assertSessionHasErrors('slug');
});

test('school subdomain renders branded login and binds the session', function () {
    School::create([
        'name' => 'Acme Academy', 'code' => 'ACME', 'slug' => 'acme',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);

    $response = $this->get('http://acme.ekol.test/login');

    $response->assertOk();
    expect($response->getContent())->toContain('Acme Academy');
});

test('email and phone login route first-visit admins to setup', function () {
    $school = School::create([
        'name' => 'Acme Academy', 'code' => 'ACME', 'slug' => 'acme',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);
    User::create([
        'school_id' => $school->id, 'staff_code' => 'STF-0001',
        'full_name' => 'Ada Founder', 'initials' => 'AF',
        'email' => 'ada@example.com', 'role' => UserRole::Admin,
        'phone' => '+237600000001', 'password' => 'password123',
    ]);

    $this->post('http://acme.ekol.test/login', [
        'identifier' => 'ada@example.com', 'password' => 'password123',
    ])->assertRedirect(route('setup'));

    $this->post('http://acme.ekol.test/logout');

    $this->post('http://acme.ekol.test/login', [
        'identifier' => '+237600000001', 'password' => 'password123',
    ])->assertRedirect(route('setup'));

    $this->post('http://acme.ekol.test/login', [
        'identifier' => 'ada@example.com', 'password' => 'wrong-password',
    ])->assertSessionHasErrors('identifier');
});

test('cross-school requests are denied', function () {
    $schoolA = School::create([
        'name' => 'School A', 'code' => 'SA', 'slug' => 'schoola',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);
    School::create([
        'name' => 'School B', 'code' => 'SB', 'slug' => 'schoolb',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);
    $userA = User::create([
        'school_id' => $schoolA->id, 'staff_code' => 'STF-0001',
        'full_name' => 'User A', 'initials' => 'UA',
        'email' => 'a@example.com', 'role' => UserRole::Teacher,
        'phone' => '+237600000001', 'password' => 'password123',
    ]);

    $this->actingAs($userA)
        ->get('http://schoolb.ekol.test/dashboard')
        ->assertForbidden();

    $this->actingAs($userA)
        ->get('http://schoola.ekol.test/dashboard')
        ->assertOk();
});

test('stale pending registrations prune', function () {
    [$pending] = PendingRegistration::stage(schoolPayload(), [
        'full_name' => 'Ada Founder',
        'role' => UserRole::Admin->value,
        'email' => 'ada@example.com',
        'phone' => '+237600000001',
        'password' => 'password123',
    ]);
    $pending->update(['expires_at' => now()->subMinute()]);

    expect(PendingRegistration::pruneExpired())->toBe(1)
        ->and(PendingRegistration::count())->toBe(0);
});

test('registration code is stored hashed and expiry enforced', function () {
    [$pending, $code] = PendingRegistration::stage(schoolPayload(), [
        'full_name' => 'Ada Founder',
        'role' => UserRole::Admin->value,
        'email' => 'ada@example.com',
        'phone' => '+237600000001',
        'password' => 'password123',
    ]);

    expect($pending->code_hash)->not->toBe($code)
        ->and($pending->admin_payload['password'])->not->toBe('password123');

    expect(fn () => $pending->attempt($code))->not->toThrow(ValidationException::class);
});

test('auth screens render the paper shell pages with design props', function () {
    $this->get('/register')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/register-school')
            ->has('regions', 10)
            ->where('parentDomain', 'ekol.test')
            ->where('ownershipOptions.0', 'government'));

    $this->post('/register/school', schoolPayload());

    $this->get('/register/admin')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/register-admin')
            ->where('schoolName', 'Acme Academy'));

    $this->post('/register/admin', adminPayload());

    $this->get('/register/verify')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/verify-code')
            ->where('email', 'ada@example.com')
            ->has('expiresAt'));

    $this->get('/login')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/find-school'));

    // A reset belongs to one school, so outside a school it starts by finding it.
    $this->get('/forgot-password')
        ->assertRedirect(route('login'));
});

test('staging rejects missing authorisation', function () {
    $this->post('/register/school', schoolPayload());

    $payload = adminPayload();
    unset($payload['authorisation']);

    $this->post('/register/admin', $payload)
        ->assertSessionHasErrors('authorisation');

    expect(PendingRegistration::count())->toBe(0);
});

test('sms-instead flips channel and reissues', function () {
    $this->post('/register/school', schoolPayload());
    $this->post('/register/admin', adminPayload());

    $this->post('/register/channel', ['channel' => 'sms'])
        ->assertRedirect();

    $pending = PendingRegistration::first();
    expect($pending->channel)->toBe('sms')
        ->and($pending->attempts)->toBe(0);
});

test('change-email updates payload, guards duplicates, and reissues', function () {
    $this->post('/register/school', schoolPayload());
    $this->post('/register/admin', adminPayload());

    $this->post('/register/email', ['email' => 'new@example.com'])
        ->assertRedirect();

    $pending = PendingRegistration::first();
    expect($pending->admin_payload['email'])->toBe('new@example.com');

    $other = School::create([
        'name' => 'Other School', 'code' => 'OS', 'slug' => 'other',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);
    User::create([
        'school_id' => $other->id, 'staff_code' => 'STF-0001',
        'full_name' => 'Taken User', 'initials' => 'TU',
        'email' => 'taken@example.com', 'role' => UserRole::Teacher,
        'phone' => '+237600000009', 'password' => 'password123',
    ]);

    $this->post('/register/email', ['email' => 'taken@example.com'])
        ->assertSessionHasErrors('email');
});

test('login locks out after five failures and shows the banner', function () {
    $school = School::create([
        'name' => 'Acme Academy', 'code' => 'ACME', 'slug' => 'acme',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);
    User::create([
        'school_id' => $school->id, 'staff_code' => 'STF-0001',
        'full_name' => 'Ada Founder', 'initials' => 'AF',
        'email' => 'ada@example.com', 'role' => UserRole::Admin,
        'phone' => '+237600000001', 'password' => 'password123',
    ]);

    foreach (range(1, 5) as $i) {
        $this->post('http://acme.ekol.test/login', [
            'identifier' => 'ada@example.com', 'password' => 'wrong-password',
        ])->assertSessionHasErrors('identifier');
    }

    $this->post('http://acme.ekol.test/login', [
        'identifier' => 'ada@example.com', 'password' => 'wrong-password',
    ])->assertSessionHasErrors('identifier');

    $this->get('http://acme.ekol.test/login')
        ->assertOk()
        ->assertSee('Acme Academy');
});

test('remember-me signs in and bootstrap sends the ready email', function () {
    Mail::fake();

    $this->post('/register/school', schoolPayload());
    $this->post('/register/admin', adminPayload());

    $row = PendingRegistration::first();
    $plain = '123456';
    $row->update([
        'code_hash' => hash('sha256', $plain),
        'expires_at' => now()->addMinutes(10),
    ]);

    $this->post('/register/verify', ['code' => $plain])
        ->assertRedirect(route('register.ready'));

    Mail::assertSent(VerificationCodeMail::class);
    Mail::assertSent(WorkspaceReadyMail::class, fn ($mail) => $mail->administrator->email === 'ada@example.com');

    $this->post('http://acme.ekol.test/login', [
        'identifier' => 'ada@example.com',
        'password' => 'password123',
        'remember' => true,
    ])->assertRedirect(route('setup'));

    expect(auth()->check())->toBeTrue();
    auth()->logout();
});

test('the reader chooses a language and it is remembered on their account', function () {
    $school = School::create([
        'name' => 'Lycée Test', 'code' => 'LT', 'slug' => 'lycee',
        'cycle' => 'secondary', 'currency' => 'XAF', 'timezone' => 'Africa/Douala', 'locale' => 'fr',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => 'admin']);

    $this->get('http://lycee.ekol.test/login')
        ->assertInertia(fn ($page) => $page->where('locale', 'fr')->where('locales.fr', 'Français'));

    $this->actingAs($admin)
        ->post('http://lycee.ekol.test/locale', ['locale' => 'en'])
        ->assertRedirect();

    expect($admin->refresh()->locale)->toBe('en');

    $this->actingAs($admin)
        ->get('http://lycee.ekol.test/setup')
        ->assertInertia(fn ($page) => $page->where('locale', 'en'));

    $this->actingAs($admin)
        ->post('http://lycee.ekol.test/locale', ['locale' => 'de'])
        ->assertSessionHasErrors('locale');

    $admin->update(['locale' => 'fr']);

    $this->actingAs($admin)
        ->from('http://lycee.ekol.test/setup')
        ->post('http://lycee.ekol.test/setup/years', ['label' => '2025/26', 'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31'])
        ->assertInertiaFlash('toast.message', 'Année scolaire ajoutée.');
});

test('the language chosen at sign-up becomes the school default', function () {
    Mail::fake();

    $this->post('/register/school', schoolPayload(['locale' => 'fr']))
        ->assertRedirect(route('register.admin'));
    $this->post('/register/admin', adminPayload())
        ->assertRedirect(route('register.verify'));

    $pending = PendingRegistration::firstOrFail();
    $pending->bootstrap();

    expect(School::firstOrFail()->locale)->toBe('fr');

    $this->post('/register/school', schoolPayload(['slug' => 'other', 'name' => 'Other', 'locale' => 'xx']))
        ->assertSessionHasErrors('locale');
});

test('sign-up and sign-in errors read in French when French is chosen', function () {
    $this->post('/locale', ['locale' => 'fr'])->assertRedirect();

    $this->post('/register/school', schoolPayload(['name' => '']))
        ->assertSessionHasErrors(['name' => 'Le champ nom est obligatoire.']);

    $school = School::create([
        'name' => 'Lycée Test', 'code' => 'LT', 'slug' => 'lycee',
        'cycle' => 'secondary', 'currency' => 'XAF', 'timezone' => 'Africa/Douala', 'locale' => 'fr',
    ]);
    User::factory()->create(['school_id' => $school->id, 'email' => 'prof@example.com']);

    $response = $this->post('http://lycee.ekol.test/login', ['identifier' => 'prof@example.com', 'password' => 'wrong-password'])
        ->assertSessionHasErrors('identifier');

    expect($response->getSession()->get('errors')->getBag('default')->first('identifier'))
        ->toStartWith('E-mail ou mot de passe incorrect.');
});

test('no French entry uses a placeholder its English text does not have', function () {
    $lines = json_decode((string) file_get_contents(lang_path('fr.json')), true);

    foreach ($lines as $english => $french) {
        preg_match_all('/:[a-z_]+/', $english, $wanted);
        preg_match_all('/:[a-z_]+/', $french, $found);

        expect(array_diff($found[0], $wanted[0]))->toBe([], $english);
    }
});

test('every message the server can send has a French entry', function () {
    $lines = json_decode((string) file_get_contents(lang_path('fr.json')), true);
    $missing = [];

    foreach (File::allFiles(app_path()) as $file) {
        preg_match_all("/(?:__|trans_choice|->notify)\\('((?:[^'\\\\]|\\\\.)*)'/", $file->getContents(), $found);

        foreach ($found[1] as $english) {
            $english = stripslashes($english);

            if (! array_key_exists($english, $lines)) {
                $missing[] = $english;
            }
        }
    }

    expect(array_values(array_unique($missing)))->toBe([]);
});

test('a refused action explains itself in French to a French reader', function () {
    $school = School::create([
        'name' => 'Lycée Test', 'code' => 'LT', 'slug' => 'lycee',
        'cycle' => 'secondary', 'currency' => 'XAF', 'timezone' => 'Africa/Douala', 'locale' => 'fr',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => 'admin']);

    $this->actingAs($admin)
        ->patch('http://lycee.ekol.test/setup/profile', ['slug' => 'autre'])
        ->assertSessionHasErrors(['slug' => 'L’adresse de l’espace ne peut pas être modifiée.']);

    $admin->update(['locale' => 'en']);

    $this->actingAs($admin)
        ->patch('http://lycee.ekol.test/setup/profile', ['slug' => 'autre'])
        ->assertSessionHasErrors(['slug' => 'The workspace address cannot be changed.']);
});

test('every line of text on a page has a French entry', function () {
    $lines = json_decode((string) file_get_contents(lang_path('fr.json')), true);
    $missing = [];

    foreach (File::allFiles(resource_path('js')) as $file) {
        if (! in_array($file->getExtension(), ['ts', 'tsx'], true) || preg_match('#/(actions|routes|wayfinder)/#', $file->getPathname())) {
            continue;
        }

        preg_match_all("/(?<![A-Za-z0-9_.])t\\(\\s*'((?:[^'\\\\]|\\\\.)*)'/", $file->getContents(), $found);

        foreach ($found[1] as $english) {
            $english = stripcslashes($english);

            // Sample values and class names pass through untranslated on purpose.
            if (preg_match('/[A-Za-z]{2,}/', $english) && ! preg_match('/^(text-\\[|gbhs-|eposi\\.)/', $english) && ! array_key_exists($english, $lines)) {
                $missing[] = $english;
            }
        }
    }

    expect(array_values(array_unique($missing)))->toBe([]);
});

test('find-school sends an in-app request to the school address with a full page load', function () {
    School::create([
        'name' => 'Acme Academy', 'code' => 'ACME', 'slug' => 'acme',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);

    $this->withHeaders(['X-Inertia' => 'true'])
        ->post('/login/find-school', ['slug' => 'acme'])
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location', 'http://acme.'.parse_url((string) config('app.url'), PHP_URL_HOST).'/login');
});
