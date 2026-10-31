<?php

namespace App\Actions\Enrolment;

use App\Actions\Fees\BillYearlyFees;
use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class ConfirmEnrolment
{
    public function __construct(private BillYearlyFees $billing) {}

    public function handle(School $school, ?AcademicYear $currentYear, AcademicYear $next, ?User $actor): void
    {
        $this->assertYear($school, $next);
        if ($currentYear && $currentYear->school_id !== $school->id) {
            throw new InvalidArgumentException('The current year must belong to the school.');
        }

        $progress = $next->enrolmentProgress($school, $currentYear);

        if ($progress['confirmed']) {
            throw ValidationException::withMessages(['confirm' => __('Enrolment for :label is already confirmed.', ['label' => $next->label])]);
        }

        if (! $progress['ready']) {
            throw ValidationException::withMessages([
                'confirm' => __('Enrolment cannot be confirmed yet. Finish the checks that are still open.'),
            ]);
        }

        DB::transaction(function () use ($actor, $school, $next) {
            $placed = Enrolment::where('academic_year_id', $next->id)
                ->whereHas('student', fn ($query) => $query->where('school_id', $school->id))
                ->where('status', EnrolmentStatus::Placed)
                ->with('schoolClass:id,level_id')
                ->get();

            foreach ($placed as $enrolment) {
                $enrolment->update(['status' => EnrolmentStatus::Enrolled]);
                $this->billing->billPlacement($school, $next, $enrolment);
            }

            $next->update(['enrolment_confirmed_at' => now()]);
            AuditEvent::record($school, $actor, 'academic_year', $next->id, 'enrolment_confirmed', ['students' => $placed->count()]);
        });
    }

    private function assertYear(School $school, AcademicYear $next): void
    {
        if ($next->school_id !== $school->id) {
            throw new InvalidArgumentException('The academic year must belong to the school.');
        }
    }
}
