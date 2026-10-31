<?php

namespace App\Actions\Students;

use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ImportStudents
{
    /**
     * @param  list<array{name: string, class_id: string, date_of_birth: string, gender: string, guardian_name: string, guardian_phone: string, place_of_birth: string|null}>  $rows
     */
    public function handle(School $school, AcademicYear $year, ?Term $term, ?User $actor, array $rows, string $fileName): int
    {
        abort_unless($year->school_id === $school->id
            && ($term === null || ($term->school_id === $school->id && $term->academic_year_id === $year->id))
            && ($actor === null || $actor->school_id === null || $actor->school_id === $school->id), 404);

        return DB::transaction(function () use ($school, $year, $term, $actor, $rows, $fileName): int {
            School::whereKey($school->id)->lockForUpdate()->firstOrFail();
            $classes = SchoolClass::where('school_id', $school->id)->where('academic_year_id', $year->id)
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $existing = Student::where('school_id', $school->id)->get(['full_name', 'date_of_birth'])
                ->mapWithKeys(fn (Student $student) => [Str::lower($student->full_name).'|'.$student->date_of_birth->toDateString() => true]);
            $seats = Enrolment::whereIn('school_class_id', $classes->modelKeys())
                ->selectRaw('school_class_id, COUNT(*) as total')->groupBy('school_class_id')
                ->pluck('total', 'school_class_id');
            $imported = 0;

            foreach ($rows as $row) {
                $class = $classes->get($row['class_id']);
                $key = Str::lower($row['name']).'|'.$row['date_of_birth'];

                if (! $class || $existing->has($key) || (int) $seats->get($class->id, 0) >= $class->capacity) {
                    throw ValidationException::withMessages([
                        'file' => __('The student import changed. Review the rows and try again.'),
                    ]);
                }

                [$surname, $given] = array_pad(explode(' ', $row['name'], 2), 2, '');
                Student::admit($school, $year, $term, $class, [
                    'surname' => $surname,
                    'given_names' => $given !== '' ? $given : $surname,
                    'full_name' => $row['name'],
                    'date_of_birth' => $row['date_of_birth'],
                    'gender' => $row['gender'],
                    'place_of_birth' => $row['place_of_birth'],
                ], [[
                    'relation' => 'guardian',
                    'name' => $row['guardian_name'],
                    'phone' => $row['guardian_phone'],
                    'occupation' => null,
                    'is_main' => true,
                ]]);
                $existing->put($key, true);
                $seats->put($class->id, (int) $seats->get($class->id, 0) + 1);
                $imported++;
            }

            AuditEvent::record($school, $actor, 'student_import', $school->id, 'imported', ['file' => $fileName, 'students' => $imported]);

            return $imported;
        });
    }
}
