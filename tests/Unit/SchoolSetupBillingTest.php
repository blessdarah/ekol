<?php

use App\Enums\AcademicYearStatus;
use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function billingSchool(): School
{
    return School::create([
        'name' => 'Billing Academy',
        'code' => 'BA',
        'slug' => 'billing',
        'cycle' => SchoolCycle::Secondary,
        'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);
}

function billingYear(School $school): AcademicYear
{
    return AcademicYear::create([
        'school_id' => $school->id,
        'label' => '2025/26',
        'starts_on' => '2025-09-01',
        'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
}

function billingTemplate(School $school, AcademicYear $year, array $percents = [45, 33, 22]): void
{
    foreach ($percents as $index => $percent) {
        FeeInstallmentTemplate::create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'seq' => $index + 1,
            'percent' => $percent,
        ]);
    }
}

function billingParties(School $school, AcademicYear $year): array
{
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 4', 'ordinal' => 4,
        'cycle' => SchoolCycle::Secondary,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-12',
        'week_count' => 15,
    ]);
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => 'ADM-1',
        'full_name' => 'Billed Student', 'gender' => 'male',
        'date_of_birth' => '2012-01-01', 'guardian_name' => 'G',
        'guardian_phone' => '+237600000002', 'admitted_on' => '2025-09-01',
    ]);
    $plan = FeePlan::create([
        'school_id' => $school->id, 'level_id' => $level->id,
        'academic_year_id' => $year->id, 'annual_amount' => '150000.00',
        'currency' => 'XAF',
    ]);

    return [$student, $term, $plan];
}

test('issuing materializes template proportions that sum exactly', function () {
    $school = billingSchool();
    $year = billingYear($school);
    billingTemplate($school, $year);
    [$student, $term, $plan] = billingParties($school, $year);

    $invoice = Invoice::issue($student, $term, $plan, '50000.00', '2025-09-05');

    $amounts = $invoice->installments()->orderBy('seq')->pluck('amount')
        ->map(fn ($amount) => (float) $amount)->all();

    expect($amounts)->toBe([22500.0, 16500.0, 11000.0])
        ->and((float) $invoice->installments()->sum('amount'))->toBe(50000.0);
});

test('rounding remainder lands on the last installment', function () {
    $school = billingSchool();
    $year = billingYear($school);
    billingTemplate($school, $year, [33.33, 33.33, 33.34]);
    [$student, $term, $plan] = billingParties($school, $year);

    $invoice = Invoice::issue($student, $term, $plan, '10000.00', '2025-09-05');

    $amounts = $invoice->installments()->orderBy('seq')->pluck('amount')
        ->map(fn ($amount) => (float) $amount)->all();

    expect($amounts)->toBe([3333.0, 3333.0, 3334.0]);
});

test('payments fill the oldest unpaid installment and move status', function () {
    $school = billingSchool();
    $year = billingYear($school);
    billingTemplate($school, $year);
    [$student, $term, $plan] = billingParties($school, $year);
    $teacher = User::create([
        'school_id' => $school->id, 'staff_code' => 'STF-1',
        'full_name' => 'Cashier', 'initials' => 'CA',
        'email' => 'cashier@example.com', 'role' => UserRole::Accountant,
        'phone' => '+237600000003', 'password' => 'password123',
    ]);

    $invoice = Invoice::issue($student, $term, $plan, '50000.00', '2025-09-05');
    $first = $invoice->installments()->orderBy('seq')->first();

    $payment = $invoice->recordPayment('10000.00', PaymentMethod::Cash, $teacher);

    expect($payment->installment_id)->toBe($first->id)
        ->and($invoice->fresh()->status)->toBe(InvoiceStatus::Partial)
        ->and($invoice->outstanding())->toBe(40000.0);

    $invoice->recordPayment('40000.00', PaymentMethod::Cash, $teacher);

    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Paid)
        ->and($invoice->outstanding())->toBe(0.0);
});

test('explicit installment links directly and overpayment tops up', function () {
    $school = billingSchool();
    $year = billingYear($school);
    billingTemplate($school, $year, [100]);
    [$student, $term, $plan] = billingParties($school, $year);

    $invoice = Invoice::issue($student, $term, $plan, '10000.00', '2025-09-05');
    $only = $invoice->installments()->first();

    $payment = $invoice->recordPayment('10000.00', PaymentMethod::BankTransfer, null, $only->id, 'REF-1');

    expect($payment->installment_id)->toBe($only->id)
        ->and($payment->reference)->toBe('REF-1')
        ->and($invoice->fresh()->status)->toBe(InvoiceStatus::Paid);

    $extra = $invoice->recordPayment('500.00', PaymentMethod::Cash);

    expect($extra->installment_id)->toBeNull();
});

test('assessment window open check follows its bounds', function () {
    $school = billingSchool();
    $year = billingYear($school);
    [$student, $term, $plan] = billingParties($school, $year);

    $open = Assessment::create([
        'school_id' => $school->id, 'term_id' => $term->id,
        'school_class_id' => SchoolClass::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id,
            'level_id' => Level::where('school_id', $school->id)->first()->id,
            'name' => 'Form 4A', 'capacity' => 60,
        ])->id,
        'kind' => AssessmentKind::Sequence, 'name' => 'Seq 1',
        'state' => AssessmentState::MarksOpen,
        'sequence_weight' => '1.0', 'exam_weight' => '0.0',
        'window_starts_on' => today()->subDay()->toDateString(),
        'window_ends_on' => today()->addDay()->toDateString(),
    ]);

    $closed = Assessment::create([
        'school_id' => $school->id, 'term_id' => $term->id,
        'school_class_id' => SchoolClass::where('school_id', $school->id)->first()->id,
        'kind' => AssessmentKind::Sequence, 'name' => 'Seq 0',
        'state' => AssessmentState::MarksClosed,
        'sequence_weight' => '1.0', 'exam_weight' => '0.0',
        'window_starts_on' => today()->subDays(10)->toDateString(),
        'window_ends_on' => today()->subDays(5)->toDateString(),
    ]);

    $unbounded = Assessment::create([
        'school_id' => $school->id, 'term_id' => $term->id,
        'school_class_id' => SchoolClass::where('school_id', $school->id)->first()->id,
        'kind' => AssessmentKind::Exam, 'name' => 'Exam',
        'state' => AssessmentState::Draft,
        'sequence_weight' => '0.0', 'exam_weight' => '1.0',
    ]);

    expect($open->windowOpen())->toBeTrue()
        ->and($closed->windowOpen())->toBeFalse()
        ->and($unbounded->windowOpen())->toBeTrue();
});
