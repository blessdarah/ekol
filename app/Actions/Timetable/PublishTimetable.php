<?php

namespace App\Actions\Timetable;

use App\Enums\TimetableStatus;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\Term;
use App\Models\TimetableVersion;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Makes a term's draft timetable the live one: the version that was live
 * is archived and the draft takes its place from the effective date.
 */
class PublishTimetable
{
    /**
     * @param  array{effective_on: string}  $data
     */
    public function handle(School $school, Term $term, ?TimetableVersion $draft, ?User $actor, array $data): TimetableVersion
    {
        if ($term->school_id !== $school->id || ! AcademicYear::whereKey($term->academic_year_id)->where('school_id', $school->id)->exists()) {
            throw ValidationException::withMessages(['term' => __('The term must belong to the selected school and academic year.')]);
        }

        if (! $draft || $draft->school_id !== $school->id || $draft->term_id !== $term->id) {
            throw $this->noDraft();
        }

        $effectiveOn = Carbon::parse($data['effective_on'])->startOfDay();

        if ($effectiveOn->lt($term->starts_on) || $effectiveOn->gt($term->ends_on)) {
            throw ValidationException::withMessages(['effective_on' => __('Choose a date inside the term.')]);
        }

        return DB::transaction(function () use ($school, $term, $draft, $actor, $data) {
            Term::whereKey($term->id)->lockForUpdate()->firstOrFail();
            $version = TimetableVersion::whereKey($draft->id)->lockForUpdate()->firstOrFail();

            if ($version->status !== TimetableStatus::Draft) {
                throw $this->noDraft();
            }

            if ($version->slots->isEmpty() || $version->toFix() > 0) {
                throw ValidationException::withMessages([
                    'publish' => __('This version still has lessons to place or clashes to clear. Finish the review first.'),
                ]);
            }

            TimetableVersion::where('term_id', $term->id)
                ->where('status', TimetableStatus::Live)
                ->update(['status' => TimetableStatus::Archived]);

            $version->update([
                'status' => TimetableStatus::Live,
                'effective_on' => $data['effective_on'],
                'published_at' => now(),
                'published_by' => $actor?->id,
            ]);

            AuditEvent::record($school, $actor, 'timetable_version', $version->id, 'published', [
                'version' => $version->number,
                'effective_on' => $data['effective_on'],
            ]);

            return $version;
        });
    }

    private function noDraft(): ValidationException
    {
        return ValidationException::withMessages(['publish' => __('There is no draft timetable to publish.')]);
    }
}
