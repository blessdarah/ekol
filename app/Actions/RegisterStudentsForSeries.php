<?php

namespace App\Actions;

use App\Models\AuditEvent;
use App\Models\School;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Term;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RegisterStudentsForSeries
{
    /**
     * The chosen electives, checked against the series' pool and limits.
     *
     * @param  array<int, string>  $chosen
     * @return list<string>
     */
    public function electives(Series $series, array $chosen): array
    {
        $core = $series->subjects->where('pivot.kind', 'core');
        $pool = array_values($series->subjects->where('pivot.kind', 'elective')->modelKeys());

        if ($core->isEmpty()) {
            throw ValidationException::withMessages([
                'series_id' => __(':name has no core subjects yet. Set it up before registering students in it.', ['name' => $series->name]),
            ]);
        }

        if (array_diff($chosen, $pool) !== []) {
            throw ValidationException::withMessages([
                'electives' => __('Some of those subjects are not in the elective pool of :code.', ['code' => $series->code]),
            ]);
        }

        $total = $core->count() + count($chosen);

        if ($series->min_subjects !== null && $total < $series->min_subjects) {
            throw ValidationException::withMessages([
                'electives' => __(':code needs at least :min_subjects subjects. That is :total.', ['code' => $series->code, 'min_subjects' => $series->min_subjects, 'total' => $total]),
            ]);
        }

        if ($series->max_subjects !== null && $total > $series->max_subjects) {
            throw ValidationException::withMessages([
                'electives' => __(':code allows at most :max_subjects subjects. That is :total.', ['code' => $series->code, 'max_subjects' => $series->max_subjects, 'total' => $total]),
            ]);
        }

        return array_values($chosen);
    }

    /**
     * @param  Collection<int, Student>  $students
     * @param  list<string>  $electives
     */
    public function handle(School $school, ?User $actor, Term $term, Series $series, Collection $students, array $electives, bool $bulk = false): void
    {
        if ($term->school_id !== $school->id || $series->school_id !== $school->id || $students->contains(fn (Student $student) => $student->school_id !== $school->id)) {
            throw ValidationException::withMessages(['series_id' => __('The registration must belong to the same school.')]);
        }

        $electives = $this->electives($series, $electives);
        DB::transaction(function () use ($school, $actor, $term, $series, $students, $electives, $bulk) {
            foreach ($students as $student) {
                $registration = StudentSeries::updateOrCreate(
                    ['student_id' => $student->id, 'term_id' => $term->id],
                    ['series_id' => $series->id, 'chosen_by' => $actor?->id, 'chosen_at' => now()],
                );
                $registration->electives()->sync($electives);
                AuditEvent::record($school, $actor, 'student', $student->id, 'series_registered', ['series' => $series->code, ...($bulk ? ['bulk' => true] : [])]);
            }
        });
    }
}
