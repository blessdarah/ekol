<?php

use App\Actions\Enrolment\ConfirmEnrolment;
use App\Actions\Enrolment\DecideReEnrolment;
use App\Actions\Enrolment\PlaceStudents;
use App\Actions\Fees\BillYearlyFees;
use App\Actions\Fees\GrantInvoiceExemption;
use App\Actions\Fees\RecordFeePayment;
use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;

/** @return array<string, mixed> */
function feeActionWorld(): array
{
    test()->travelTo('2025-10-01 09:00:00');
    $school = School::create([
        'name' => 'Action Academy', 'code' => 'ACT', 'slug' => 'actions',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26', 'status' => AcademicYearStatus::Current,
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31',
    ]);
    $terms = [];
    foreach ([1, 2] as $sequence) {
        $terms[$sequence] = Term::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id,
            'label' => "Term {$sequence}", 'sequence' => $sequence,
            'starts_on' => $sequence === 1 ? '2025-09-01' : '2026-01-01',
            'ends_on' => $sequence === 1 ? '2025-12-19' : '2026-04-01',
            'week_count' => 16, 'is_current' => $sequence === 2,
        ]);
    }
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 1A', 'capacity' => 40,
    ]);
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => 'ACT-25-0001', 'full_name' => 'Achu Brandon',
        'gender' => 'male', 'date_of_birth' => '2013-01-01', 'guardian_name' => 'Guardian',
        'guardian_phone' => '+237670000001', 'admitted_on' => '2025-09-01',
    ]);
    $enrolment = Enrolment::create([
        'student_id' => $student->id, 'academic_year_id' => $year->id,
        'school_class_id' => $class->id, 'level_id' => $level->id, 'status' => EnrolmentStatus::Enrolled,
    ]);
    $plan = FeePlan::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id,
        'annual_amount' => '10000.00', 'currency' => 'XAF', 'is_active' => true,
    ]);

    return compact('school', 'year', 'terms', 'level', 'class', 'student', 'enrolment', 'plan');
}

it('bills the selected term once per year when billing enrolled students without a request', function () {
    $world = feeActionWorld();
    $billing = app(BillYearlyFees::class);

    $billed = $billing->billEnrolled($world['school'], $world['year'], $world['terms'][2], null);
    $repeated = $billing->billEnrolled($world['school'], $world['year'], $world['terms'][1], null);

    expect($billed)->toBe(1);
    expect($repeated)->toBe(0);
    $this->assertDatabaseCount('invoices', 1);
    $this->assertDatabaseHas('invoices', ['student_id' => $world['student']->id, 'term_id' => $world['terms'][2]->id, 'amount_due' => '10000.00']);
    $this->assertDatabaseCount('audit_events', 2);
    expect(AuditEvent::where('action', 'students_billed')->pluck('diff')->all())->toContain(
        ['students' => 1, 'level_id' => null], ['students' => 0, 'level_id' => null],
    );
});

it('bills the first term once for placement even when a later term already has an invoice', function () {
    $world = feeActionWorld();
    $world['plan']->billTo($world['student'], $world['terms'][2]);
    $billing = app(BillYearlyFees::class);

    $billing->billPlacement($world['school'], $world['year'], $world['enrolment']);
    $billing->billPlacement($world['school'], $world['year'], $world['enrolment']);

    $this->assertDatabaseCount('invoices', 2);
    $this->assertDatabaseHas('invoices', ['student_id' => $world['student']->id, 'term_id' => $world['terms'][1]->id, 'amount_due' => '10000.00']);
});

it('rejects a foreign school before an action writes outside request tenancy', function (string $workflow) {
    $world = feeActionWorld();
    $foreign = School::create([
        'name' => 'Foreign Academy', 'code' => 'FOR', 'slug' => 'foreign-actions',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $invoice = $world['plan']->billTo($world['student'], $world['terms'][1]);

    $run = fn () => match ($workflow) {
        'billing' => app(BillYearlyFees::class)->billEnrolled($foreign, $world['year'], $world['terms'][1], null),
        'payment' => app(RecordFeePayment::class)->handle($foreign, $world['student'], $invoice, null, ['amount' => '100.00', 'method' => 'cash', 'date' => '2025-10-01']),
        'exemption' => app(GrantInvoiceExemption::class)->handle($foreign, $invoice, null, ['kind' => 'amount', 'value' => '100.00', 'reason' => 'Support']),
        'decision' => app(DecideReEnrolment::class)->decide($foreign, null, $world['year'], $world['enrolment']->id, EnrolmentDecision::Repeat, null),
        'placement' => app(PlaceStudents::class)->inClass($foreign, $world['year'], $world['class']->id, [$world['enrolment']->id], null),
        'confirmation' => app(ConfirmEnrolment::class)->handle($foreign, null, $world['year'], null),
    };

    expect($run)->toThrow(InvalidArgumentException::class);
    $this->assertDatabaseCount('payments', 0);
    $this->assertDatabaseCount('fee_exemptions', 0);
    $this->assertDatabaseCount('audit_events', 0);
    $this->assertDatabaseCount('invoices', 1);
    expect($world['enrolment']->fresh()->status)->toBe(EnrolmentStatus::Enrolled);
})->with(['billing', 'payment', 'exemption', 'decision', 'placement', 'confirmation']);
