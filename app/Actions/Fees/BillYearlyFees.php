<?php

namespace App\Actions\Fees;

use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class BillYearlyFees
{
    public function billEnrolled(School $school, AcademicYear $year, Term $term, ?User $actor, ?string $levelId = null): int
    {
        $this->assertYear($school, $year);
        if ($term->academic_year_id !== $year->id || $term->school_id !== $school->id) {
            throw new InvalidArgumentException('The billing term must belong to the school year.');
        }

        if ($levelId !== null) {
            Level::where('school_id', $school->id)->whereKey($levelId)->firstOrFail();
        }

        return DB::transaction(function () use ($school, $year, $term, $actor, $levelId) {
            $terms = Term::where('academic_year_id', $year->id)->pluck('id');
            $enrolments = Enrolment::where('academic_year_id', $year->id)
                ->where('status', EnrolmentStatus::Enrolled)
                ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
                ->with(['schoolClass', 'student.invoices' => fn ($query) => $query->whereIn('term_id', $terms)])
                ->get();
            $plans = $this->plans($school, $year)->get()->keyBy('level_id');
            $billed = 0;

            foreach ($enrolments as $enrolment) {
                $level = (string) ($enrolment->level_id ?? $enrolment->schoolClass?->level_id);
                $student = $enrolment->student;
                $plan = $plans->get($level);

                if (! $student || ! $plan || ($levelId && $levelId !== $level)) {
                    continue;
                }
                if ($student->invoices->isNotEmpty()) {
                    continue;
                }

                $plan->billTo($student, $term);
                $billed++;
            }

            AuditEvent::record($school, $actor, 'academic_year', $year->id, 'students_billed', ['students' => $billed, 'level_id' => $levelId]);

            return $billed;
        });
    }

    public function billPlacement(School $school, AcademicYear $year, Enrolment $enrolment): void
    {
        $this->assertYear($school, $year);
        if ($enrolment->academic_year_id !== $year->id || ! $enrolment->student()->where('school_id', $school->id)->exists()) {
            throw new InvalidArgumentException('The enrolment must belong to the school year.');
        }

        DB::transaction(function () use ($school, $year, $enrolment) {
            $term = Term::where('school_id', $school->id)->where('academic_year_id', $year->id)->orderBy('sequence')->first();
            $plan = $this->plans($school, $year)->where('level_id', $enrolment->level_id)->first();
            $student = $enrolment->student;

            if (! $term || ! $plan || ! $student || Invoice::where('student_id', $student->id)->where('term_id', $term->id)->exists()) {
                return;
            }

            $plan->billTo($student, $term);
        });
    }

    /** @return Builder<FeePlan> */
    private function plans(School $school, AcademicYear $year): Builder
    {
        return FeePlan::where('school_id', $school->id)->where('academic_year_id', $year->id);
    }

    private function assertYear(School $school, AcademicYear $year): void
    {
        if ($year->school_id !== $school->id) {
            throw new InvalidArgumentException('The academic year must belong to the school.');
        }
    }
}
