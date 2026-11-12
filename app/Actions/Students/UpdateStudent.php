<?php

namespace App\Actions\Students;

use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UpdateStudent
{
    /**
     * Columns only written by actors allowed to see private student details,
     * so a save by anyone else cannot blank or replace them.
     */
    public const PRIVATE_FIELDS = ['religion', 'has_disability', 'disability_types', 'disability_support'];

    /**
     * Save a student's profile and parents, place them in a class of the
     * current year and record their series for the current term. Without a
     * current year the class is left alone; without a current term so is the
     * series. A null series clears the current term's series.
     *
     * @param  array<string, mixed>  $profile
     * @param  list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}>  $guardians
     */
    public function handle(School $school, ?User $actor, ?AcademicYear $year, ?Term $term, Student $student, SchoolClass $class, array $profile, array $guardians, ?Series $series = null, ?string $siblingId = null, bool $allowDuplicate = false): Student
    {
        abort_unless($student->school_id === $school->id && $class->school_id === $school->id
            && ($year === null || ($year->school_id === $school->id && $class->academic_year_id === $year->id))
            && ($term === null || ($term->school_id === $school->id && ($year === null || $term->academic_year_id === $year->id)))
            && ($series === null || ($series->school_id === $school->id && $series->level_id === $class->level_id))
            && ($actor === null || $actor->school_id === null || $actor->school_id === $school->id), 404);

        if (! $actor?->can('see-private-student-details')) {
            $profile = Arr::except($profile, self::PRIVATE_FIELDS);
        }

        return DB::transaction(function () use ($school, $actor, $year, $term, $student, $class, $profile, $guardians, $series, $siblingId, $allowDuplicate): Student {
            $student = Student::where('school_id', $school->id)->whereKey($student->id)->lockForUpdate()->firstOrFail();

            if ($year) {
                $class = SchoolClass::where('school_id', $school->id)->whereKey($class->id)->lockForUpdate()->firstOrFail();
                $taken = Enrolment::where('school_class_id', $class->id)->where('student_id', '!=', $student->id)->count();

                if ($taken >= $class->capacity) {
                    throw ValidationException::withMessages([
                        'class_id' => __(':name is full, :taken of :capacity. Choose another class or add seats under Levels.', ['name' => $class->name, 'taken' => $taken, 'capacity' => $class->capacity]),
                    ]);
                }
            }

            if (isset($profile['full_name'], $profile['date_of_birth'])) {
                $twin = Student::where('school_id', $school->id)
                    ->whereRaw('LOWER(full_name) = ?', [mb_strtolower((string) $profile['full_name'])])
                    ->whereDate('date_of_birth', $profile['date_of_birth'])
                    ->where('id', '!=', $student->id)
                    ->first();

                if ($twin && ! $allowDuplicate) {
                    throw ValidationException::withMessages([
                        'duplicate' => __(':full_name (:admission_no) has the same name and date of birth.', ['full_name' => $twin->full_name, 'admission_no' => $twin->admission_no]),
                    ]);
                }
            }

            $student->update($profile);
            $student->replaceGuardians($guardians);

            if ($year) {
                Enrolment::updateOrCreate(
                    ['student_id' => $student->id, 'academic_year_id' => $year->id],
                    ['school_class_id' => $class->id],
                );
            }

            if ($term) {
                if ($series) {
                    StudentSeries::updateOrCreate(
                        ['student_id' => $student->id, 'term_id' => $term->id],
                        ['series_id' => $series->id],
                    );
                } else {
                    StudentSeries::where('student_id', $student->id)->where('term_id', $term->id)->delete();
                }
            }

            if ($siblingId !== null && $siblingId !== $student->id) {
                $sibling = Student::where('school_id', $school->id)->whereKey($siblingId)->firstOrFail();
                $family = $sibling->family_id ?? $student->family_id ?? (string) Str::uuid7();
                $sibling->update(['family_id' => $family]);
                $student->update(['family_id' => $family]);
            }

            AuditEvent::record($school, $actor, 'student', $student->id, 'updated', ['class_id' => $class->id]);

            return $student;
        });
    }
}
