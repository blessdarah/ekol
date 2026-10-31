<?php

namespace App\Actions;

use App\Models\AcademicYear;
use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenTermSchemes
{
    /**
     * @param  array{due_on: string, approval: string, starts_from: string, free_changes: bool|int|string}  $data
     */
    public function handle(School $school, Term $term, ?User $actor, array $data): int
    {
        if ($term->school_id !== $school->id || ! AcademicYear::whereKey($term->academic_year_id)->where('school_id', $school->id)->exists()) {
            throw ValidationException::withMessages(['term' => __('The term must belong to the selected school and academic year.')]);
        }

        return DB::transaction(function () use ($school, $term, $actor, $data) {
            $existing = SchemeOpening::where('term_id', $term->id)->first();
            if ($existing?->closed_at !== null) {
                throw ValidationException::withMessages(['due_on' => __(':term schemes are closed.', ['term' => __($term->label)])]);
            }

            $opening = SchemeOpening::updateOrCreate(['term_id' => $term->id], [
                'school_id' => $school->id,
                'due_on' => $data['due_on'],
                'approval' => $data['approval'],
                'starts_from' => $data['starts_from'],
                'free_changes' => (bool) $data['free_changes'],
                'opened_by' => $actor?->id,
            ]);

            $created = Scheme::openFor($opening, $actor);

            return $created;
        });
    }
}
