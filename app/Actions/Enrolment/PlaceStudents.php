<?php

namespace App\Actions\Enrolment;

use App\Actions\Fees\BillYearlyFees;
use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class PlaceStudents
{
    public function __construct(private BillYearlyFees $billing) {}

    /** @param list<string> $enrolmentIds */
    public function inClass(School $school, AcademicYear $next, string $classId, array $enrolmentIds, ?User $actor): void
    {
        $this->assertYear($school, $next);

        $class = SchoolClass::where('school_id', $school->id)->where('academic_year_id', $next->id)->whereKey($classId)->firstOrFail();
        $enrolments = Enrolment::where('academic_year_id', $next->id)
            ->whereHas('student', fn ($query) => $query->where('school_id', $school->id))
            ->where('level_id', $class->level_id)
            ->whereNull('school_class_id')
            ->whereIn('id', $enrolmentIds)
            ->get();

        if ($enrolments->count() !== count($enrolmentIds)) {
            throw ValidationException::withMessages([
                'enrolment_ids' => __('Some of those students are no longer waiting for a :name place. Reload and try again.', ['name' => $class->name]),
            ]);
        }

        $free = $class->capacity - Enrolment::where('school_class_id', $class->id)->count();

        if ($enrolments->count() > $free) {
            throw ValidationException::withMessages([
                'class_id' => $free > 0
                    ? __(':name has room for :free more, not :count.', ['name' => $class->name, 'free' => $free, 'count' => $enrolments->count()])
                    : __(':name is full. Choose another class or add one.', ['name' => $class->name]),
            ]);
        }

        DB::transaction(function () use ($actor, $school, $next, $class, $enrolments) {
            foreach ($enrolments as $enrolment) {
                $this->seat($school, $next, $enrolment, $class);
            }

            AuditEvent::record($school, $actor, 'school_class', $class->id, 'students_placed', [
                'students' => $enrolments->count(),
                'year' => $next->label,
            ]);
        });
    }

    public function acrossLevel(School $school, AcademicYear $next, string $levelId, ?User $actor): void
    {
        $this->assertYear($school, $next);
        Level::where('school_id', $school->id)->whereKey($levelId)->firstOrFail();

        $classes = SchoolClass::where('school_id', $school->id)->where('academic_year_id', $next->id)
            ->where('level_id', $levelId)
            ->withCount('enrolments')
            ->orderBy('name')
            ->get();
        $waiting = Enrolment::where('academic_year_id', $next->id)
            ->whereHas('student', fn ($query) => $query->where('school_id', $school->id))
            ->where('level_id', $levelId)
            ->whereNull('school_class_id')
            ->with('student:id,full_name')
            ->get()
            ->sortBy(fn (Enrolment $enrolment) => $enrolment->student?->full_name)
            ->values();

        if ($classes->isEmpty()) {
            throw ValidationException::withMessages(['level_id' => __('This level has no classes yet. Add one first.')]);
        }

        $taken = $classes->mapWithKeys(fn (SchoolClass $class) => [$class->id => (int) $class->getAttribute('enrolments_count')])->all();

        DB::transaction(function () use ($actor, $school, $next, $classes, $waiting, $taken, $levelId) {
            $placed = 0;

            foreach ($waiting as $enrolment) {
                $class = $classes
                    ->filter(fn (SchoolClass $candidate) => $taken[$candidate->id] < $candidate->capacity)
                    ->sortBy(fn (SchoolClass $candidate) => $taken[$candidate->id])
                    ->first();

                if (! $class) {
                    break;
                }

                $this->seat($school, $next, $enrolment, $class);
                $taken[$class->id]++;
                $placed++;
            }

            AuditEvent::record($school, $actor, 'level', $levelId, 'students_placed', [
                'students' => $placed,
                'year' => $next->label,
            ]);
        });
    }

    public function clearClass(School $school, AcademicYear $next, string $classId, ?User $actor): void
    {
        $this->assertYear($school, $next);
        SchoolClass::where('school_id', $school->id)->where('academic_year_id', $next->id)->whereKey($classId)->firstOrFail();

        if ($next->enrolment_confirmed_at) {
            throw ValidationException::withMessages([
                'class_id' => __('Enrolment is confirmed, so a class can no longer be emptied.'),
            ]);
        }

        DB::transaction(function () use ($actor, $school, $classId) {
            $moved = Enrolment::where('school_class_id', $classId)
                ->update(['school_class_id' => null, 'status' => EnrolmentStatus::Admitted]);

            AuditEvent::record($school, $actor, 'school_class', $classId, 'students_unplaced', ['students' => $moved]);
        });
    }

    /**
     * Put a student in a class. Before confirmation they are Placed;
     * afterwards a late arrival is Enrolled straight away.
     */
    protected function seat(School $school, AcademicYear $next, Enrolment $enrolment, SchoolClass $class): void
    {
        $confirmed = $next->enrolment_confirmed_at !== null;

        $enrolment->update([
            'school_class_id' => $class->id,
            'status' => $confirmed ? EnrolmentStatus::Enrolled : EnrolmentStatus::Placed,
        ]);

        if ($confirmed) {
            $this->billing->billPlacement($school, $next, $enrolment);
        }
    }

    private function assertYear(School $school, AcademicYear $next): void
    {
        if ($next->school_id !== $school->id) {
            throw new InvalidArgumentException('The academic year must belong to the school.');
        }
    }
}
