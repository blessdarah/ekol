<?php

namespace App\Http;

use App\Enums\EnrolmentStatus;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;

class FeeEnrolments
{
    /**
     * A year's enrolments with each student's invoices for that year.
     *
     * @return list<Enrolment>
     */
    public function handle(School $school, AcademicYear $year): array
    {
        $terms = Term::where('academic_year_id', $year->id)->pluck('id');

        return array_values(Enrolment::where('academic_year_id', $year->id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with([
                'schoolClass:id,name,level_id',
                'student' => fn ($query) => $query->with([
                    'invoices' => fn ($invoices) => $invoices->whereIn('term_id', $terms)->with(['installments', 'lines', 'payments', 'exemption']),
                ]),
            ])
            ->get()
            ->all());
    }
}
