<?php

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\InvoiceStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A school on 1 October 2025 with two levels, one class in each, three
 * enrolled students and installments of 50/30/20 due in September,
 * November and January.
 *
 * @return array<string, mixed>
 */
function feeWorld(string $slug = 'feesa'): array
{
    test()->travelTo('2025-10-01 09:00:00');

    $school = School::create([
        'name' => "Academy {$slug}", 'code' => 'GBHS', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
    $term = Term::create([
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

    $levels = [];
    $classes = [];

    foreach ([1, 2] as $ordinal) {
        $levels[$ordinal] = Level::create([
            'school_id' => $school->id, 'name' => "Form {$ordinal}", 'code' => "F{$ordinal}", 'ordinal' => $ordinal,
            'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
        ]);
        $classes[$ordinal] = SchoolClass::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id,
            'level_id' => $levels[$ordinal]->id, 'name' => "Form {$ordinal} A", 'capacity' => 40,
        ]);
    }

    $students = [];

    foreach ([['Achu Brandon', 1], ['Bih Glory', 1], ['Che Emmanuel', 2]] as $index => [$name, $form]) {
        $students[] = $student = Student::create([
            'school_id' => $school->id, 'admission_no' => 'GBHS-25-000'.($index + 1),
            'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2013-01-01',
            'guardian_name' => 'Mr. Guardian', 'guardian_phone' => '+23767000000'.$index, 'admitted_on' => '2025-09-01',
        ]);
        Enrolment::create([
            'student_id' => $student->id, 'academic_year_id' => $year->id,
            'school_class_id' => $classes[$form]->id, 'status' => EnrolmentStatus::Enrolled,
        ]);
    }

    return compact('school', 'admin', 'year', 'term', 'levels', 'classes', 'students');
}

function setFees(array $world, array $amounts): void
{
    test()->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', ['year_id' => $world['year']->id, 'amounts' => $amounts])
        ->assertSessionHasNoErrors();
}

function billEveryone(array $world): void
{
    test()->actingAs($world['admin'])
        ->post('http://feesa.ekol.test/fees/structure/bill', ['year_id' => $world['year']->id])
        ->assertSessionHasNoErrors();
}

test('only fee roles open fees', function () {
    $world = feeWorld();
    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);
    $bursar = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Bursar]);

    $this->actingAs($teacher)->get('http://feesa.ekol.test/fees')->assertForbidden();
    $this->actingAs($teacher)->get('http://feesa.ekol.test/fees/structure')->assertForbidden();
    $this->actingAs($bursar)->get('http://feesa.ekol.test/fees')->assertOk();
});

test('the fee structure sets what each level costs for the year', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000, $world['levels'][2]->id => '']);

    $plan = FeePlan::firstOrFail();
    expect(FeePlan::count())->toBe(1)
        ->and($plan->level_id)->toBe($world['levels'][1]->id)
        ->and((float) $plan->annual_amount)->toBe(60000.0)
        ->and($plan->currency)->toBe('XAF');

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/fees/structure')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('fees/structure')
            ->where('year.label', '2025/26')
            ->where('billingTerm', 'Term 1')
            ->has('installments', 3)
            ->where('levels.0.amount', 60000)
            ->where('levels.0.students', 2)
            ->where('levels.0.billed', 0)
            ->where('levels.1.amount', null));

    $this->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', [
            'year_id' => $world['year']->id,
            'amounts' => [$world['levels'][1]->id => -5],
        ])
        ->assertSessionHasErrors("amounts.{$world['levels'][1]->id}");
});

test('billing issues one invoice per student in levels with a fee', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    billEveryone($world);

    $invoice = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();

    expect(Invoice::count())->toBe(2)
        ->and((float) $invoice->amount_due)->toBe(60000.0)
        ->and($invoice->term_id)->toBe($world['term']->id)
        ->and($invoice->installments()->orderBy('seq')->pluck('amount')->map(fn ($amount) => (float) $amount)->all())
        ->toBe([30000.0, 18000.0, 12000.0])
        ->and(Invoice::where('student_id', $world['students'][2]->id)->exists())->toBeFalse();
});

test('changing a fee leaves issued invoices alone and a billed fee cannot be removed', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    setFees($world, [$world['levels'][1]->id => 75000]);

    expect((float) FeePlan::firstOrFail()->annual_amount)->toBe(75000.0)
        ->and(Invoice::pluck('amount_due')->map(fn ($amount) => (float) $amount)->unique()->all())->toBe([60000.0]);

    $this->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', [
            'year_id' => $world['year']->id,
            'amounts' => [$world['levels'][1]->id => null],
        ])
        ->assertSessionHasErrors("amounts.{$world['levels'][1]->id}");
});

test('the fees list totals the year and flags who is overdue or not billed', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    Invoice::where('student_id', $world['students'][1]->id)->firstOrFail()
        ->recordPayment('60000.00', 'cash', $world['admin']);

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/fees')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('fees/index')
            ->where('totals.billed', 120000)
            ->where('totals.collected', 60000)
            ->where('totals.outstanding', 60000)
            ->where('totals.overdue', 30000)
            ->where('counts.all', 3)
            ->where('counts.overdue', 1)
            ->where('counts.paid', 1)
            ->where('counts.unbilled', 1)
            ->where('students.rows.0.name', 'Achu Brandon')
            ->where('students.rows.0.state', 'overdue'));

    expect(Invoice::where('student_id', $world['students'][0]->id)->firstOrFail()->status)->toBe(InvoiceStatus::Overdue);

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/fees?show=unbilled&q=che')
        ->assertInertia(fn (Assert $page) => $page
            ->where('students.total', 1)
            ->where('students.rows.0.name', 'Che Emmanuel'));
});

test('a payment fills the oldest installment, gets a receipt and updates the ledger', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $student = $world['students'][0];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();

    $response = $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/students/{$student->id}/payments", [
            'invoice_id' => $invoice->id,
            'amount' => 40000,
            'method' => 'mobile_money',
            'reference' => 'MP2510011127',
            'date' => '2025-10-01',
        ])
        ->assertSessionHasNoErrors();

    $payment = Payment::firstOrFail();
    $response->assertRedirect(route('fees.receipt', $payment->id));

    expect($payment->receipt_no)->toBe('RC-25-0001')
        ->and((float) $payment->amount)->toBe(40000.0)
        ->and($payment->received_by)->toBe($world['admin']->id)
        ->and($invoice->refresh()->status)->toBe(InvoiceStatus::Partial);

    $this->actingAs($world['admin'])
        ->get("http://feesa.ekol.test/fees/students/{$student->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('fees/student')
            ->where('invoice.due', 60000)
            ->where('invoice.paid', 40000)
            ->where('invoice.balance', 20000)
            ->where('invoice.overdue', 0)
            ->where('invoice.installments.0.state', 'paid')
            ->where('invoice.installments.1.state', 'partial')
            ->where('invoice.installments.1.paid', 10000)
            ->where('invoice.installments.2.state', 'upcoming')
            ->where('invoice.payments.0.receipt', 'RC-25-0001')
            ->where('invoice.payments.0.method', 'Mobile Money'));

    $this->actingAs($world['admin'])
        ->get("http://feesa.ekol.test/fees/payments/{$payment->id}/receipt")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('fees/receipt')
            ->where('school.code', 'GBHS')
            ->where('issuer.name', 'Academy feesa')
            ->where('receipt.number', 'RC-25-0001')
            ->where('receipt.amount', 40000)
            ->where('receipt.balance', 20000)
            ->where('student.class', 'Form 1 A'));
});

test('a payment cannot exceed the balance, be dated ahead or skip a reference', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $student = $world['students'][0];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();
    $pay = fn (array $overrides) => $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/students/{$student->id}/payments", array_merge([
            'invoice_id' => $invoice->id, 'amount' => 10000, 'method' => 'cash', 'reference' => null, 'date' => '2025-10-01',
        ], $overrides));

    $pay(['amount' => 60001])->assertSessionHasErrors('amount');
    $pay(['date' => '2025-10-02'])->assertSessionHasErrors('date');
    $pay(['method' => 'bank_transfer'])->assertSessionHasErrors('reference');
    $pay(['invoice_id' => Invoice::where('student_id', $world['students'][1]->id)->value('id')])->assertSessionHasErrors('invoice_id');

    expect(Payment::count())->toBe(0);

    $pay([])->assertSessionHasNoErrors();
    $pay([])->assertSessionHasNoErrors();

    expect(Payment::orderBy('receipt_no')->pluck('receipt_no')->all())->toBe(['RC-25-0001', 'RC-25-0002']);
});

test('a discount lowers what is owed across the installments, not what was billed', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $student = $world['students'][0];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();

    $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/invoices/{$invoice->id}/exemption", [
            'kind' => 'percent', 'value' => 25, 'reason' => 'Staff child',
        ])
        ->assertSessionHasNoErrors();

    $invoice->refresh();
    $ledger = $invoice->load(['installments', 'payments', 'exemption'])->ledger();

    expect((float) $invoice->amount_due)->toBe(60000.0)
        ->and((float) $invoice->exemption->amount)->toBe(15000.0)
        ->and($ledger['gross'])->toBe(60000.0)
        ->and($ledger['exempted'])->toBe(15000.0)
        ->and($ledger['due'])->toBe(45000.0)
        ->and(array_column($ledger['installments'], 'amount'))->toBe([22500.0, 13500.0, 9000.0])
        ->and($ledger['overdue'])->toBe(22500.0);

    $this->actingAs($world['admin'])
        ->get("http://feesa.ekol.test/students/{$student->id}/fees")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('students/fees')
            ->where('canManageFees', true)
            ->where('invoice.due', 45000)
            ->where('invoice.exemption.reason', 'Staff child')
            ->where('invoice.exemption.percent', 25)
            ->where('invoice.next.amount', 22500)
            ->where('invoice.next.late', true));

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/fees')
        ->assertInertia(fn (Assert $page) => $page->where('totals.billed', 105000));

    $this->actingAs($world['admin'])
        ->delete("http://feesa.ekol.test/fees/invoices/{$invoice->id}/exemption")
        ->assertSessionHasNoErrors();

    expect($invoice->fresh()->exemption)->toBeNull();
});

test('a full exemption settles the invoice and an exemption cannot undercut payments', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    [$achu, $bih] = $world['students'];
    $paid = Invoice::where('student_id', $achu->id)->firstOrFail();
    $free = Invoice::where('student_id', $bih->id)->firstOrFail();
    $paid->recordPayment('40000.00', 'cash', $world['admin']);

    $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/invoices/{$paid->id}/exemption", ['kind' => 'amount', 'value' => 25000, 'reason' => 'Hardship'])
        ->assertSessionHasErrors('value');
    $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/invoices/{$paid->id}/exemption", ['kind' => 'percent', 'value' => 120, 'reason' => 'Hardship'])
        ->assertSessionHasErrors('value');
    $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/invoices/{$paid->id}/exemption", ['kind' => 'amount', 'value' => 20000, 'reason' => ''])
        ->assertSessionHasErrors('reason');

    $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/invoices/{$free->id}/exemption", ['kind' => 'percent', 'value' => 100, 'reason' => 'Orphan, board decision'])
        ->assertSessionHasNoErrors();

    expect($free->refresh()->status)->toBe(InvoiceStatus::Paid)
        ->and($free->outstanding())->toBe(0.0);
});

test('a registrar reads the fees tab but cannot change fees', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $registrar = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Registrar]);
    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);
    $student = $world['students'][0];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();

    $this->actingAs($registrar)
        ->get("http://feesa.ekol.test/students/{$student->id}/fees")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('canManageFees', false)->where('canManageStudents', true));

    $this->actingAs($teacher)->get("http://feesa.ekol.test/students/{$student->id}/fees")->assertForbidden();
    $this->actingAs($registrar)
        ->post("http://feesa.ekol.test/fees/invoices/{$invoice->id}/exemption", ['kind' => 'percent', 'value' => 10, 'reason' => 'x'])
        ->assertForbidden();
});
