<?php

namespace App\Actions\Admissions;

use App\Enums\ApplicationStage;
use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DecideApplication
{
    public function __construct(private MatchApplicationSibling $siblings) {}

    public function handle(School $school, AcademicYear $year, Application $application, ?User $actor, ApplicationStage $stage, ?string $condition = null): void
    {
        abort_unless($year->school_id === $school->id && $application->school_id === $school->id
            && $application->academic_year_id === $year->id
            && ($actor === null || $actor->school_id === null || $actor->school_id === $school->id), 404);

        DB::transaction(function () use ($school, $year, $application, $actor, $stage, $condition): void {
            School::whereKey($school->id)->lockForUpdate()->firstOrFail();
            $target = Application::where('school_id', $school->id)->whereKey($application->id)->lockForUpdate()->firstOrFail();
            abort_unless(Level::where('school_id', $school->id)->whereKey($target->level_id)->exists(), 404);

            if ($target->stage === ApplicationStage::Admitted) {
                throw ValidationException::withMessages([
                    'decision' => __(':full_name is already admitted. Change the student record instead.', ['full_name' => $target->full_name]),
                ]);
            }

            $target->fill([
                'stage' => $stage,
                'condition' => $stage === ApplicationStage::Admitted ? $condition : null,
                'decided_by' => $actor?->id,
                'decided_at' => now(),
            ]);

            if ($stage === ApplicationStage::Admitted) {
                $target->student_id = $this->admit($school, $year, $target)->id;
            }

            $target->save();
            AuditEvent::record($school, $actor, 'application', $target->id, $stage->value, ['student' => $target->student_id]);
        });
    }

    /**
     * Turn an application into a student: a matricule of the coming
     * year, the parents, a sibling link when a parent's phone is already
     * known, and a row waiting for a class in the level applied for.
     */
    protected function admit(School $school, AcademicYear $year, Application $application): Student
    {
        $student = Student::register($school, [
            'surname' => $application->surname,
            'given_names' => $application->given_names,
            'full_name' => $application->full_name,
            'date_of_birth' => $application->date_of_birth->toDateString(),
            'gender' => $application->gender,
            'place_of_birth' => $application->place_of_birth,
            'religion' => $application->religion,
            'has_disability' => $application->disability !== null,
            'disability_support' => $application->disability,
            'transferred' => $application->transferred,
            'previous_school' => $application->previous_school,
            'previous_class' => $application->previous_class,
            'transfer_certificate_received' => in_array('transfer_certificate', $application->documents, true),
            'last_report_received' => in_array('last_report', $application->documents, true),
        ], $application->guardians, $year->starts_on);

        $sibling = $this->siblings->handle($school, $application, $student->id);

        if ($sibling) {
            $family = $sibling->family_id ?? (string) Str::uuid7();
            $sibling->update(['family_id' => $family]);
            $student->update(['family_id' => $family]);
        }

        Enrolment::create([
            'student_id' => $student->id,
            'academic_year_id' => $year->id,
            'level_id' => $application->level_id,
            'status' => EnrolmentStatus::Admitted,
        ]);

        return $student;
    }
}
