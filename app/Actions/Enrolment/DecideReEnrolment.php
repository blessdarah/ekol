<?php

namespace App\Actions\Enrolment;

use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class DecideReEnrolment
{
    public function decide(School $school, ?AcademicYear $currentYear, AcademicYear $next, string $enrolmentId, ?EnrolmentDecision $decision, ?User $actor): void
    {
        $this->assertYear($school, $next);
        if ($currentYear && $currentYear->school_id !== $school->id) {
            throw new InvalidArgumentException('The current year must belong to the school.');
        }

        $enrolment = Enrolment::continuingFor($school, $currentYear)->firstWhere('id', $enrolmentId);
        $successors = $school->successorLevels();

        if (! $enrolment || ! isset($successors[(string) $enrolment->schoolClass?->level_id])) {
            throw ValidationException::withMessages([
                'decision' => __('That student is not one of this year\'s continuing students.'),
            ]);
        }

        DB::transaction(function () use ($actor, $school, $next, $enrolment, $decision, $successors) {
            $this->applyDecision($enrolment, $decision, $next, $successors);
            AuditEvent::record($school, $actor, 'enrolment', $enrolment->id, 'decided', [
                'decision' => $decision?->value,
                'for' => $next->label,
            ]);
        });
    }

    public function promoteClass(School $school, ?AcademicYear $currentYear, AcademicYear $next, string $classId, ?User $actor): void
    {
        $this->assertYear($school, $next);
        if ($currentYear && $currentYear->school_id !== $school->id) {
            throw new InvalidArgumentException('The current year must belong to the school.');
        }

        $successors = $school->successorLevels();
        $undecided = Enrolment::continuingFor($school, $currentYear)
            ->where('school_class_id', $classId)
            ->whereNull('decision')
            ->filter(fn (Enrolment $enrolment) => isset($successors[(string) $enrolment->schoolClass?->level_id]));

        DB::transaction(function () use ($actor, $school, $next, $undecided, $successors, $classId) {
            foreach ($undecided as $enrolment) {
                $this->applyDecision($enrolment, EnrolmentDecision::Promote, $next, $successors);
            }

            if ($undecided->isNotEmpty()) {
                AuditEvent::record($school, $actor, 'school_class', $classId, 'promoted_undecided', [
                    'students' => $undecided->count(),
                    'for' => $next->label,
                ]);
            }
        });
    }

    /**
     * Record a decision on this year's row and keep the student's row
     * for the coming year in step: one headed for the right level when
     * they continue, none when they leave or are undecided.
     *
     * @param  array<string, string>  $successors
     */
    protected function applyDecision(Enrolment $enrolment, ?EnrolmentDecision $decision, AcademicYear $next, array $successors): void
    {
        $levelId = (string) $enrolment->schoolClass?->level_id;
        $target = match ($decision) {
            EnrolmentDecision::Promote => $successors[$levelId] ?? null,
            EnrolmentDecision::Repeat => $levelId,
            default => null,
        };

        $enrolment->update(['decision' => $decision]);

        $coming = Enrolment::where('student_id', $enrolment->student_id)
            ->where('academic_year_id', $next->id)
            ->first();

        if (! $target) {
            $coming?->delete();

            return;
        }

        if (! $coming) {
            Enrolment::create([
                'student_id' => $enrolment->student_id,
                'academic_year_id' => $next->id,
                'level_id' => $target,
                'status' => EnrolmentStatus::Admitted,
            ]);

            return;
        }

        if ($coming->level_id !== $target) {
            $coming->update([
                'level_id' => $target,
                'school_class_id' => null,
                'status' => EnrolmentStatus::Admitted,
            ]);
        }
    }

    private function assertYear(School $school, AcademicYear $next): void
    {
        if ($next->school_id !== $school->id) {
            throw new InvalidArgumentException('The academic year must belong to the school.');
        }
    }
}
