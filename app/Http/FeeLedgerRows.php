<?php

namespace App\Http;

use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Money;
use App\Models\School;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;
use stdClass;

class FeeLedgerRows
{
    /** @return EloquentBuilder<Invoice> */
    public function invoices(School $school, ?AcademicYear $year): EloquentBuilder
    {
        $query = Invoice::where('school_id', $school->id)
            ->whereIn('term_id', Term::where('school_id', $school->id)->where('academic_year_id', $year?->id)->select('id'))
            ->whereHas('student', fn (EloquentBuilder $students) => $students->where('school_id', $school->id));

        abort_if($query->clone()->whereNull('ledger_updated_on')->exists(), 503, __('Fee balances are being prepared. Please try again shortly.'));

        return $query;
    }

    public function query(School $school, ?AcademicYear $year): Builder
    {
        $invoices = $this->invoices($school, $year)->toBase()
            ->select('student_id')
            ->selectRaw('COUNT(*) as invoices, SUM(due_minor) as due, SUM(paid_minor) as paid, SUM(balance_minor) as balance, SUM(overdue_minor) as overdue')
            ->groupBy('student_id');

        $enrolments = Enrolment::query()
            ->join('students', 'students.id', '=', 'enrolments.student_id')
            ->leftJoin('school_classes', function (JoinClause $join) use ($school): void {
                $join->on('school_classes.id', '=', 'enrolments.school_class_id')
                    ->where('school_classes.school_id', $school->id)->whereNull('school_classes.deleted_at');
            })
            ->leftJoinSub($invoices, 'ledger', 'ledger.student_id', '=', 'students.id')
            ->where('students.school_id', $school->id)->whereNull('students.deleted_at')
            ->where('enrolments.academic_year_id', $year?->id)->where('enrolments.status', '!=', EnrolmentStatus::Left)
            ->select('students.id', 'students.full_name as name', 'students.admission_no as matricule', 'school_classes.id as class_id', 'school_classes.name as class')
            ->selectRaw('COALESCE(enrolments.level_id, school_classes.level_id) as level_id, COALESCE(ledger.due, 0) as due, COALESCE(ledger.paid, 0) as paid, COALESCE(ledger.balance, 0) as balance, COALESCE(ledger.overdue, 0) as overdue')
            ->selectRaw("CASE WHEN ledger.invoices IS NULL THEN 'unbilled' WHEN ledger.balance <= 0 THEN 'paid' WHEN ledger.overdue > 0 THEN 'overdue' ELSE 'owing' END as state");

        return DB::query()->fromSub($enrolments->toBase(), 'fee_rows');
    }

    /** @return array<string, mixed> */
    public function row(stdClass $row): array
    {
        return [
            'id' => $row->id,
            'name' => $row->name,
            'matricule' => $row->matricule,
            'class' => $row->class,
            'class_id' => $row->class_id,
            'level_id' => $row->level_id,
            'due' => Money::number((int) $row->due),
            'paid' => Money::number((int) $row->paid),
            'balance' => Money::number((int) $row->balance),
            'overdue' => Money::number((int) $row->overdue),
            'state' => $row->state,
        ];
    }
}
