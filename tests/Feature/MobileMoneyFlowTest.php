<?php

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeeInstallmentTemplate;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\MobilePayment;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use App\Notifications\ParentVerificationCode;
use BlessDarah\PhpCampay\Campay;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Psr\Http\Message\RequestInterface;
use Undjike\CamooNotificationChannel\CamooChannel;

/**
 * A school on 1 October 2025 billing 60 000 FCFA in installments of
 * 50/30/20, with one student whose guardian pays from 677 12 34 56.
 *
 * @return array{school: School, admin: User, student: Student, invoice: Invoice}
 */
function momoWorld(): array
{
    test()->travelTo('2025-10-01 09:00:00');
    Notification::fake();

    $school = School::create([
        'name' => 'Academy momo', 'code' => 'GBHS', 'slug' => 'momo',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
    Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19',
        'week_count' => 16, 'is_current' => true,
    ]);

    foreach ([[1, 50, '2025-09-15'], [2, 30, '2025-11-15'], [3, 20, '2026-01-15']] as [$seq, $percent, $due]) {
        FeeInstallmentTemplate::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id,
            'seq' => $seq, 'percent' => $percent, 'due_on' => $due,
        ]);
    }

    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 1 A', 'capacity' => 40,
    ]);
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => 'GBHS-25-0001',
        'full_name' => 'Achu Brandon', 'gender' => 'male', 'date_of_birth' => '2013-01-01',
        'guardian_name' => 'Mr. Achu', 'guardian_phone' => '+237 677 12 34 56', 'admitted_on' => '2025-09-01',
    ]);
    Enrolment::create([
        'student_id' => $student->id, 'academic_year_id' => $year->id,
        'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled,
    ]);

    test()->actingAs($admin)
        ->patch('http://momo.ekol.test/fees/structure', [
            'year_id' => $year->id,
            'items' => [['id' => null, 'name' => 'School fees', 'spread' => true, 'new_only' => false, 'amounts' => [$level->id => 60000]]],
        ])
        ->assertSessionHasNoErrors();
    test()->post('http://momo.ekol.test/fees/structure/bill', ['year_id' => $year->id])->assertSessionHasNoErrors();
    auth()->logout();

    return ['school' => $school, 'admin' => $admin, 'student' => $student, 'invoice' => Invoice::where('student_id', $student->id)->firstOrFail()];
}

/**
 * Stand in for Campay: collections get references REF-1, REF-2…, and the
 * status it reports is whatever the test sets.
 *
 * @return ArrayObject<string, mixed>
 */
function fakeCampay(string $status = 'PENDING', ?string $reason = null, int $collectStatus = 200): ArrayObject
{
    $state = new ArrayObject(['status' => $status, 'reason' => $reason, 'collects' => [], 'checks' => 0]);
    $handler = function (RequestInterface $request) use ($state, $collectStatus) {
        $path = $request->getUri()->getPath();

        if (str_ends_with($path, '/token/')) {
            return Create::promiseFor(new Response(200, [], json_encode(['token' => 'test-token'])));
        }

        if (str_ends_with($path, '/collect/')) {
            parse_str((string) $request->getBody(), $form);
            $state['collects'] = [...$state['collects'], $form ?: json_decode((string) $request->getBody(), true)];

            if ($collectStatus !== 200) {
                return Create::rejectionFor(new ClientException(
                    'Bad request',
                    $request,
                    new Response($collectStatus, [], json_encode(['message' => 'Amount above the demo limit'])),
                ));
            }

            return Create::promiseFor(new Response(200, [], json_encode(['reference' => 'REF-'.count($state['collects']), 'ussd_code' => '*126#', 'operator' => 'MTN'])));
        }

        $state['checks']++;

        return Create::promiseFor(new Response(200, [], json_encode(array_filter([
            'reference' => basename($path), 'status' => $state['status'], 'amount' => 30000,
            'operator' => 'MTN', 'operator_reference' => 'MP251001.0912.A1', 'reason' => $state['reason'],
        ]))));
    };

    app()->instance(Campay::class, new Campay('user', 'secret', Campay::DEMO_BASE_URL, new Client(['handler' => $handler])));

    return $state;
}

/**
 * Walk a parent through finding the child and choosing an amount.
 */
function startPaying(int $amount, string $phone = '677123456'): void
{
    findChild();
    test()->post('http://ekol.test/parents/pay', ['amount' => $amount])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('parents.pay.phone'));
    test()->post('http://ekol.test/parents/pay/phone', ['phone' => $phone])->assertSessionHasNoErrors();
}

/**
 * Prove to parent services that the child is ours: the details, then
 * the code texted to the guardian phone.
 */
function findChild(): void
{
    test()->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'gbhs-25-0001', 'phone' => '6 77 12 34 56'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('parents.verify'));
    test()->post('http://ekol.test/parents/verify', ['code' => lastCode()])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('parents.home'));
}

/**
 * The code in the latest SMS sent to the guardian phone.
 */
function lastCode(): string
{
    $code = null;

    Notification::assertSentOnDemand(ParentVerificationCode::class, function (ParentVerificationCode $notification, array $channels, AnonymousNotifiable $notifiable) use (&$code) {
        $code = $notification->code;

        return $notification instanceof ShouldQueue
            && $notifiable->routes[CamooChannel::class] === '+237677123456';
    });

    return (string) $code;
}

test('parents start on the main address and find the school by name or town', function () {
    momoWorld();
    School::whereSlug('momo')->update(['town' => 'Bamenda']);

    $this->get('http://ekol.test/parents?school=momo')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('parents/start')
            ->where('school.name', 'Academy momo')
            ->where('services', ['pay', 'attendance', 'announcements']));

    $this->getJson('http://ekol.test/parents/schools?q=bamen')
        ->assertOk()
        ->assertJsonPath('schools.0.slug', 'momo')
        ->assertJsonPath('schools.0.place', 'Bamenda');
    $this->getJson('http://ekol.test/parents/schools?q=a')->assertJsonCount(0, 'schools');

    $this->get('http://momo.ekol.test/pay')->assertRedirect('//ekol.test/parents?school=momo');
});

test('a parent finds their child by matricule and the phone the school has', function () {
    momoWorld();

    $this->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'GBHS-25-0001', 'phone' => '699000000'])
        ->assertSessionHasErrors('matricule');
    $this->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'GBHS-25-9999', 'phone' => '677123456'])
        ->assertSessionHasErrors('matricule');
    $this->post('http://ekol.test/parents', ['school' => 'nowhere', 'matricule' => 'GBHS-25-0001', 'phone' => '677123456'])
        ->assertSessionHasErrors('school');
    $this->get('http://ekol.test/parents/home')->assertRedirect(route('parents'));
    $this->get('http://ekol.test/parents/pay')->assertRedirect(route('parents'));

    $this->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'gbhs-25-0001', 'phone' => '+237 677 123 456'])
        ->assertRedirect(route('parents.verify'));
    $this->get('http://ekol.test/parents/home')->assertRedirect(route('parents'));
    $this->post('http://ekol.test/parents/verify', ['code' => lastCode()])->assertRedirect(route('parents.home'));

    $this->get('http://ekol.test/parents/home')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('parents/home')
            ->where('student.name', 'Achu Brandon')
            ->where('fees.balance', 60000)
            ->where('fees.overdue', 30000)
            ->where('attendance.term', 'Term 1'));

    $this->get('http://ekol.test/parents/pay')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('pay/amount')
            ->where('student.class', 'Form 1 A')
            ->where('balance', 60000)
            ->where('options.0.key', 'overdue')
            ->where('options.0.amount', 30000)
            ->where('options.1.key', 'all')
            ->where('options.1.amount', 60000));

    $this->post('http://ekol.test/parents/pay', ['amount' => 70000])->assertSessionHasErrors('amount');

    $this->post('http://ekol.test/parents/leave')->assertRedirect(route('parents'));
    $this->get('http://ekol.test/parents/home')->assertRedirect(route('parents'));
});

test('a wrong, late or overused code keeps parent services closed', function () {
    momoWorld();

    $this->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'GBHS-25-0001', 'phone' => '677123456']);
    $code = lastCode();

    $this->get('http://ekol.test/parents/verify')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('parents/verify')->where('phone', '6•• ••• •56'));

    $this->post('http://ekol.test/parents/verify', ['code' => $code === '111111' ? '222222' : '111111'])->assertSessionHasErrors('code');
    $this->get('http://ekol.test/parents/home')->assertRedirect(route('parents'));

    $this->post('http://ekol.test/parents/verify/resend')->assertSessionHasErrors('code');
    $this->travel(11)->minutes();
    $this->post('http://ekol.test/parents/verify', ['code' => $code])->assertSessionHasErrors('code');

    $this->post('http://ekol.test/parents/verify/resend')->assertRedirect(route('parents.verify'));
    $fresh = lastCode();
    foreach (range(1, 5) as $attempt) {
        $this->post('http://ekol.test/parents/verify', ['code' => $fresh === '111111' ? '222222' : '111111']);
    }
    $this->post('http://ekol.test/parents/verify', ['code' => $fresh])->assertSessionHasErrors('code');
    $this->get('http://ekol.test/parents/home')->assertRedirect(route('parents'));
});

test('a phone that typed the code is remembered for the child and codes are capped', function () {
    momoWorld();
    $student = Student::sole();

    $this->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'GBHS-25-0001', 'phone' => '677123456']);
    $this->post('http://ekol.test/parents/verify', ['code' => lastCode()])->assertCookie('parent_trust');

    $this->post('http://ekol.test/parents/leave');
    foreach (range(1, 4) as $attempt) {
        $this->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'GBHS-25-0001', 'phone' => '677123456'])
            ->assertRedirect(route('parents.verify'));
    }
    $this->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'GBHS-25-0001', 'phone' => '677123456'])
        ->assertSessionHasErrors('matricule');
    Notification::assertSentOnDemandTimes(ParentVerificationCode::class, 5);

    $this->withCookie('parent_trust', json_encode([hash('sha256', $student->id.'|677123456')]))
        ->post('http://ekol.test/parents', ['school' => 'momo', 'matricule' => 'GBHS-25-0001', 'phone' => '677123456'])
        ->assertRedirect(route('parents.home'));
    Notification::assertSentOnDemandTimes(ParentVerificationCode::class, 5);
});

test('a parent opens the attendance of the current term', function () {
    $world = momoWorld();
    findChild();

    $this->get('http://ekol.test/parents/attendance')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('parents/attendance')
            ->where('termLabel', 'Term 1')
            ->where('stats.days', 0)
            ->where('events', []));
});

test('an approved request is recorded once on the invoice with a receipt', function () {
    $world = momoWorld();
    $campay = fakeCampay('PENDING');

    startPaying(30000);

    $request = MobilePayment::firstOrFail();
    expect($request->status)->toBe(MobilePayment::PENDING)
        ->and($request->reference)->toBe('REF-1')
        ->and($request->operator)->toBe('MTN')
        ->and($campay['collects'][0]['amount'])->toBe('30000')
        ->and($campay['collects'][0]['from'])->toBe('237677123456');

    $this->travel(5)->seconds();
    $this->get("http://ekol.test/parents/pay/requests/{$request->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('pay/status')->where('payment.state', 'waiting'));

    $campay['status'] = 'SUCCESSFUL';
    $this->travel(5)->seconds();
    $this->get("http://ekol.test/parents/pay/requests/{$request->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('pay/status')
            ->where('payment.state', 'paid')
            ->where('payment.receipt', 'RC-25-0001')
            ->where('payment.went_to.0.amount', 30000)
            ->where('balance', 30000));

    $this->travel(5)->seconds();
    $request->refresh()->refreshStatus(app(Campay::class));
    $this->artisan('payments:check-mobile')->assertSuccessful();

    $payment = Payment::sole();
    $this->get("http://ekol.test/parents/receipts/{$payment->id}")
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('pay/receipt')
        ->where('receipt.kind', 'digital')
        ->where('receipt.method', 'MTN Mobile Money')
        ->where('receipt.paid_from', '677123456')
        ->where('receipt.reference', 'MP251001.0912.A1'));

    $receipt = $this->get("http://ekol.test/parents/receipts/{$payment->id}");
    $this->get($receipt->inertiaProps('receipt.verification_url'))
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('fees/receipt-verify')
        ->where('receipt.reference', 'MP251001.0912.A1')
        ->missing('student')->missing('receipt.paid_from'));

    expect((float) $payment->amount)->toBe(30000.0)
        ->and($payment->reference)->toBe('MP251001.0912.A1')
        ->and($request->refresh()->payment_id)->toBe($payment->id)
        ->and($world['invoice']->refresh()->ledger()['balance'])->toBe(30000.0);
});

test('a declined request records nothing and can be sent again', function () {
    momoWorld();
    $campay = fakeCampay('FAILED', 'Insufficient balance');

    startPaying(30000);
    $request = MobilePayment::firstOrFail();

    $this->travel(5)->seconds();
    $this->get("http://ekol.test/parents/pay/requests/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page->where('payment.state', 'failed')->where('payment.reason', 'insufficient'));
    expect(Payment::count())->toBe(0);

    $campay['status'] = 'PENDING';
    $this->post("http://ekol.test/parents/pay/requests/{$request->id}/retry")
        ->assertRedirect();

    expect(MobilePayment::count())->toBe(2)
        ->and(MobilePayment::latest()->first()->status)->toBe(MobilePayment::PENDING);
});

test('a request Campay refuses is closed as rejected with Campay’s answer in the log', function () {
    momoWorld();
    fakeCampay(collectStatus: 400);
    Log::spy();

    startPaying(30000);

    expect(MobilePayment::sole()->status)->toBe(MobilePayment::FAILED)
        ->and(MobilePayment::sole()->failure_reason)->toBe('rejected');
    Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $context) => str_contains((string) $context['campay'], 'demo limit'));
});

test('a request nobody approves is closed as timed out by the scheduled check', function () {
    momoWorld();
    fakeCampay('PENDING');

    startPaying(30000);

    $this->travel(MobilePayment::GIVE_UP_MINUTES + 1)->minutes();
    $this->artisan('payments:check-mobile')->assertSuccessful();

    expect(MobilePayment::sole()->status)->toBe(MobilePayment::FAILED)
        ->and(MobilePayment::sole()->failure_reason)->toBe('timeout')
        ->and(Payment::count())->toBe(0);
});

test('only mobile money numbers are accepted', function () {
    momoWorld();
    fakeCampay();

    findChild();
    $this->post('http://ekol.test/parents/pay', ['amount' => 30000]);

    $this->post('http://ekol.test/parents/pay/phone', ['phone' => '222123456'])->assertSessionHasErrors('phone');
    $this->post('http://ekol.test/parents/pay/phone', ['phone' => '69912345'])->assertSessionHasErrors('phone');
    expect(MobilePayment::count())->toBe(0);
});

test('the bursar sees mobile money requests and can check one that is waiting', function () {
    $world = momoWorld();
    $campay = fakeCampay('PENDING');

    startPaying(30000);
    $request = MobilePayment::firstOrFail();

    $this->actingAs($world['admin'])
        ->get('http://momo.ekol.test/fees/mobile-money')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('fees/mobile-money')
            ->where('totals.waiting', 1)
            ->where('requests.rows.0.status', 'pending')
            ->where('requests.rows.0.student.name', 'Achu Brandon'));

    $campay['status'] = 'SUCCESSFUL';
    $this->actingAs($world['admin'])
        ->post("http://momo.ekol.test/fees/mobile-money/{$request->id}/check")
        ->assertRedirect();

    expect($request->refresh()->status)->toBe(MobilePayment::SUCCESSFUL)
        ->and(Payment::count())->toBe(1);

    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);
    $this->actingAs($teacher)->get('http://momo.ekol.test/fees/mobile-money')->assertForbidden();
});

test('parents can open their child receipt but cannot open another childs receipt', function () {
    $world = momoWorld();
    $payment = $world['invoice']->recordPayment('30000.00', 'cash', $world['admin']);
    $session = ['parent' => ['school_id' => $world['school']->id, 'student_id' => $world['student']->id]];

    $this->withSession($session)->get("http://ekol.test/parents/receipts/{$payment->id}")
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('pay/receipt')->where('student.name', 'Achu Brandon')
        ->where('receipt.balance', 30000)->where('receipt.state', 'partial'));
    $other = Student::create([
        'school_id' => $world['school']->id, 'admission_no' => 'OTHER', 'full_name' => 'Other Child',
        'gender' => 'male', 'date_of_birth' => '2013-01-01', 'guardian_name' => 'Another Guardian',
        'guardian_phone' => '+237670000000', 'admitted_on' => '2025-09-01',
    ]);
    $this->withSession(['parent' => ['school_id' => $world['school']->id, 'student_id' => $other->id]])
        ->get("http://ekol.test/parents/receipts/{$payment->id}")->assertNotFound();
    $this->withSession(['parent' => null])->get("http://ekol.test/parents/receipts/{$payment->id}")
        ->assertRedirect(route('parents'));
});

test('mobile payment choices never round a fractional balance upward', function () {
    $world = momoWorld();
    $world['invoice']->recordPayment('59969.20', 'cash');
    findChild();

    $this->get('http://ekol.test/parents/pay')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('balance', 30.8)->where('options.0.amount', 30));
    $this->post('http://ekol.test/parents/pay', ['amount' => 31])->assertSessionHasErrors('amount');
    $this->post('http://ekol.test/parents/pay', ['amount' => 30])->assertSessionHasNoErrors();

    $world['invoice']->recordPayment('30.00', 'cash');
    $this->get('http://ekol.test/parents/pay')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('balance', 0.8)->has('options', 0));
    $this->post('http://ekol.test/parents/pay', ['amount' => 1])->assertSessionHasErrors('amount');
});
