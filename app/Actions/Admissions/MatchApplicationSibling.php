<?php

namespace App\Actions\Admissions;

use App\Models\Application;
use App\Models\School;
use App\Models\Student;
use App\Models\StudentGuardian;
use Illuminate\Database\Eloquent\Builder;

class MatchApplicationSibling
{
    /**
     * A student already here who shares a parent's phone number.
     */
    public function handle(School $school, Application $application, ?string $exceptId = null): ?Student
    {
        foreach ($application->guardians as $guardian) {
            $digits = preg_replace('/\D+/', '', (string) $guardian['phone']) ?? '';

            if (strlen($digits) < 9) {
                continue;
            }

            $match = StudentGuardian::query()
                ->whereRaw("REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE ?", ['%'.substr($digits, -9)])
                ->whereHas('student', fn (Builder $query) => $query
                    ->where('school_id', $school->id)
                    ->when($exceptId ?? $application->student_id, fn (Builder $inner, string $id) => $inner->where('id', '!=', $id)))
                ->with('student')
                ->first();

            if ($match?->student) {
                return $match->student;
            }
        }

        return null;
    }
}
