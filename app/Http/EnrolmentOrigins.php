<?php

namespace App\Http;

use App\Enums\EnrolmentDecision;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\School;
use Illuminate\Database\Eloquent\Collection;

class EnrolmentOrigins
{
    /**
     * Where each student of the coming year comes from: promoted or
     * repeating from one of this year's classes, or new to the school.
     *
     * @param  Collection<int, Enrolment>  $enrolments
     * @return array<string, array{kind: string, from: string|null}>
     */
    public function handle(School $school, ?AcademicYear $currentYear, Collection $enrolments): array
    {
        $current = Enrolment::continuingFor($school, $currentYear)->keyBy('student_id');
        $origins = [];

        foreach ($enrolments as $enrolment) {
            $before = $current->get($enrolment->student_id);

            $origins[$enrolment->student_id] = [
                'kind' => match (true) {
                    ! $before => 'new',
                    $before->decision === EnrolmentDecision::Repeat => 'repeating',
                    default => 'promoted',
                },
                'from' => $before?->schoolClass?->name,
            ];
        }

        return $origins;
    }
}
