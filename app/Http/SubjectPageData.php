<?php

namespace App\Http;

use App\Http\Controllers\Concerns\ListsTables;
use App\Models\AcademicYear;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SubjectPageData
{
    use ListsTables;

    /**
     * Subjects with a class that has no teacher, no class at all, or a
     * series that should teach them but does not.
     *
     * @param  array<string, list<string>>  $gaps
     * @return \Closure(Builder<Subject>): Builder<Subject>
     */
    public function unstaffed(array $gaps): \Closure
    {
        return fn (Builder $query) => $query
            ->whereHas('classSubjects', fn (Builder $rows) => $rows->whereNull('staff_id'))
            ->orDoesntHave('classSubjects')
            ->orWhereIn('id', array_keys($gaps));
    }

    /**
     * The subject query with the filters, search and sort from the page
     * address applied, the filters as the page shows them, and the same
     * in words for an export.
     *
     * @param  array<string, list<string>>  $gaps
     * @return array{0: Builder<Subject>, 1: array<string, mixed>, 2: list<string>}
     */
    public function list(Request $request, School $school, array $gaps): array
    {
        $search = trim((string) $request->query('q', ''));
        $departments = $this->many($request, 'department');
        $levels = $this->many($request, 'level');
        $staffing = in_array($request->query('staffing'), ['needs', 'staffed'], true) ? (string) $request->query('staffing') : '';
        [$sort, $direction] = $this->sorting($request, ['code', 'name', 'department'], 'code');
        $unstaffed = $this->unstaffed($gaps);

        $query = Subject::where('school_id', $school->id)
            ->when($departments !== [], fn (Builder $query) => $query->whereIn('department', $departments))
            ->when($staffing === 'needs', fn (Builder $query) => $query->where($unstaffed))
            ->when($staffing === 'staffed', fn (Builder $query) => $query->whereNot($unstaffed))
            ->when($levels !== [], fn (Builder $query) => $query->whereHas(
                'classSubjects.schoolClass',
                fn (Builder $classes) => $classes->whereIn('level_id', $levels),
            ))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('name', "%{$search}%")
                ->orWhereLike('code', "%{$search}%")
                ->orWhereHas('classSubjects.staff', fn (Builder $staff) => $staff->whereLike('full_name', "%{$search}%"))));

        match ($sort) {
            'name' => $query->orderBy('name', $direction),
            'department' => $query->orderBy('department', $direction)->orderBy('code'),
            default => $query->orderBy('code', $direction),
        };

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $departments !== [] ? $this->say('Department: :value', ['value' => implode(', ', $departments)]) : null,
            $levels !== [] ? $this->say('Level: :value', ['value' => Level::whereIn('id', $levels)->orderBy('ordinal')->pluck('name')->join(', ')]) : null,
            $staffing !== '' ? $this->say('Staffing: :value', ['value' => $staffing === 'needs' ? $this->say('Needs a teacher') : $this->say('Fully staffed')]) : null,
        ]));

        return [$query, [
            'q' => $search,
            'department' => $departments,
            'level' => $levels,
            'staffing' => $staffing,
            'sort' => ($direction === 'desc' ? '-' : '').$sort,
        ], $applied];
    }

    /**
     * Levels, this year's classes and the staff a class can be given to.
     *
     * @return array<string, mixed>
     */
    public function pickers(School $school, ?AcademicYear $year): array
    {
        $classes = $year
            ? SchoolClass::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->orderBy('name')
                ->get()
            : new Collection;

        $students = $this->studentCounts($classes->modelKeys());

        return [
            'levels' => Level::where('school_id', $school->id)
                ->orderBy('ordinal')
                ->get()
                ->map(fn (Level $level) => $level->only(['id', 'name', 'code'])),
            'classes' => $classes->map(fn (SchoolClass $class) => [
                'id' => $class->id,
                'name' => $class->name,
                'level_id' => $class->level_id,
                'students' => (int) ($students[$class->id] ?? 0),
            ]),
            'staff' => User::where('school_id', $school->id)
                ->orderByRaw('COALESCE(family_name, full_name)')
                ->get()
                ->map(fn (User $member) => ['id' => $member->id, 'name' => $member->formalName()]),
        ];
    }

    /**
     * @param  array<int, string>  $classIds
     * @return \Illuminate\Support\Collection<string, int>
     */
    public function studentCounts(array $classIds): \Illuminate\Support\Collection
    {
        return Enrolment::whereIn('school_class_id', $classIds)
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id');
    }

    /**
     * Series subjects that a class of the series' level does not take
     * at all, so nobody teaches them there: subject id to class names.
     * Students of that class can register for the series, and their
     * marks would have no sheet.
     *
     * @return array<string, list<string>>
     */
    public function seriesGaps(School $school, ?AcademicYear $year): array
    {
        if (! $year) {
            return [];
        }

        $classes = SchoolClass::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->orderBy('name')
            ->get(['id', 'name', 'level_id'])
            ->groupBy('level_id');
        $taken = ClassSubject::where('school_id', $school->id)
            ->get(['school_class_id', 'subject_id'])
            ->mapWithKeys(fn (ClassSubject $row) => ["{$row->school_class_id}|{$row->subject_id}" => true]);
        $gaps = [];

        foreach (Series::where('school_id', $school->id)->with('subjects:id')->get() as $series) {
            foreach ($classes->get($series->level_id, []) as $class) {
                foreach ($series->subjects as $subject) {
                    if (! $taken->has("{$class->id}|{$subject->id}") && ! in_array($class->name, $gaps[$subject->id] ?? [], true)) {
                        $gaps[$subject->id][] = $class->name;
                    }
                }
            }
        }

        return $gaps;
    }

    /**
     * The roster row for a subject with its class rows loaded.
     *
     * @return array<string, mixed>
     */
    public function summary(Subject $subject): array
    {
        $rows = $subject->classSubjects;
        $levels = $rows
            ->map(fn (ClassSubject $row) => $row->schoolClass?->level)
            ->filter()
            ->unique('id')
            ->sortBy('ordinal')
            ->values();

        $core = $subject->series->firstWhere('pivot.kind', 'core');
        $elective = $subject->series->firstWhere('pivot.kind', 'elective');

        return [
            'id' => $subject->id,
            'name' => $subject->name,
            'code' => $subject->code,
            'department' => $subject->department,
            'domain' => $subject->domain?->value,
            'kind' => match (true) {
                $core !== null => 'Series core',
                $elective !== null => Str::ucfirst($elective->stream ?? 'series').' elective',
                default => 'Common subject',
            },
            'levels' => $levels->map(fn (Level $level) => $level->code ?? $level->name)->all(),
            'levels_label' => $this->levelRange($levels),
            'coefficient' => $subject->coefficient !== null ? (float) $subject->coefficient : null,
            'classes' => $rows->count(),
            'teachers' => $rows->pluck('staff_id')->filter()->unique()->count(),
            'unstaffed' => $rows->whereNull('staff_id')->count(),
            'periods' => (int) $rows->sum('weekly_periods'),
        ];
    }

    /**
     * "F1–F5", or the single code, for levels already in school order.
     *
     * @param  \Illuminate\Support\Collection<int, Level>  $levels
     */
    public function levelRange(\Illuminate\Support\Collection $levels): string
    {
        $codes = $levels->map(fn (Level $level) => $level->code ?? $level->name)->values();

        return match (true) {
            $codes->isEmpty() => '—',
            $codes->count() === 1 => (string) $codes->first(),
            default => $codes->first().'–'.$codes->last(),
        };
    }
}
