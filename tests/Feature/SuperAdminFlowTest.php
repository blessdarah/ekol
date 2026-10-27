<?php

use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Http\Controllers\DemoSchoolController;
use App\Models\AuditEvent;
use App\Models\DemoRequest;
use App\Models\DemoSchoolBuilder;
use App\Models\Invoice;
use App\Models\Mark;
use App\Models\MobilePayment;
use App\Models\School;
use App\Models\SchoolVisit;
use App\Models\Student;
use App\Models\User;
use App\Notifications\PlatformSignInCode;
use BlessDarah\PhpCampay\Campay;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\HttpException;

function platformAdmin(): User
{
    $user = User::factory()->create(['role' => UserRole::Admin, 'school_id' => null]);
    $user->forceFill(['is_platform_admin' => true])->save();

    return $user;
}

function platformSchool(string $slug = 'platform-school'): School
{
    return School::create(['name' => ucfirst($slug), 'code' => 'PS', 'slug' => $slug, 'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
}

function platformDemo(): DemoRequest
{
    return DemoRequest::create(['school_name' => 'St Bedes', 'contact_name' => 'Peter Tanyi', 'role' => 'Principal', 'students' => '300–800', 'whatsapp' => '+237677123456', 'locale' => 'en']);
}

test('platform screens only open on the platform host and school accounts cannot enter', function () {
    $this->get('/platform')->assertNotFound();
    $this->get('http://admin.ekol.test/platform')->assertRedirect('/platform/login');
    $school = platformSchool();
    $staff = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $this->actingAs($staff)->get('http://admin.ekol.test/platform')->assertRedirect('/platform/login');
    $this->actingAs($staff, 'platform')->get('http://admin.ekol.test/platform')->assertRedirect('/platform/login');
    $this->post('http://admin.ekol.test/platform/login', ['email' => $staff->email, 'password' => 'password'])->assertSessionHasErrors('email');
});

test('platform sign in requires the emailed code and consumes it once', function () {
    Notification::fake();
    $admin = platformAdmin();
    $this->post('http://admin.ekol.test/platform/login', ['email' => $admin->email, 'password' => 'password'])->assertRedirect('/platform/login');
    expect(Auth::guard('platform')->check())->toBeFalse();
    $code = Notification::sent($admin, PlatformSignInCode::class)->first()->code;
    $this->post('http://admin.ekol.test/platform/verify', ['code' => '000000'])->assertSessionHasErrors('code');
    $this->post('http://admin.ekol.test/platform/verify', ['code' => $code])->assertRedirect('/platform');
    expect(Auth::guard('platform')->id())->toBe($admin->id);
    $this->post('http://admin.ekol.test/platform/verify', ['code' => $code])->assertSessionHasErrors('code');
});

test('expired platform codes do not authenticate', function () {
    Notification::fake();
    $admin = platformAdmin();
    $this->post('http://admin.ekol.test/platform/login', ['email' => $admin->email, 'password' => 'password']);
    $code = Notification::sent($admin, PlatformSignInCode::class)->first()->code;
    $this->travel(11)->minutes();
    $this->post('http://admin.ekol.test/platform/verify', ['code' => $code])->assertSessionHasErrors('code');
    expect(Auth::guard('platform')->check())->toBeFalse();
});

test('failed email delivery clears the sign in challenge and lets the admin retry', function () {
    $admin = platformAdmin();
    Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('Mail unavailable'));
    $this->from('http://admin.ekol.test/platform/login')->post('http://admin.ekol.test/platform/login', ['email' => $admin->email, 'password' => 'password'])
        ->assertSessionHasErrors('email')->assertSessionMissing('platform_challenge');
    expect(Auth::guard('platform')->check())->toBeFalse();
});

test('school list searches real schools and excludes demo totals', function () {
    $admin = platformAdmin();
    $school = platformSchool('bamenda');
    User::factory()->create(['school_id' => $school->id])->forceFill(['last_signed_in_at' => now()])->save();
    platformSchool('buea');
    platformSchool('sample')->forceFill(['is_demo' => true])->save();
    $this->actingAs($admin, 'platform')->get('http://admin.ekol.test/platform?q=bamenda&status=active')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('platform/schools')->where('counts.all', 2)->has('schools', 1)->where('schools.0.name', 'Bamenda')->where('activeThisWeek', 1));
});

test('the schools panel follows repeated selections including a school without a cycle', function () {
    $admin = platformAdmin();
    $first = platformSchool('first-school');
    $second = platformSchool('second-school');
    $second->update(['cycle' => null]);
    $this->withSession([Auth::guard('platform')->getName() => $admin->id]);
    $initial = $this->get('http://admin.ekol.test/platform')->assertOk();
    $headers = ['X-Inertia' => 'true', 'X-Inertia-Version' => $initial->inertiaPage()['version']];

    foreach ([$first, $second, $first] as $school) {
        Auth::forgetGuards();
        Auth::shouldUse('web');
        $this->get('http://admin.ekol.test/platform?school='.$school->id, $headers)
            ->assertOk()->assertJsonPath('component', 'platform/schools')
            ->assertJsonPath('props.selected.id', $school->id)->assertJsonPath('props.selected.name', $school->name);
    }

    Auth::forgetGuards();
    Auth::shouldUse('web');
    $this->get('http://admin.ekol.test/platform', $headers)
        ->assertOk()->assertJsonPath('props.selected', null);
});

test('a visit uses the platform identity with full school access and records changes and leaving', function () {
    $admin = platformAdmin();
    $school = platformSchool();
    $this->actingAs($admin, 'platform')->post('http://admin.ekol.test/platform/schools/'.$school->id.'/visit')->assertRedirect('/dashboard');
    $visit = SchoolVisit::firstOrFail();
    $this->get('http://admin.ekol.test/setup')->assertOk()->assertInertia(fn (Assert $page) => $page->where('platformVisit.school', $school->name)->where('shellUser.roleLabel', 'Campus super-admin'));
    $this->get('http://admin.ekol.test/staff')->assertOk();
    $otherSchool = platformSchool('another-school');
    $this->post('http://admin.ekol.test/platform/schools/'.$otherSchool->id.'/visit')->assertConflict();
    $this->get('http://admin.ekol.test/staff/'.$admin->id.'/access')->assertForbidden();
    $this->patch('http://admin.ekol.test/setup/profile', [
        'name' => 'Updated school', 'code' => 'PS', 'ownership' => 'private', 'region' => 'North West', 'town' => 'Bamenda',
        'cycle' => 'secondary', 'subsystem' => 'anglophone', 'currency' => 'XAF', 'timezone' => 'Africa/Douala', 'locale' => 'en',
    ])->assertSessionHasNoErrors();
    expect($school->fresh()->name)->toBe('Updated school');
    expect(AuditEvent::where('action', 'visit.changed')->where('actor_id', $admin->id)->firstOrFail()->diff['by'])->toBe('Campus super-admin');
    $this->post('http://admin.ekol.test/platform/leave')->assertRedirect('/platform');
    expect($visit->fresh()->ended_at)->not->toBeNull();
    expect(AuditEvent::where('entity_id', $visit->id)->where('action', 'visit.ended')->count())->toBe(1);
    expect($admin->fresh()->school_id)->toBeNull();
});

test('a platform session enters a school after guards are reloaded for the redirected request', function () {
    $admin = platformAdmin();
    $school = platformSchool();
    $this->withSession([Auth::guard('platform')->getName() => $admin->id])
        ->post('http://admin.ekol.test/platform/schools/'.$school->id.'/visit')
        ->assertRedirect('/dashboard');

    Auth::forgetGuards();
    Auth::shouldUse('web');

    $this->get('http://admin.ekol.test/dashboard')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('platform/school-dashboard')
            ->where('platformVisit.school', $school->name)
            ->where('auth.user.id', $admin->id));

    Auth::forgetGuards();
    Auth::shouldUse('web');

    $this->get('http://admin.ekol.test/staff')->assertOk();
});

test('retrying a visit from the same session resumes it without extending access or duplicating the audit', function () {
    $admin = platformAdmin();
    $school = platformSchool();
    $this->withSession([Auth::guard('platform')->getName() => $admin->id])
        ->post('http://admin.ekol.test/platform/schools/'.$school->id.'/visit')->assertRedirect('/dashboard');
    $visit = SchoolVisit::firstOrFail();
    $this->travel(5)->minutes();
    Auth::forgetGuards();
    Auth::shouldUse('web');
    $this->post('http://admin.ekol.test/platform/schools/'.$school->id.'/visit')->assertRedirect('/dashboard');
    expect(SchoolVisit::count())->toBe(1)
        ->and($visit->fresh()->expires_at->toIso8601String())->toBe($visit->expires_at->toIso8601String())
        ->and(AuditEvent::where('action', 'visit.started')->count())->toBe(1);

    $this->get('http://admin.ekol.test/platform')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('activeVisit.school', $school->name));
});

test('expired visits close before a school action can run and suspended schools remain visitable', function () {
    $admin = platformAdmin();
    $school = platformSchool();
    $school->forceFill(['suspended_at' => now()])->save();
    $this->get('http://platform-school.ekol.test/login')->assertForbidden();
    $this->actingAs($admin, 'platform')->post('http://admin.ekol.test/platform/schools/'.$school->id.'/visit');
    $this->get('http://admin.ekol.test/dashboard')->assertOk();
    $this->travel(61)->minutes();
    $this->post('http://admin.ekol.test/classes/rooms', ['name' => 'Should not exist'])->assertRedirect('/platform');
    expect(SchoolVisit::firstOrFail()->ended_at)->not->toBeNull();
});

test('demo stages create an isolated sample school once and issue a signed link', function () {
    $admin = platformAdmin();
    $demo = platformDemo();
    $base = 'http://admin.ekol.test/platform/demos/'.$demo->id;
    $this->actingAs($admin, 'platform')->post($base, ['action' => 'contact'])->assertSessionHasNoErrors();
    expect($demo->fresh()->status)->toBe('contacted');
    $this->post($base, ['action' => 'create'])->assertSessionHasNoErrors();
    $demo->refresh();
    $school = School::findOrFail($demo->demo_school_id);
    expect($demo->status)->toBe('trying')->and($school->is_demo)->toBeTrue()
        ->and($school->demo_expires_at->toDateString())->toBe(now()->addDays(14)->toDateString())
        ->and(Student::where('school_id', $school->id)->count())->toBe(12)
        ->and(Invoice::count())->toBe(12);
    expect(Mark::count())->toBe(8);
    $this->post($base, ['action' => 'create'])->assertConflict();
    expect(School::count())->toBe(1);
    $this->get('http://admin.ekol.test/platform/demos?status=trying&demo='.$demo->id)->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('platform/demos')->where('selected.status', 'trying')->where('counts.trying', 1)->where('selected.school.slug', $school->slug));
});

test('a visit cannot read another schools student records', function () {
    $admin = platformAdmin();
    $school = platformSchool('first-school');
    $other = platformSchool('other-school');
    $student = Student::create([
        'school_id' => $other->id, 'admission_no' => 'OTHER-01', 'full_name' => 'Private student',
        'gender' => 'male', 'date_of_birth' => '2012-01-01', 'admitted_on' => today(),
        'guardian_name' => 'Guardian', 'guardian_phone' => '677123456',
    ]);
    $this->actingAs($admin, 'platform')->post('http://admin.ekol.test/platform/schools/'.$school->id.'/visit');
    $this->get('http://admin.ekol.test/students/'.$student->id)->assertNotFound();
});

test('demo requests from an ongoing phone number join the existing request', function () {
    $demo = platformDemo();
    $demo->update(['status' => 'contacted']);
    $this->post('/demo', ['school_name' => 'Another spelling', 'contact_name' => 'Peter', 'role' => 'Principal', 'students' => '300–800', 'whatsapp' => '677 12 34 56'])
        ->assertSessionHasNoErrors()->assertSessionHas('demo_booking.school_name', 'Another spelling')->assertSessionMissing('demo_booking.id');
    expect(DemoRequest::count())->toBe(1)->and($demo->fresh()->school_name)->toBe('St Bedes');
});

test('matching a phone number does not grant editing access to another prospects request', function () {
    $demo = platformDemo();
    $data = ['school_name' => 'Different school', 'contact_name' => 'Someone else', 'role' => 'Principal', 'students' => '300–800', 'whatsapp' => '677123456'];
    $this->post('/demo', $data)->assertSessionHasNoErrors();
    $this->post('/demo', [...$data, 'whatsapp' => '677123459'])->assertSessionHasNoErrors();
    expect($demo->fresh()->whatsapp)->toBe('+237677123456')->and($demo->fresh()->school_name)->toBe('St Bedes');
});

test('a demo request can correct its phone number from the same browser', function () {
    $data = ['school_name' => 'St Bedes', 'contact_name' => 'Peter', 'role' => 'Principal', 'students' => '300–800', 'whatsapp' => '677123456'];
    $this->post('/demo', $data)->assertSessionHasNoErrors();
    $this->post('/demo', [...$data, 'whatsapp' => '677123457'])->assertSessionHasNoErrors();
    expect(DemoRequest::count())->toBe(1)->and(DemoRequest::firstOrFail()->whatsapp)->toBe('+237677123457');
});

test('starting a real school from a demo prefills registration without copying sample records', function () {
    $demo = platformDemo();
    $school = app(DemoSchoolBuilder::class)->create($demo);
    $demo->refresh();
    $this->actingAs(User::findOrFail($demo->demo_user_id))->post('http://'.$school->slug.'.ekol.test/demo-start')
        ->assertRedirect();
    $path = URL::temporarySignedRoute('demo-school.register', now()->addHour(), ['demo' => $demo->id], absolute: false);
    $this->get('http://ekol.test'.$path)->assertRedirect('/register');
    $this->get('http://ekol.test/register')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('auth/register-school')->where('prefill.name', 'St Bedes')->where('prefill.phone', '+237677123456'));
    expect(School::where('is_demo', false)->count())->toBe(0);
});

test('demo links require a valid signature and the correct school host then sign in as that demo principal', function () {
    $demo = platformDemo();
    $school = DB::transaction(fn () => app(DemoSchoolBuilder::class)->create($demo));
    $link = DemoSchoolController::link($demo->fresh(), $school);
    $this->get('http://'.$school->slug.'.ekol.test/demo-school/'.$demo->id)->assertForbidden();
    $this->get($link)->assertOk()->assertInertia(fn (Assert $page) => $page->component('platform/demo-welcome')->where('name', 'St Bedes'));
    $path = URL::temporarySignedRoute('demo-school.open', $school->demo_expires_at, ['demo' => $demo->id], absolute: false);
    $this->post('http://'.$school->slug.'.ekol.test'.$path)->assertRedirect('/dashboard');
    expect(Auth::guard('web')->id())->toBe($demo->fresh()->demo_user_id);
    $this->get('http://'.$school->slug.'.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->where('demoSchool.expires', $school->demo_expires_at->toDateString()));
    $this->get('http://'.$school->slug.'.ekol.test/staff/'.$demo->fresh()->demo_user_id.'/access')->assertForbidden();
});

test('demo mobile money cannot reach the gateway', function () {
    $demo = platformDemo();
    $school = app(DemoSchoolBuilder::class)->create($demo);
    $gateway = Mockery::mock(Campay::class);
    $gateway->shouldNotReceive('collect');
    $student = Student::where('school_id', $school->id)->firstOrFail();
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();
    try {
        MobilePayment::start($invoice, $student, 1000, '677123456', $gateway);
        $this->fail('A demo payment must be refused.');
    } catch (HttpException $error) {
        expect($error->getStatusCode())->toBe(403);
    }
    expect(MobilePayment::count())->toBe(0);
});

test('demo extension is limited to once and expired demos close and are deleted a week later', function () {
    $admin = platformAdmin();
    $demo = platformDemo();
    $school = app(DemoSchoolBuilder::class)->create($demo);
    $base = 'http://admin.ekol.test/platform/demos/'.$demo->id;
    $this->actingAs($admin, 'platform')->post($base, ['action' => 'extend'])->assertSessionHasNoErrors();
    expect($school->fresh()->demo_expires_at->toDateString())->toBe(now()->addDays(21)->toDateString());
    $this->post($base, ['action' => 'extend'])->assertConflict();
    $this->travel(22)->days();
    $this->artisan('platform:expire')->assertSuccessful();
    expect($demo->fresh()->status)->toBe('closed');
    $this->get('http://'.$school->slug.'.ekol.test/dashboard')->assertGone();
    $this->travel(7)->days();
    $this->artisan('platform:expire')->assertSuccessful();
    expect(School::withTrashed()->find($school->id))->toBeNull();
    expect(Student::withTrashed()->where('school_id', $school->id)->count())->toBe(0);
    expect($demo->fresh()->demo_school_id)->toBeNull();
});
