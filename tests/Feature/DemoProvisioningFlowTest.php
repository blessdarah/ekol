<?php

use App\Enums\AssessmentState;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\DemoRequest;
use App\Models\DemoSchoolBuilder;
use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Mark;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

function prepareProspectDemo(string $locale = 'en', string $name = 'St Bede College'): array
{
    $request = DemoRequest::create(['school_name' => $name, 'contact_name' => 'Peter Tanyi', 'role' => 'Principal',
        'students' => '300–800', 'whatsapp' => '+237677123456', 'locale' => $locale]);
    $school = app(DemoSchoolBuilder::class)->create($request);

    return [$request, $school, User::findOrFail($request->demo_user_id), 'http://'.$school->slug.'.ekol.test'];
}

test('the platform prepares one complete sample school without sending messages', function () {
    Mail::fake();
    Notification::fake();
    $admin = User::factory()->create(['role' => UserRole::Admin, 'school_id' => null]);
    $admin->forceFill(['is_platform_admin' => true])->save();
    $request = DemoRequest::create(['school_name' => 'St Bede College', 'contact_name' => 'Peter Tanyi',
        'role' => 'Principal', 'students' => '300–800', 'whatsapp' => '+237677123456', 'locale' => 'en']);

    $this->actingAs($admin, 'platform')->from('http://admin.ekol.test/platform/demos?demo='.$request->id)
        ->post('http://admin.ekol.test/platform/demos/'.$request->id, ['action' => 'create'])
        ->assertSessionHasNoErrors()->assertRedirect();
    $request->refresh();
    $school = School::findOrFail($request->demo_school_id);
    expect($request->status)->toBe('trying');
    expect($school->is_demo)->toBeTrue();
    expect(User::where('school_id', $school->id)->where('role', UserRole::Teacher)->count())->toBe(3);
    expect(SchoolClass::where('school_id', $school->id)->count())->toBe(2);
    expect(Student::where('school_id', $school->id)->count())->toBe(12);
    expect(Term::where('school_id', $school->id)->count())->toBe(3);
    expect(Invoice::count())->toBe(12);
    expect(Invoice::firstOrFail()->lines()->count())->toBe(2);
    expect(Invoice::firstOrFail()->installments()->count())->toBe(3);
    expect(Invoice::where('status', 'paid')->count())->toBe(2);
    expect(Invoice::where('status', 'overdue')->count())->toBeGreaterThan(0);
    Mail::assertNothingOutgoing();
    Notification::assertNothingSent();
});

test('the same preparation can be retried without duplicating or extending the demo', function () {
    $this->freezeTime();
    [$request, $school] = prepareProspectDemo();
    $this->travel(1)->day();
    $retried = app(DemoSchoolBuilder::class)->create($request);
    expect($retried->id)->toBe($school->id);
    expect($retried->demo_expires_at->toDateString())->toBe($school->demo_expires_at->toDateString());
    expect(School::count())->toBe(1);
    expect(Student::count())->toBe(12);
});

test('a preparation failure rolls back the school and every sample record', function () {
    Exceptions::fake();
    $admin = User::factory()->create(['role' => UserRole::Admin, 'school_id' => null]);
    $admin->forceFill(['is_platform_admin' => true])->save();
    $request = DemoRequest::create(['school_name' => 'Rollback College', 'role' => 'Principal', 'students' => '300–800', 'whatsapp' => '+237677123456', 'locale' => 'en']);
    $failOnMark = fn () => throw new RuntimeException('Sample marks unavailable');
    Mark::creating($failOnMark);
    try {
        $this->actingAs($admin, 'platform')->from('http://admin.ekol.test/platform/demos')
            ->post('http://admin.ekol.test/platform/demos/'.$request->id, ['action' => 'create'])
            ->assertRedirect('http://admin.ekol.test/platform/demos')->assertInertiaFlash('toast.type', 'error');
    } finally {
        Mark::flushEventListeners();
    }
    expect(School::count())->toBe(0);
    expect(User::count())->toBe(1);
    expect(Student::count())->toBe(0);
    expect(Invoice::count())->toBe(0);
    expect($request->fresh()->demo_school_id)->toBeNull();
    expect($request->fresh()->status)->toBe('new');
    Exceptions::assertReported(fn (RuntimeException $error) => $error->getMessage() === 'Sample marks unavailable');
    app(DemoSchoolBuilder::class)->create($request);
    expect(School::count())->toBe(1);
});

test('a prospect records a sample payment and opens its printable receipt', function () {
    [$request, $school, $principal, $host] = prepareProspectDemo();
    $student = Student::where('school_id', $school->id)->where('admission_no', 'DEMO-1001')->firstOrFail();
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();
    expect($invoice->ledger()['balance'])->toBe(150000.0);
    $this->actingAs($principal)->post($host.'/fees/students/'.$student->id.'/payments', [
        'invoice_id' => $invoice->id, 'amount' => 10000, 'method' => 'cash', 'date' => today()->toDateString(),
    ])->assertSessionHasNoErrors()->assertRedirect();
    $payment = Payment::where('invoice_id', $invoice->id)->latest('received_at')->firstOrFail();
    expect($invoice->fresh()->ledger()['balance'])->toBe(140000.0);
    $this->get($host.'/fees/payments/'.$payment->id.'/receipt')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('fees/receipt'));
});

test('a prospect completes a mark sheet and can print existing sample report cards', function () {
    [$request, $school, $principal, $host] = prepareProspectDemo();
    $open = AssessmentPlan::where('school_id', $school->id)->where('state', AssessmentState::MarksOpen)->firstOrFail();
    $sheet = $open->sheets()->first();
    $students = Enrolment::where('school_class_id', $sheet->assessment->school_class_id)->pluck('student_id');
    $this->actingAs($principal)->patch($host.'/assessments/sheets/'.$sheet->id, [
        'submit' => true, 'marks' => $students->map(fn ($id) => ['student_id' => $id, 'score' => 15, 'absent' => false, 'remark' => null])->all(),
    ])->assertSessionHasNoErrors();
    expect($sheet->fresh()->submitted_at)->not->toBeNull();
    expect(Mark::where('assessment_subject_id', $sheet->id)->where('score', 15)->count())->toBe(6);
    $published = AssessmentPlan::where('school_id', $school->id)->where('state', AssessmentState::Published)->firstOrFail();
    $class = SchoolClass::where('school_id', $school->id)->firstOrFail();
    $this->get($host.'/assessments/reports/print?plan='.$published->id.'&class='.$class->id)->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('assessments/report-print')->has('cards', 6)->has('cards.0.subjects', 3));
});

test('a prospect generates all sample lessons without teacher room or class clashes', function () {
    [$request, $school, $principal, $host] = prepareProspectDemo();
    $this->actingAs($principal)->post($host.'/timetable/generate', ['options' => []])->assertSessionHasNoErrors();
    $version = TimetableVersion::where('school_id', $school->id)->firstOrFail();
    expect($version->toFix())->toBe(0);
    $slots = TimetableSlot::where('timetable_version_id', $version->id)->get();
    expect($slots)->toHaveCount(20);
    foreach (['staff_id', 'room_id', 'school_class_id'] as $column) {
        expect($slots->map(fn ($slot) => $slot->$column.'|'.$slot->weekday.'|'.$slot->period_id)->duplicates())->toBeEmpty();
    }
});

test('two prospects get separate sample records and cannot open each others students', function () {
    [$first, $school, $principal, $host] = prepareProspectDemo();
    [$second, $other] = prepareProspectDemo('fr', 'Collège La Racine');
    $student = Student::where('school_id', $other->id)->firstOrFail();
    $this->actingAs($principal)->get($host.'/students/'.$student->id)->assertNotFound();
    expect(Student::where('school_id', $school->id)->count())->toBe(12);
    expect(Student::where('school_id', $other->id)->count())->toBe(12);
    expect(SchoolClass::where('school_id', $other->id)->orderBy('name')->pluck('name')->all())->toBe(['5ème A', '6ème A']);
});

test('demo calendars remain usable across year and leap day boundaries', function (string $date) {
    $this->travelTo($date);
    [$request, $school] = prepareProspectDemo();
    $year = AcademicYear::where('school_id', $school->id)->firstOrFail();
    $term = Term::where('school_id', $school->id)->where('is_current', true)->firstOrFail();
    expect(today()->between($year->starts_on, $year->ends_on))->toBeTrue();
    expect(today()->between($term->starts_on, $term->ends_on))->toBeTrue();
    expect($school->demo_expires_at->lte($term->ends_on))->toBeTrue();
    expect(AssessmentPlan::where('school_id', $school->id)->where('state', AssessmentState::MarksOpen)->firstOrFail()->acceptsMarks())->toBeTrue();
})->with(['2026-12-31 12:00:00', '2027-01-01 12:00:00', '2028-02-29 12:00:00']);
