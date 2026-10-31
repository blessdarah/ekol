<?php

use App\Actions\Fees\GrantInvoiceExemption;
use App\Actions\Fees\RemoveInvoiceExemption;
use App\Enums\AcademicYearStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Enums\SchoolCycle;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * @return array{school: School, year: AcademicYear, class: SchoolClass, invoice: Invoice, other: Invoice}
 */
function lifecycleWorld(): array
{
    test()->travelTo('2025-09-01 09:00:00');
    $school = School::create(['name' => 'Lifecycle school', 'code' => 'LC', 'slug' => 'lifecycle', 'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
    $year = AcademicYear::create(['school_id' => $school->id, 'label' => '2025/26', 'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current]);
    $term = Term::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1, 'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19', 'week_count' => 16, 'is_current' => true]);
    $level = Level::create(['school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1, 'cycle' => SchoolCycle::Secondary, 'uses_series' => false]);
    $class = SchoolClass::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => 'Form 1A', 'capacity' => 40]);
    $plan = FeePlan::create(['school_id' => $school->id, 'level_id' => $level->id, 'academic_year_id' => $year->id, 'annual_amount' => '100.00', 'currency' => 'XAF', 'is_active' => true]);
    $invoices = [];
    foreach (['A', 'B'] as $name) {
        $student = Student::create(['school_id' => $school->id, 'admission_no' => 'LC-'.$name, 'full_name' => 'Student '.$name, 'gender' => 'male', 'date_of_birth' => '2013-01-01', 'guardian_name' => 'Guardian', 'guardian_phone' => '670000000', 'admitted_on' => '2025-09-01']);
        $invoices[] = Invoice::issue($student, $term, $plan, '100.00');
    }

    return ['school' => $school, 'year' => $year, 'class' => $class, 'invoice' => $invoices[0], 'other' => $invoices[1]];
}

test('direct payment saves and deletion maintain invoice status without a controller', function () {
    ['invoice' => $invoice] = lifecycleWorld();
    $invoice->load('payments', 'exemption');
    $payment = $invoice->payments()->create(['amount' => '100.00', 'method' => PaymentMethod::Cash, 'received_at' => now()]);
    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Paid);

    $payment->update(['amount' => '25.00']);
    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Partial);

    $payment->delete();
    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Pending);
});

test('moving a payment recalculates both invoices with another tenant bound', function () {
    ['invoice' => $invoice, 'other' => $other] = lifecycleWorld();
    $payment = $invoice->payments()->create(['amount' => '100.00', 'method' => PaymentMethod::Cash, 'received_at' => now()]);
    $foreign = School::create(['name' => 'Other school', 'code' => 'OT', 'slug' => 'other-lifecycle', 'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
    app()->instance('currentSchool', $foreign);
    try {
        $payment->update(['invoice_id' => $other->id]);
        expect(Invoice::withoutGlobalScope('school')->findOrFail($invoice->id)->status)->toBe(InvoiceStatus::Pending);
        expect(Invoice::withoutGlobalScope('school')->findOrFail($other->id)->status)->toBe(InvoiceStatus::Paid);
    } finally {
        app()->forgetInstance('currentSchool');
    }
});

test('direct exemption saves moves and deletion recalculate affected invoices', function () {
    ['invoice' => $invoice, 'other' => $other] = lifecycleWorld();
    $invoice->load('payments', 'exemption');
    $exemption = $invoice->exemption()->create(['kind' => 'amount', 'amount' => '100.00', 'reason' => 'Scholarship']);
    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Paid);

    $exemption->update(['amount' => '25.00']);
    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Pending);

    $exemption->update(['invoice_id' => $other->id, 'amount' => '100.00']);
    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Pending);
    expect($other->fresh()->status)->toBe(InvoiceStatus::Paid);

    $exemption->delete();
    expect($other->fresh()->status)->toBe(InvoiceStatus::Pending);
});

test('recorded payments refresh the callers loaded ledger and status', function () {
    ['invoice' => $invoice] = lifecycleWorld();
    $invoice->load('payments', 'exemption');
    $invoice->recordPayment('100.00', PaymentMethod::Cash);

    expect($invoice->status)->toBe(InvoiceStatus::Paid);
    expect($invoice->ledgerMinor()['balance'])->toBe(0);
});

test('form-master flags follow assignments and all class deletion paths', function () {
    ['school' => $school, 'class' => $class] = lifecycleWorld();
    $first = User::factory()->create(['school_id' => $school->id, 'is_form_master' => false]);
    $second = User::factory()->create(['school_id' => $school->id, 'is_form_master' => false]);
    $class->update(['form_master_id' => $first->id]);
    expect($first->fresh()->is_form_master)->toBeTrue();

    $another = $class->replicate();
    $another->name = 'Form 1B';
    $another->save();
    $class->update(['form_master_id' => $second->id]);
    expect($first->fresh()->is_form_master)->toBeTrue();
    expect($second->fresh()->is_form_master)->toBeTrue();

    $another->delete();
    expect($first->fresh()->is_form_master)->toBeFalse();
    $another->restore();
    expect($first->fresh()->is_form_master)->toBeTrue();
    $another->forceDelete();
    expect($first->fresh()->is_form_master)->toBeFalse();
    expect($second->fresh()->is_form_master)->toBeTrue();
    $class->update(['form_master_id' => null]);
    expect($second->fresh()->is_form_master)->toBeFalse();
});

test('model side effects and explicit audits roll back with their workflow', function () {
    ['school' => $school, 'invoice' => $invoice, 'class' => $class] = lifecycleWorld();
    $actor = User::factory()->create(['school_id' => $school->id, 'is_form_master' => false]);
    try {
        DB::transaction(function () use ($school, $invoice, $class, $actor): void {
            $invoice->exemption()->create(['kind' => 'amount', 'amount' => '100.00', 'reason' => 'Scholarship']);
            $class->update(['form_master_id' => $actor->id]);
            AuditEvent::record($school, $actor, 'invoice', $invoice->id, 'exempted', ['amount' => '100.00']);
            throw new RuntimeException('Rollback workflow');
        });
    } catch (RuntimeException $exception) {
        expect($exception->getMessage())->toBe('Rollback workflow');
    }

    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Pending);
    expect($invoice->exemption()->exists())->toBeFalse();
    expect($actor->fresh()->is_form_master)->toBeFalse();
    expect(AuditEvent::where('entity_id', $invoice->id)->count())->toBe(0);
});

test('exemption workflows refresh the supplied invoice for immediate ledger reads', function () {
    ['school' => $school, 'invoice' => $invoice] = lifecycleWorld();
    $invoice->load('payments', 'exemption');
    app(GrantInvoiceExemption::class)->handle($school, $invoice, null, ['kind' => 'amount', 'value' => '100.00', 'reason' => 'Scholarship']);
    expect($invoice->status)->toBe(InvoiceStatus::Paid);
    expect($invoice->ledgerMinor()['balance'])->toBe(0);

    app(RemoveInvoiceExemption::class)->handle($school, $invoice, null);
    expect($invoice->status)->toBe(InvoiceStatus::Pending);
    expect($invoice->ledgerMinor()['balance'])->toBe(10000);
});

test('creating an assigned class updates its master independently of request tenancy', function () {
    ['school' => $school, 'class' => $class] = lifecycleWorld();
    $teacher = User::factory()->create(['school_id' => $school->id, 'is_form_master' => false]);
    $foreign = School::create(['name' => 'Other school', 'code' => 'OT', 'slug' => 'other-class-lifecycle', 'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
    app()->instance('currentSchool', $foreign);
    try {
        $assigned = SchoolClass::create([...$class->only(['school_id', 'academic_year_id', 'level_id', 'capacity']), 'name' => 'Form 1B', 'form_master_id' => $teacher->id]);
        expect($teacher->fresh()->is_form_master)->toBeTrue();
        $assigned->delete();
        expect($teacher->fresh()->is_form_master)->toBeFalse();
    } finally {
        app()->forgetInstance('currentSchool');
    }
});
