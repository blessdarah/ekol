<?php

namespace App\Http\Controllers;

use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Money;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class StudentFeeController extends Controller
{
    /**
     * The Fees tab of a student record: the plan, each installment,
     * the payments, and any exemption. Roles that keep student records
     * can read it; only fee roles can act on it.
     */
    public function studentTab(Request $request, string $student): Response
    {
        $school = $this->schoolContext->school();
        $user = $request->user();

        Gate::authorize('read-student-fees');

        $target = $this->findStudent($school, $student)->load('guardians');
        $year = $this->schoolContext->year();
        $invoices = Invoice::where('student_id', $target->id)
            ->with(['installments', 'lines', 'exemption.granter:id,full_name', 'payments.receiver:id,full_name,role', 'term.academicYear'])
            ->orderBy('issued_on')
            ->get();
        $invoice = $invoices->firstWhere('id', (string) $request->query('invoice', ''))
            ?? $invoices->first(fn (Invoice $candidate) => $candidate->term?->academic_year_id === $year?->id)
            ?? $invoices->last();
        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)->where('academic_year_id', $year->id)->with('schoolClass.level')->first()
            : null;
        $ledger = $invoice?->syncStatus()->ledger();
        $open = collect($ledger['installments'] ?? [])->first(fn (array $row) => $row['state'] !== 'paid');
        $main = $target->guardians->firstWhere('is_main', true);

        return Inertia::render('students/fees', [
            'neighbours' => Student::neighbours($school, $target, $this->schoolContext->year()),
            'currency' => $school->currency,
            'canManageFees' => (bool) $user?->can('manage-fees'),
            'canManageStudents' => (bool) $user?->can('manage-students'),
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'matricule' => $target->admission_no,
                'class' => $enrolment?->schoolClass?->name,
                'level' => $enrolment?->schoolClass?->level?->name,
                'admitted_year' => $target->admitted_on->format('Y'),
                'contact' => $main ? $main->name : $target->guardian_name,
            ],
            'invoices' => $invoices->map(fn (Invoice $option) => [
                'id' => $option->id,
                'year' => $option->term?->academicYear?->label,
                'balance' => $option->ledger()['balance'],
            ]),
            'invoice' => $invoice && $ledger ? [
                'id' => $invoice->id,
                'year' => $invoice->term?->academicYear?->label,
                ...$ledger,
                'exemption' => $this->exemptionOf($invoice),
                'next' => $open ? [
                    'amount' => $open['amount'] - $open['paid'],
                    'label' => $open['label'],
                    'late' => $open['state'] === 'overdue',
                ] : null,
                'payments' => $invoice->payments->sortBy('received_at')->values()->map(fn (Payment $payment) => [
                    'id' => $payment->id,
                    'on' => $payment->received_at->toDateString(),
                    'method' => $payment->method->label(),
                    'by' => $payment->receiver ? mb_strtolower($payment->receiver->role->label()) : null,
                    'amount' => Money::number(Money::units($payment->amount)),
                    'receipt' => $payment->receipt_no,
                ]),
            ] : null,
        ]);
    }

    protected function findStudent(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    /**
     * @return array{kind: string, percent: float|null, amount: float, reason: string, by: string|null, on: string}|null
     */
    protected function exemptionOf(Invoice $invoice): ?array
    {
        $exemption = $invoice->exemption;

        return $exemption ? [
            'kind' => $exemption->kind,
            'percent' => $exemption->percent !== null ? (float) $exemption->percent : null,
            'amount' => Money::number(Money::units($exemption->amount)),
            'reason' => $exemption->reason,
            'by' => $exemption->granter?->full_name,
            'on' => $exemption->created_at->toDateString(),
        ] : null;
    }
}
