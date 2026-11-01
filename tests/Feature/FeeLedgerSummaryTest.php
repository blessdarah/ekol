<?php

use App\Enums\AcademicYearStatus;
use App\Enums\UserRole;
use App\Http\FeeLedgerRows;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

/** @return array{school: School, year: AcademicYear, class: SchoolClass, term: Term, plan: FeePlan, admin: User} */
function summaryWorld(string $slug = 'summary'): array
{
    test()->travelTo('2025-10-01 09:00:00');
    $school = School::create(['name' => 'Summary school '.$slug, 'code' => 'SUM', 'slug' => $slug, 'cycle' => 'secondary', 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
    $year = AcademicYear::create(['school_id' => $school->id, 'label' => '2025/26', 'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current]);
    $term = Term::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1, 'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19', 'week_count' => 16, 'is_current' => true]);
    $level = Level::create(['school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1, 'cycle' => 'secondary', 'uses_series' => false]);
    $class = SchoolClass::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => 'Form 1 A', 'capacity' => 50]);
    $plan = FeePlan::create(['school_id' => $school->id, 'level_id' => $level->id, 'academic_year_id' => $year->id, 'annual_amount' => '100.01', 'currency' => 'XAF', 'is_active' => true]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);

    return compact('school', 'year', 'term', 'class', 'plan', 'admin');
}

/** @param array{school: School, year: AcademicYear, class: SchoolClass, term: Term, plan: FeePlan, admin: User} $world */
function summaryInvoice(array $world, string $name = 'First student'): Invoice
{
    $student = Student::create(['school_id' => $world['school']->id, 'admission_no' => $name, 'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2013-01-01', 'guardian_name' => 'Guardian', 'guardian_phone' => '670000000', 'admitted_on' => '2025-09-01']);
    Enrolment::create(['student_id' => $student->id, 'academic_year_id' => $world['year']->id, 'school_class_id' => $world['class']->id, 'status' => 'enrolled']);

    return Invoice::issue($student, $world['term'], $world['plan'], '100.01', '2025-10-01');
}

test('stored summaries preserve exact exemption allocation and oldest installment payments', function () {
    $world = summaryWorld();
    $invoice = summaryInvoice($world);
    foreach (['2025-09-01', '2025-11-01', '2026-01-01'] as $position => $date) {
        $invoice->installments()->create(['seq' => $position + 1, 'label' => 'Part', 'amount' => $position === 2 ? '33.33' : '33.34', 'due_on' => $date]);
    }
    $invoice->exemption()->create(['kind' => 'amount', 'amount' => '20.00', 'reason' => 'Discount']);
    $invoice->recordPayment('10.01', 'cash');

    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'due_minor' => 8001, 'paid_minor' => 1001, 'balance_minor' => 7000, 'overdue_minor' => 1666, 'status' => 'overdue']);
    expect($invoice->installments()->orderBy('seq')->pluck('net_due_minor')->map(fn ($amount) => (int) $amount)->all())->toBe([2667, 2668, 2666]);

    $invoice->installments()->where('seq', 2)->firstOrFail()->update(['due_on' => '2025-09-15']);
    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'overdue_minor' => 4334]);
});

test('source edits and moving payments refresh both stored summaries', function () {
    $world = summaryWorld();
    $invoice = summaryInvoice($world);
    $other = summaryInvoice($world, 'Second student');
    $payment = $invoice->recordPayment('25.00', 'cash');
    $payment->update(['invoice_id' => $other->id]);

    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'paid_minor' => 0, 'balance_minor' => 10001]);
    $this->assertDatabaseHas('invoices', ['id' => $other->id, 'paid_minor' => 2500, 'balance_minor' => 7501]);

    $invoice->update(['amount_due' => '120.01']);
    $invoice->lines()->firstOrFail()->update(['amount' => '120.01']);
    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'due_minor' => 12001, 'balance_minor' => 12001]);
    $payment->delete();
    $this->assertDatabaseHas('invoices', ['id' => $other->id, 'paid_minor' => 0, 'balance_minor' => 10001]);
});

test('the refresh command repairs legacy summaries and catches date rollover without request writes', function () {
    $world = summaryWorld();
    $invoice = summaryInvoice($world);
    DB::table('invoices')->where('id', $invoice->id)->update(['due_minor' => null, 'ledger_updated_on' => null]);
    $this->actingAs($world['admin'])->get('http://summary.ekol.test/fees')->assertServiceUnavailable();

    $this->artisan('fees:refresh-ledgers')->assertSuccessful();
    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'due_minor' => 10001, 'overdue_minor' => 0]);

    $this->travelTo('2025-10-02 09:00:00');
    $this->artisan('fees:refresh-ledgers')->assertSuccessful();
    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'overdue_minor' => 10001, 'status' => 'overdue']);
    $this->artisan('fees:refresh-ledgers')->expectsOutputToContain('Refreshed 0')->assertSuccessful();
});

test('fee lists paginate in SQL without hydrating invoices or updating ledger records', function () {
    $world = summaryWorld();
    for ($position = 1; $position <= 27; $position++) {
        summaryInvoice($world, sprintf('Student %02d', $position));
    }
    $hydrated = 0;
    Invoice::retrieved(function () use (&$hydrated): void {
        $hydrated++;
    });
    DB::flushQueryLog();
    DB::enableQueryLog();

    $this->actingAs($world['admin'])->get('http://summary.ekol.test/fees?sort=name&page=2')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('students.total', 27)->where('students.page', 2)->has('students.rows', 2)->where('students.rows.0.name', 'Student 26')->where('totals.billed', 2700.27));

    expect($hydrated)->toBe(0);
    $writes = collect(DB::getQueryLog())->filter(fn (array $query) => preg_match('/^(update|insert|delete).*"(invoices|installments)"/i', $query['query']) === 1);
    expect($writes)->toHaveCount(0);
    DB::disableQueryLog();
});

test('fee summary queries isolate schools and retain literal search and selected exports', function () {
    $world = summaryWorld();
    $invoice = summaryInvoice($world, 'Student 10%');
    summaryInvoice($world, 'Student 100');
    $foreign = summaryWorld('foreign-summary');
    summaryInvoice($foreign, 'Foreign student');

    expect((new FeeLedgerRows)->query($world['school'], $world['year'])->count())->toBe(2);
    $this->actingAs($world['admin'])->get('http://summary.ekol.test/fees?q=10%25')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('students.total', 1)->where('students.rows.0.name', 'Student 10%'));
    $csv = $this->get('http://summary.ekol.test/fees/export?ids='.$invoice->student_id)->assertDownload()->streamedContent();
    expect($csv)->toContain('Student 10%')->not->toContain('Student 100')->not->toContain('Foreign student');
});

test('moving and deleting installment and line records reconciles their invoice summaries', function () {
    $world = summaryWorld();
    $invoice = summaryInvoice($world);
    $other = summaryInvoice($world, 'Second student');
    $part = $invoice->installments()->create(['seq' => 1, 'label' => 'Part', 'amount' => '100.01', 'due_on' => '2025-09-01']);
    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'overdue_minor' => 10001]);

    $part->update(['invoice_id' => $other->id]);
    $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'overdue_minor' => 0]);
    $this->assertDatabaseHas('invoices', ['id' => $other->id, 'overdue_minor' => 10001]);
    $other->recordPayment('50.00', 'cash');
    $line = $other->lines()->firstOrFail();
    $line->update(['amount' => '20.00']);
    $this->assertDatabaseHas('invoices', ['id' => $other->id, 'overdue_minor' => 8001]);

    $line->delete();
    $this->assertDatabaseHas('invoices', ['id' => $other->id, 'overdue_minor' => 5001]);
    $part->delete();
    $this->assertDatabaseHas('invoices', ['id' => $other->id, 'overdue_minor' => 0]);
});
