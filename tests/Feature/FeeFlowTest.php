<?php

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\InvoiceStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeeItem;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\URL;
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

/**
 * The structure payload for a list of fee items, keeping the ids of
 * the items the year already has.
 *
 * @param  list<array{name: string, amounts: array<string, mixed>, spread?: bool, new_only?: bool}>  $items
 * @return array<string, mixed>
 */
function feeItems(array $world, array $items): array
{
    $ids = FeeItem::where('academic_year_id', $world['year']->id)->pluck('id', 'name');

    return [
        'year_id' => $world['year']->id,
        'items' => array_map(fn (array $item) => [
            'id' => $ids[$item['name']] ?? null,
            'name' => $item['name'],
            'spread' => $item['spread'] ?? true,
            'new_only' => $item['new_only'] ?? false,
            'amounts' => $item['amounts'],
        ], $items),
    ];
}

/**
 * Set the year's fees to school fees alone, by level.
 */
function setFees(array $world, array $amounts): void
{
    test()->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', feeItems($world, [['name' => 'School fees', 'amounts' => $amounts]]))
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
            ->has('items', 1)
            ->where('items.0.name', 'School fees')
            ->where('items.0.spread', true)
            ->where("items.0.amounts.{$world['levels'][1]->id}", 60000)
            ->where('levels.0.has_fee', true)
            ->where('levels.0.students', 2)
            ->where('levels.0.billed', 0)
            ->where('levels.1.has_fee', false));

    $this->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', feeItems($world, [['name' => 'School fees', 'amounts' => [$world['levels'][1]->id => -5]]]))
        ->assertSessionHasErrors("items.0.amounts.{$world['levels'][1]->id}");
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
        ->patch('http://feesa.ekol.test/fees/structure', feeItems($world, [['name' => 'School fees', 'amounts' => [$world['levels'][1]->id => null]]]))
        ->assertSessionHasErrors('items');
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
        ->get('http://feesa.ekol.test/fees?state=unbilled&q=che')
        ->assertInertia(fn (Assert $page) => $page
            ->where('students.total', 1)
            ->where('students.rows.0.name', 'Che Emmanuel'));

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/fees?state=overdue,paid&sort=name')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.state', ['overdue', 'paid'])
            ->where('students.total', 2)
            ->where('students.rows.0.name', 'Achu Brandon'));

    $csv = $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/fees/export?state=overdue&columns=name,balance,state')
        ->assertDownload()
        ->streamedContent();

    expect($csv)->toContain('Achu Brandon')
        ->and($csv)->toContain('Status: Overdue')
        ->and($csv)->not->toContain('Che Emmanuel');
});

test('the school dashboard shows fees collected against what is due, for those who handle fees', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    Invoice::where('student_id', $world['students'][1]->id)->firstOrFail()
        ->recordPayment('60000.00', 'cash', $world['admin']);
    $registrar = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Registrar]);

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('counts.students', 3)
            ->where('fees.due', 120000)
            ->where('fees.collected', 60000)
            ->where('fees.overdue', 30000)
            ->where('fees.overdue_students', 1)
            ->where('fees.today', 4)
            ->where('fees.series.4.label', 'W5')
            ->where('fees.series.4.due', 60000)
            ->where('fees.series.4.collected', 60000)
            ->where('fees.series.5.collected', null)
            ->where('attention.0.key', 'fees')
            ->has('levels', 2));

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/dashboard?range=year')
        ->assertInertia(fn (Assert $page) => $page
            ->where('range', 'year')
            ->has('fees.series', 11)
            ->where('fees.series.0.label', 'Sep'));

    $this->actingAs($registrar)
        ->get('http://feesa.ekol.test/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('fees', null)
            ->where('marks', null));
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
            ->where('receipt.kind', 'counter')
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

/**
 * Fees made of a PTA contribution and a registration fee paid up
 * front, then school fees spread over the installments. Bih Glory was
 * at the school last year, so she is not a new student.
 */
function setItemisedFees(array $world): void
{
    $last = AcademicYear::create([
        'school_id' => $world['school']->id, 'label' => '2024/25',
        'starts_on' => '2024-09-01', 'ends_on' => '2025-07-31',
        'status' => AcademicYearStatus::Closed,
    ]);
    Enrolment::create([
        'student_id' => $world['students'][1]->id, 'academic_year_id' => $last->id,
        'school_class_id' => SchoolClass::create([
            'school_id' => $world['school']->id, 'academic_year_id' => $last->id,
            'level_id' => $world['levels'][1]->id, 'name' => 'Form 1 A', 'capacity' => 40,
        ])->id,
        'status' => EnrolmentStatus::Enrolled,
    ]);

    $form1 = $world['levels'][1]->id;

    test()->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', feeItems($world, [
            ['name' => 'PTA contribution', 'spread' => false, 'amounts' => [$form1 => 5000]],
            ['name' => 'Registration', 'spread' => false, 'new_only' => true, 'amounts' => [$form1 => 3000]],
            ['name' => 'School fees', 'amounts' => [$form1 => 60000]],
        ]))
        ->assertSessionHasNoErrors();
}

test('a bill is made of the items of its level, with up-front items on the first installment', function () {
    $world = feeWorld();
    setItemisedFees($world);
    billEveryone($world);

    $new = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();
    $returning = Invoice::where('student_id', $world['students'][1]->id)->firstOrFail();
    $amounts = fn (Invoice $invoice) => $invoice->installments()->orderBy('seq')->pluck('amount')->map(fn ($amount) => (float) $amount)->all();

    expect((float) FeePlan::firstOrFail()->annual_amount)->toBe(65000.0)
        ->and((float) $new->amount_due)->toBe(68000.0)
        ->and($new->lines()->orderBy('position')->pluck('name')->all())->toBe(['PTA contribution', 'Registration', 'School fees'])
        ->and($amounts($new))->toBe([38000.0, 18000.0, 12000.0])
        ->and((float) $returning->amount_due)->toBe(65000.0)
        ->and($returning->lines()->orderBy('position')->pluck('name')->all())->toBe(['PTA contribution', 'School fees'])
        ->and($amounts($returning))->toBe([35000.0, 18000.0, 12000.0])
        ->and(Invoice::where('student_id', $world['students'][2]->id)->exists())->toBeFalse();
});

test('a payment is shared between the items in their order and the receipt says how', function () {
    $world = feeWorld();
    setItemisedFees($world);
    billEveryone($world);

    $student = $world['students'][1];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();
    $pay = fn (int $amount) => $this->actingAs($world['admin'])
        ->post("http://feesa.ekol.test/fees/students/{$student->id}/payments", [
            'invoice_id' => $invoice->id, 'amount' => $amount, 'method' => 'cash', 'date' => '2025-10-01',
        ])
        ->assertSessionHasNoErrors();

    $pay(20000);
    $this->travel(1)->minutes();
    $pay(20000);

    [$first, $second] = Payment::orderBy('receipt_no')->get()->all();

    $this->actingAs($world['admin'])
        ->get("http://feesa.ekol.test/fees/payments/{$first->id}/receipt")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('fees/receipt')
            ->has('receipt.covers', 2)
            ->where('receipt.covers.0.name', 'PTA contribution')
            ->where('receipt.covers.0.amount', 5000)
            ->where('receipt.covers.1.name', 'School fees')
            ->where('receipt.covers.1.amount', 15000));

    $this->actingAs($world['admin'])
        ->get("http://feesa.ekol.test/fees/payments/{$second->id}/receipt")
        ->assertInertia(fn (Assert $page) => $page
            ->has('receipt.covers', 1)
            ->where('receipt.covers.0.name', 'School fees')
            ->where('receipt.covers.0.amount', 20000));

    $this->actingAs($world['admin'])
        ->get("http://feesa.ekol.test/fees/students/{$student->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('invoice.items.0.name', 'PTA contribution')
            ->where('invoice.items.0.upfront', true)
            ->where('invoice.items.0.paid', 5000)
            ->where('invoice.items.0.balance', 0)
            ->where('invoice.items.1.name', 'School fees')
            ->where('invoice.items.1.paid', 35000)
            ->where('invoice.items.1.balance', 25000)
            ->where('invoice.installments.0.state', 'paid')
            ->where('invoice.installments.1.paid', 5000));

    $this->actingAs($world['admin'])
        ->get('http://feesa.ekol.test/fees/structure')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items.0.name', 'PTA contribution')
            ->where('items.0.billed', 10000)
            ->where('items.0.collected', 5000)
            ->where('items.1.new_only', true)
            ->where('items.1.billed', 3000)
            ->where('items.2.collected', 35000));
});

test('an item can be renamed, reordered and removed without touching issued bills', function () {
    $world = feeWorld();
    setItemisedFees($world);
    billEveryone($world);

    $form1 = $world['levels'][1]->id;
    $ids = FeeItem::pluck('id', 'name');

    $this->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', [
            'year_id' => $world['year']->id,
            'items' => [
                ['id' => $ids['School fees'], 'name' => 'Tuition', 'spread' => true, 'new_only' => false, 'amounts' => [$form1 => 70000]],
                ['id' => $ids['PTA contribution'], 'name' => 'PTA contribution', 'spread' => false, 'new_only' => false, 'amounts' => [$form1 => 5000]],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect(FeeItem::orderBy('position')->pluck('name')->all())->toBe(['Tuition', 'PTA contribution'])
        ->and((float) FeePlan::firstOrFail()->annual_amount)->toBe(75000.0)
        ->and(Invoice::where('student_id', $world['students'][0]->id)->firstOrFail()->lines()->orderBy('position')->pluck('name')->all())
        ->toBe(['PTA contribution', 'Registration', 'School fees']);

    $this->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', [
            'year_id' => $world['year']->id,
            'items' => [
                ['id' => null, 'name' => 'Tuition', 'spread' => true, 'new_only' => false, 'amounts' => []],
                ['id' => null, 'name' => 'tuition', 'spread' => true, 'new_only' => false, 'amounts' => []],
            ],
        ])
        ->assertSessionHasErrors('items.0.name');
});

test('an item with an amount for some levels only is billed to those levels alone', function () {
    $world = feeWorld();
    [$form1, $form2] = [$world['levels'][1]->id, $world['levels'][2]->id];

    $this->actingAs($world['admin'])
        ->patch('http://feesa.ekol.test/fees/structure', feeItems($world, [
            ['name' => 'School fees', 'amounts' => [$form1 => 60000, $form2 => 60000]],
            ['name' => 'Mock exams', 'spread' => false, 'amounts' => [$form1 => null, $form2 => 7500]],
        ]))
        ->assertSessionHasNoErrors();
    billEveryone($world);

    $lower = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();
    $exam = Invoice::where('student_id', $world['students'][2]->id)->firstOrFail();

    expect((float) $lower->amount_due)->toBe(60000.0)
        ->and($lower->lines()->pluck('name')->all())->toBe(['School fees'])
        ->and((float) $exam->amount_due)->toBe(67500.0)
        ->and($exam->lines()->orderBy('position')->pluck('name')->all())->toBe(['School fees', 'Mock exams'])
        ->and((float) $exam->installments()->orderBy('seq')->value('amount'))->toBe(37500.0);
});

test('reprinting an earlier receipt excludes later payments and keeps its original academic year class', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $invoice = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();
    $first = $invoice->recordPayment('40000.00', 'cash', $world['admin'], receivedAt: now());
    $this->travel(1)->days();
    $invoice->recordPayment('20000.00', 'cash', $world['admin'], receivedAt: now());
    $world['year']->update(['status' => AcademicYearStatus::Closed]);
    AcademicYear::create([
        'school_id' => $world['school']->id, 'label' => '2026/27', 'starts_on' => '2026-09-01',
        'ends_on' => '2027-07-31', 'status' => AcademicYearStatus::Current,
    ]);

    $this->actingAs($world['admin'])->get("http://feesa.ekol.test/fees/payments/{$first->id}/receipt")
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('fees/receipt')
        ->where('receipt.balance', 20000)
        ->where('receipt.paid', 40000)
        ->where('receipt.can_pay', false)
        ->where('receipt.state', 'partial')
        ->where('receipt.year', '2025/26')
        ->where('student.class', 'Form 1 A')
        ->where('receipt.next.amount', 8000)
        ->where('receipt.next.due_on', '2025-11-15')
        ->has('receipt.history', 1)
        ->where('receipt.words', 'Forty thousand CFA francs')
        ->where('receipt.qr', fn (string $value) => str_starts_with($value, 'data:image/svg+xml;base64,')));
});

test('a cleared invoice has a paid in full receipt and no next installment', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $invoice = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();
    $payment = $invoice->recordPayment('60000.00', 'cash', $world['admin']);

    $this->actingAs($world['admin'])->get("http://feesa.ekol.test/fees/payments/{$payment->id}/receipt")
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('receipt.state', 'paid')->where('receipt.balance', 0)->where('receipt.next', null));
});

test('a signed receipt verification confirms the payment without disclosing the student', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $invoice = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();
    $payment = $invoice->recordPayment('40000.00', 'cash', $world['admin']);
    $url = URL::signedRoute('receipts.verify', ['payment' => $payment->id]);

    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('fees/receipt-verify')->where('issuer', 'Academy feesa')
        ->where('receipt.number', 'RC-25-0001')->where('receipt.amount', 40000)
        ->missing('student')->missing('receipt.balance')->missing('receipt.paid_from'));
    $this->get(route('receipts.verify', $payment->id))->assertForbidden();
    $this->get($url.'&amount=1')->assertForbidden();
});

test('receipts are unavailable to staff of a different school and teachers', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => 60000]);
    billEveryone($world);
    $invoice = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();
    $payment = $invoice->recordPayment('40000.00', 'cash', $world['admin']);
    $other = feeWorld('feesb');

    $this->actingAs($other['admin'])->get("http://feesb.ekol.test/fees/payments/{$payment->id}/receipt")->assertNotFound();
    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);
    $this->actingAs($teacher)->get("http://feesa.ekol.test/fees/payments/{$payment->id}/receipt")->assertForbidden();
});

test('decimal fees agree across payment limits receipts item totals and the dashboard', function () {
    $world = feeWorld();
    $level = $world['levels'][1]->id;
    $this->actingAs($world['admin'])->patch('http://feesa.ekol.test/fees/structure', feeItems($world, [
        ['name' => 'School fees', 'amounts' => [$level => '10.10']],
        ['name' => 'Transport', 'amounts' => [$level => '20.70']],
    ]))->assertSessionHasNoErrors();
    billEveryone($world);
    $student = $world['students'][0];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();
    $pay = fn (string $amount) => $this->post("http://feesa.ekol.test/fees/students/{$student->id}/payments", [
        'invoice_id' => $invoice->id, 'amount' => $amount, 'method' => 'cash', 'date' => '2025-10-01',
    ]);

    $pay('10.10')->assertSessionHasNoErrors();
    $pay('20.71')->assertSessionHasErrors('amount');
    $pay('20.70')->assertSessionHasNoErrors();

    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Paid);
    $payments = $invoice->payments()->orderBy('receipt_no')->get();
    $this->get("http://feesa.ekol.test/fees/payments/{$payments[1]->id}/receipt")
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('receipt.balance', 0)->where('receipt.paid', 30.8)
        ->where('receipt.state', 'paid')->where('receipt.next', null));
    $this->get("http://feesa.ekol.test/fees/payments/{$payments[0]->id}/receipt")
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('receipt.balance', 20.7)->where('receipt.paid', 10.1)
        ->where('receipt.next.amount', 5.3)->has('receipt.history', 1));
    $this->get('http://feesa.ekol.test/fees')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('totals.billed', 61.6)->where('totals.collected', 30.8)
        ->where('totals.outstanding', 30.8)->where('totals.overdue', 15.4));
    $this->get('http://feesa.ekol.test/fees/structure')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('items.0.billed', 20.2)->where('items.0.collected', 10.1)
        ->where('items.1.billed', 41.4)->where('items.1.collected', 20.7));
    $this->get('http://feesa.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('fees.due', 61.6)->where('fees.collected', 30.8)
        ->where('fees.overdue', 15.4)->where('fees.overdue_students', 1));
});

test('fee payment and exemption inputs reject unsupported decimal precision', function () {
    $world = feeWorld();
    $level = $world['levels'][1]->id;
    $this->actingAs($world['admin'])->patch('http://feesa.ekol.test/fees/structure', feeItems($world, [
        ['name' => 'School fees', 'amounts' => [$level => '10.001']],
    ]))->assertSessionHasErrors("items.0.amounts.$level");
    setFees($world, [$level => '30.80']);
    billEveryone($world);
    $student = $world['students'][0];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();
    $this->post("http://feesa.ekol.test/fees/students/{$student->id}/payments", [
        'invoice_id' => $invoice->id, 'amount' => '10.001', 'method' => 'cash', 'date' => '2025-10-01',
    ])->assertSessionHasErrors('amount');
    $this->post("http://feesa.ekol.test/fees/invoices/{$invoice->id}/exemption", [
        'kind' => 'amount', 'value' => '1.001', 'reason' => 'Hardship',
    ])->assertSessionHasErrors('value');

    expect($invoice->payments()->count())->toBe(0)
        ->and($invoice->exemption()->exists())->toBeFalse();
});

test('a remaining hundredth can be settled at school without overpayment', function () {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => '1.01']);
    billEveryone($world);
    $student = $world['students'][0];
    $invoice = Invoice::where('student_id', $student->id)->firstOrFail();
    foreach (['1.00', '0.01'] as $amount) {
        $this->post("http://feesa.ekol.test/fees/students/{$student->id}/payments", [
            'invoice_id' => $invoice->id, 'amount' => $amount, 'method' => 'cash', 'date' => '2025-10-01',
        ])->assertSessionHasNoErrors();
    }

    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Paid)
        ->and($invoice->fresh()->ledgerMinor()['paid'])->toBe(101)
        ->and($invoice->fresh()->ledgerMinor()['balance'])->toBe(0);
});

test('a full percentage exemption clears a fractional invoice exactly', function (string $amount, int $expected) {
    $world = feeWorld();
    setFees($world, [$world['levels'][1]->id => $amount]);
    billEveryone($world);
    $invoice = Invoice::where('student_id', $world['students'][0]->id)->firstOrFail();

    $this->post("http://feesa.ekol.test/fees/invoices/{$invoice->id}/exemption", [
        'kind' => 'percent', 'value' => '100.00', 'reason' => 'Hardship',
    ])->assertSessionHasNoErrors();

    expect($invoice->fresh()->ledgerMinor()['exempted'])->toBe($expected)
        ->and($invoice->fresh()->ledgerMinor()['balance'])->toBe(0)
        ->and($invoice->fresh()->status)->toBe(InvoiceStatus::Paid);
})->with([['30.80', 3080], ['0.01', 1]]);
