<?php

namespace App\Actions\Students;

use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdmitStudent
{
    /**
     * @param  array<string, mixed>  $profile
     * @param  list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}>  $guardians
     */
    public function handle(School $school, AcademicYear $year, ?Term $term, SchoolClass $class, array $profile, array $guardians, ?User $actor, ?Series $series = null, ?string $siblingId = null, bool $allowDuplicate = false): Student
    {
        abort_unless($year->school_id === $school->id && $class->school_id === $school->id
            && $class->academic_year_id === $year->id
            && ($term === null || ($term->school_id === $school->id && $term->academic_year_id === $year->id))
            && ($series === null || ($series->school_id === $school->id && $series->level_id === $class->level_id))
            && ($actor === null || $actor->school_id === null || $actor->school_id === $school->id), 404);

        return DB::transaction(function () use ($school, $year, $term, $class, $profile, $guardians, $actor, $series, $siblingId, $allowDuplicate): Student {
            School::whereKey($school->id)->lockForUpdate()->firstOrFail();
            $class = SchoolClass::where('school_id', $school->id)->whereKey($class->id)->lockForUpdate()->firstOrFail();
            $taken = Enrolment::where('school_class_id', $class->id)->count();

            if ($taken >= $class->capacity) {
                throw ValidationException::withMessages([
                    'class_id' => __(':name is full, :taken of :capacity. Choose another class or add seats under Levels.', ['name' => $class->name, 'taken' => $taken, 'capacity' => $class->capacity]),
                ]);
            }

            $twin = Student::where('school_id', $school->id)
                ->whereRaw('LOWER(full_name) = ?', [mb_strtolower((string) $profile['full_name'])])
                ->whereDate('date_of_birth', $profile['date_of_birth'])->first();

            if ($twin && ! $allowDuplicate) {
                throw ValidationException::withMessages([
                    'duplicate' => __(':full_name (:admission_no) has the same name and date of birth.', ['full_name' => $twin->full_name, 'admission_no' => $twin->admission_no]),
                ]);
            }

            $student = Student::admit($school, $year, $term, $class, $profile, $guardians, $series);

            if ($siblingId !== null && $siblingId !== $student->id) {
                $sibling = Student::where('school_id', $school->id)->whereKey($siblingId)->firstOrFail();
                $family = $sibling->family_id ?? (string) Str::uuid7();
                $sibling->update(['family_id' => $family]);
                $student->update(['family_id' => $family]);
            }

            AuditEvent::record($school, $actor, 'student', $student->id, 'admitted', [
                'matricule' => $student->admission_no,
                'class' => $class->name,
            ]);

            return $student;
        });
    }
}
