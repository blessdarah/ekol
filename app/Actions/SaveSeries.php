<?php

namespace App\Actions;

use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Level;
use App\Models\School;
use App\Models\Series;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaveSeries
{
    /**
     * Create or configure a series on its level, then apply the same
     * configuration to each other selected level. Unselected levels keep
     * their copies, because students may already be registered in them.
     *
     * @param  array{code: string, name: string, stream: string, min_subjects: int, max_subjects: int, level_ids: list<string>, core: list<string>, electives: list<string>}  $data
     */
    public function handle(School $school, ?User $actor, Level $level, ?AcademicYear $year, ?Series $series, array $data): Series
    {
        $this->ensureEligible($school, $level, $year, $series, $data);

        return DB::transaction(function () use ($school, $actor, $level, $series, $data) {
            $created = $series === null;
            $series ??= new Series(['school_id' => $school->id, 'level_id' => $level->id]);
            $series->fill($this->attributes($data))->save();

            $this->syncSubjects($series, $data);
            $this->applyToLevels($school, $series, $data);
            AuditEvent::record($school, $actor, 'series', $series->id, $created ? 'created' : 'configured', $data);

            return $series;
        });
    }

    /**
     * The source level and every selected level must carry series and
     * offer each chosen subject this year, within General plus the
     * series' own domain.
     *
     * @param  array{stream: string, level_ids: list<string>, core: list<string>, electives: list<string>}  $data
     */
    protected function ensureEligible(School $school, Level $level, ?AcademicYear $year, ?Series $series, array $data): void
    {
        if ($level->school_id !== $school->id || ($year !== null && $year->school_id !== $school->id)
            || ($series !== null && ($series->school_id !== $school->id || $series->level_id !== $level->id))) {
            throw ValidationException::withMessages(['level_id' => __('The series must belong to the same school.')]);
        }

        if (! $level->uses_series) {
            throw ValidationException::withMessages(['level_id' => __('Series can only be configured on a level that uses series.')]);
        }

        if (! in_array($data['stream'], Series::STREAMS, true)) {
            throw ValidationException::withMessages(['stream' => __('The selected stream is invalid.')]);
        }

        $eligible = Subject::forSeriesLevel($school, $level->id, $year, $data['stream'])->pluck('id')->all();

        foreach (['core', 'electives'] as $field) {
            if (array_diff($data[$field], $eligible) !== []) {
                throw ValidationException::withMessages([$field => __('Choose a subject assigned to this level for the current academic year.')]);
            }
        }

        $targets = array_values(array_unique(array_diff($data['level_ids'], [$level->id])));
        $known = Level::where('school_id', $school->id)->where('uses_series', true)->whereKey($targets)->count();

        if ($known !== count($targets)) {
            throw ValidationException::withMessages(['level_ids' => __('Every selected level must use series in this school.')]);
        }

        $subjectIds = array_unique([...$data['core'], ...$data['electives']]);

        foreach ($targets as $levelId) {
            $offered = Subject::forSeriesLevel($school, $levelId, $year, $data['stream'])->pluck('id')->all();

            if (array_diff($subjectIds, $offered) !== []) {
                throw ValidationException::withMessages(['level_ids' => __('Every selected level must offer all selected subjects in the current academic year.')]);
            }
        }
    }

    /**
     * @param  array{code: string, name: string, stream: string, min_subjects: int, max_subjects: int}  $data
     * @return array{code: string, name: string, stream: string, min_subjects: int, max_subjects: int}
     */
    protected function attributes(array $data): array
    {
        return [
            'code' => mb_strtoupper(trim($data['code'])),
            'name' => trim($data['name']),
            'stream' => $data['stream'],
            'min_subjects' => $data['min_subjects'],
            'max_subjects' => $data['max_subjects'],
        ];
    }

    /**
     * Core wins when a subject is sent in both lists.
     *
     * @param  array{core: list<string>, electives: list<string>}  $data
     */
    protected function syncSubjects(Series $series, array $data): void
    {
        $pivot = [];

        foreach ($data['electives'] as $subjectId) {
            $pivot[$subjectId] = ['kind' => 'elective'];
        }

        foreach ($data['core'] as $subjectId) {
            $pivot[$subjectId] = ['kind' => 'core'];
        }

        $series->subjects()->sync($pivot);
    }

    /**
     * The same series on each other selected level, matched by code, then
     * by name, or created when the level has neither.
     *
     * @param  array{code: string, name: string, stream: string, min_subjects: int, max_subjects: int, level_ids: list<string>, core: list<string>, electives: list<string>}  $data
     */
    protected function applyToLevels(School $school, Series $series, array $data): void
    {
        foreach (array_diff($data['level_ids'], [$series->level_id]) as $levelId) {
            $copy = Series::where('school_id', $school->id)->where('level_id', $levelId)->where('code', $series->code)->first()
                ?? Series::where('school_id', $school->id)->where('level_id', $levelId)->where('name', $series->name)->first()
                ?? new Series(['school_id' => $school->id, 'level_id' => $levelId]);

            $copy->fill($this->attributes($data))->save();
            $this->syncSubjects($copy, $data);
        }
    }
}
