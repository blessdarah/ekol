<?php

namespace App\Actions;

use App\Enums\AcademicYearStatus;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ActivateAcademicYear
{
    /**
     * Make a year the school's current one. The year it replaces closes
     * when it started earlier and returns to planned otherwise, and the
     * active term moves into the new year (today's term, else the first;
     * a year without terms leaves the school with no active term).
     *
     * Returns false when the year was already current and nothing changed.
     */
    public function handle(School $school, AcademicYear $target, ?User $actor): bool
    {
        if ($target->school_id !== $school->id) {
            throw new InvalidArgumentException('The academic year must belong to the school.');
        }

        return DB::transaction(function () use ($school, $target, $actor) {
            School::whereKey($school->id)->lockForUpdate()->firstOrFail();
            $target->refresh();

            if ($target->status === AcademicYearStatus::Current) {
                return false;
            }

            $previousYears = AcademicYear::where('school_id', $school->id)
                ->where('status', AcademicYearStatus::Current)
                ->get();

            foreach ($previousYears as $previous) {
                $previous->update([
                    'status' => $previous->starts_on->lt($target->starts_on)
                        ? AcademicYearStatus::Closed
                        : AcademicYearStatus::Planned,
                ]);
            }

            $target->update(['status' => AcademicYearStatus::Current]);

            Term::where('school_id', $school->id)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            $terms = Term::where('school_id', $school->id)
                ->where('academic_year_id', $target->id)
                ->orderBy('sequence')
                ->get();
            $term = $terms->first(fn (Term $term) => today()->between($term->starts_on, $term->ends_on))
                ?? $terms->first();

            if ($term) {
                Term::whereKey($term->id)->update(['is_current' => true]);
            }

            AuditEvent::record($school, $actor, 'academic_year', $target->id, 'activated', [
                'label' => $target->label,
            ]);

            return true;
        });
    }
}
