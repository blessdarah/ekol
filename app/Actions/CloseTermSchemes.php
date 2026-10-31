<?php

namespace App\Actions;

use App\Enums\SchemeStatus;
use App\Models\AcademicYear;
use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloseTermSchemes
{
    public function handle(School $school, Term $term, ?User $actor, bool $openNext): int
    {
        if ($term->school_id !== $school->id || ! AcademicYear::whereKey($term->academic_year_id)->where('school_id', $school->id)->exists()) {
            throw ValidationException::withMessages(['term' => __('The term must belong to the selected school and academic year.')]);
        }

        $opening = SchemeOpening::where('term_id', $term->id)->where('school_id', $school->id)->firstOrFail();
        if ($opening->closed_at !== null) {
            return 0;
        }
        $lastWeek = collect(Scheme::weeks($term))->last();
        if ($lastWeek === null || today()->lt($lastWeek['starts_on'])) {
            throw ValidationException::withMessages(['open_next' => __('The term can close only in its last week.')]);
        }

        $opened = 0;

        DB::transaction(function () use ($actor, $term, $opening, $openNext, &$opened) {
            foreach (Scheme::where('term_id', $term->id)->where('status', '!=', SchemeStatus::Closed)->get() as $scheme) {
                $scheme->update(['status' => SchemeStatus::Closed, 'closed_at' => now()]);
                $scheme->record('closed', $actor);
            }

            $opening->update(['closed_at' => now(), 'closed_by' => $actor?->id]);
            $nextTerm = Term::where('academic_year_id', $term->academic_year_id)->where('sequence', $term->sequence + 1)->first();

            if ($openNext && $nextTerm) {
                $next = SchemeOpening::firstOrCreate(['term_id' => $nextTerm->id], [
                    'school_id' => $term->school_id,
                    'due_on' => $nextTerm->starts_on->copy()->addDays(18),
                    'approval' => $opening->approval,
                    'starts_from' => SchemeOpening::FROM_SYLLABUS,
                    'free_changes' => $opening->free_changes,
                    'opened_by' => $actor?->id,
                ]);
                $opened = Scheme::openFor($next, $actor);
            }
        });

        return $opened;
    }
}
