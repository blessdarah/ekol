<?php

namespace App\Http;

use App\Models\AcademicYear;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\School;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Subject;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\Pivot;

class SeriesRegistrationPageData
{
    /**
     * Whether a series carries the subject as core or elective.
     */
    public function kind(Subject $subject): string
    {
        $pivot = $subject->getRelationValue('pivot');

        return $pivot instanceof Pivot ? (string) $pivot->getAttribute('kind') : '';
    }

    /**
     * @return Collection<int, Level>
     */
    public function levels(School $school): Collection
    {
        return Level::where('school_id', $school->id)
            ->where('uses_series', true)
            ->orderBy('ordinal')
            ->get();
    }

    /**
     * This year's students of a level, each carrying their class.
     *
     * @return Builder<Student>
     */
    public function students(School $school, ?AcademicYear $year, Level $level): Builder
    {
        return Student::query()
            ->where('students.school_id', $school->id)
            ->join('enrolments', fn ($join) => $join
                ->on('enrolments.student_id', '=', 'students.id')
                ->where('enrolments.academic_year_id', '=', $year?->id))
            ->join('school_classes', fn ($join) => $join
                ->on('school_classes.id', '=', 'enrolments.school_class_id')
                ->where('school_classes.level_id', '=', $level->id))
            ->select('students.*', 'school_classes.id as class_id', 'school_classes.name as class_name');
    }

    /**
     * @return Builder<StudentSeries>
     */
    public function registrations(?Term $term, Level $level): Builder
    {
        return StudentSeries::query()
            ->where('term_id', $term?->id)
            ->whereIn('series_id', Series::where('level_id', $level->id)->select('id'));
    }

    /**
     * The level's series with their subjects, as the pickers need them.
     *
     * @return array<int, array<string, mixed>>
     */
    public function seriesOptions(Level $level): array
    {
        return Series::where('level_id', $level->id)
            ->with('subjects:id,name')
            ->orderByDesc('stream')
            ->orderBy('code')
            ->get()
            ->map(fn (Series $series) => [
                'id' => $series->id,
                'code' => $series->code,
                'name' => $series->name,
                'stream' => $series->stream ?? 'science',
                'min' => $series->min_subjects,
                'max' => $series->max_subjects,
                'complete' => $series->subjects->where('pivot.kind', 'core')->isNotEmpty(),
                'subjects' => $series->subjects
                    ->sortBy(fn (Subject $subject) => ($this->kind($subject) === 'core' ? '0' : '1').$subject->name)
                    ->map(fn (Subject $subject) => [
                        'id' => $subject->id,
                        'name' => $subject->name,
                        'kind' => $this->kind($subject),
                    ])
                    ->values(),
            ])
            ->all();
    }

    /**
     * Who teaches each subject in the given classes; subjects with no
     * teacher there are simply absent.
     *
     * @param  array<int, string>  $classIds
     * @return array<string, string>
     */
    public function teachers(array $classIds): array
    {
        return ClassSubject::whereIn('school_class_id', $classIds)
            ->whereNotNull('staff_id')
            ->with('staff:id,full_name')
            ->get()
            ->mapWithKeys(fn (ClassSubject $row) => [$row->subject_id => (string) $row->staff?->full_name])
            ->all();
    }

    /**
     * Subjects students already take with no teacher in their class.
     *
     * @param  Collection<int, Student>  $students
     * @param  \Illuminate\Support\Collection<array-key, StudentSeries>  $registrations
     * @param  Collection<int, Series>  $series
     * @return array<int, array{id: string, name: string, students: int}>
     */
    public function unstaffed(School $school, Collection $students, \Illuminate\Support\Collection $registrations, Collection $series): array
    {
        $classIds = $students->map(fn (Student $student) => (string) $student->getAttribute('class_id'))->unique()->all();
        $staffed = ClassSubject::whereIn('school_class_id', $classIds)
            ->whereNotNull('staff_id')
            ->get()
            ->mapWithKeys(fn (ClassSubject $row) => ["{$row->school_class_id}|{$row->subject_id}" => true]);
        $core = $series->mapWithKeys(fn (Series $item) => [
            $item->id => array_values($item->subjects->where('pivot.kind', 'core')->modelKeys()),
        ]);
        $counts = [];

        foreach ($students as $student) {
            $registration = $registrations->get($student->id);

            if (! $registration) {
                continue;
            }

            foreach ([...($core[$registration->series_id] ?? []), ...$registration->electives->modelKeys()] as $subjectId) {
                if (! $staffed->has($student->getAttribute('class_id').'|'.$subjectId)) {
                    $counts[$subjectId] = ($counts[$subjectId] ?? 0) + 1;
                }
            }
        }

        return Subject::where('school_id', $school->id)
            ->whereIn('id', array_keys($counts))
            ->orderBy('name')
            ->get()
            ->map(fn (Subject $subject) => [
                'id' => $subject->id,
                'name' => $subject->name,
                'students' => $counts[$subject->id],
            ])
            ->all();
    }
}
