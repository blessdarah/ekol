<?php

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\PaymentMethod;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;

/**
 * A school with one of everything a record page shows: a student
 * enrolled and billed with a payment, a subject and a staff member.
 *
 * @return array{school: School, admin: User, student: Student, invoice: Invoice, payment: Payment, subject: Subject, teacher: User}
 */
function tenantWorld(string $slug): array
{
    $school = School::create([
        'name' => "Academy {$slug}", 'code' => strtoupper(substr($slug, 0, 4)), 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $teacher = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Teacher]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26', 'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19', 'week_count' => 16, 'is_current' => true,
    ]);
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => 'Form 1A', 'capacity' => 40,
    ]);
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => strtoupper($slug).'-25-0001', 'full_name' => "Student of {$slug}",
        'gender' => 'female', 'date_of_birth' => '2013-01-01', 'guardian_name' => 'Guardian', 'guardian_phone' => '+237670000001',
        'admitted_on' => '2025-09-01',
    ]);
    Enrolment::create([
        'student_id' => $student->id, 'academic_year_id' => $year->id, 'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled,
    ]);
    $plan = FeePlan::create([
        'school_id' => $school->id, 'level_id' => $level->id, 'academic_year_id' => $year->id, 'annual_amount' => '60000.00', 'currency' => 'XAF',
    ]);
    $invoice = Invoice::create([
        'student_id' => $student->id, 'term_id' => $term->id, 'fee_plan_id' => $plan->id, 'amount_due' => '60000.00', 'issued_on' => '2025-09-05',
    ]);
    $payment = Payment::create(['invoice_id' => $invoice->id, 'amount' => '20000.00', 'method' => PaymentMethod::Cash, 'received_by' => $admin->id]);
    $subject = Subject::create([
        'school_id' => $school->id, 'code' => 'MATH-101', 'name' => 'Mathematics', 'department' => 'Sciences', 'weekly_periods' => 5, 'coefficient' => 4,
    ]);

    return compact('school', 'admin', 'student', 'invoice', 'payment', 'subject', 'teacher');
}

test('invoices and payments take their school from the student, even outside a request', function () {
    $world = tenantWorld('tenanta');

    expect($world['invoice']->school_id)->toBe($world['school']->id)
        ->and($world['payment']->school_id)->toBe($world['school']->id);
});

test('while a school is bound, tenant queries see only that school and new rows join it', function () {
    $first = tenantWorld('tenanta');
    $second = tenantWorld('tenantb');

    expect(Student::count())->toBe(2)
        ->and(Invoice::count())->toBe(2);

    app()->instance('currentSchool', $first['school']);

    expect(Student::pluck('id')->all())->toBe([$first['student']->id])
        ->and(Invoice::pluck('id')->all())->toBe([$first['invoice']->id])
        ->and(Payment::pluck('id')->all())->toBe([$first['payment']->id])
        ->and(Subject::whereKey($second['subject']->id)->exists())->toBeFalse()
        ->and(Student::withoutGlobalScope('school')->count())->toBe(2)
        ->and(User::whereKey($second['admin']->id)->exists())->toBeTrue()
        ->and(Subject::create(['code' => 'ENG-101', 'name' => 'English', 'department' => 'Languages', 'weekly_periods' => 4, 'coefficient' => 3])->school_id)
        ->toBe($first['school']->id);

    app()->forgetInstance('currentSchool');
});

test('a request leaves no school bound behind it', function () {
    $world = tenantWorld('tenanta');
    tenantWorld('tenantb');

    $this->actingAs($world['admin'])->get('http://tenanta.ekol.test/students')->assertOk();

    expect(app()->bound('currentSchool'))->toBeFalse()
        ->and(Student::count())->toBe(2);
});

test('another school’s records are not found from this school', function () {
    $mine = tenantWorld('tenanta');
    $theirs = tenantWorld('tenantb');

    $pages = [
        "/students/{$theirs['student']->id}",
        "/students/{$theirs['student']->id}/fees",
        "/students/{$theirs['student']->id}/academics",
        "/students/{$theirs['student']->id}/attendance",
        "/fees/students/{$theirs['student']->id}",
        "/fees/payments/{$theirs['payment']->id}/receipt",
        "/staff/{$theirs['teacher']->id}",
        "/classes/subjects/{$theirs['subject']->id}",
    ];

    foreach ($pages as $page) {
        $this->actingAs($mine['admin'])
            ->get("http://tenanta.ekol.test{$page}")
            ->assertNotFound();
    }

    $this->actingAs($mine['admin'])
        ->post("http://tenanta.ekol.test/fees/students/{$theirs['student']->id}/payments", [
            'invoice_id' => $theirs['invoice']->id, 'amount' => 1000, 'method' => 'cash', 'date' => today()->toDateString(),
        ])
        ->assertNotFound();

    expect(Payment::withoutGlobalScope('school')->where('invoice_id', $theirs['invoice']->id)->count())->toBe(1);
});
