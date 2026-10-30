<?php

namespace App\Http\Controllers;

use App\Enums\CoefficientStatus;
use App\Http\Controllers\Concerns\ListsTables;
use App\Http\Requests\Subjects\SaveSubjectRequest;
use App\Http\Requests\Subjects\StoreSubjectTemplatesRequest;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Coefficient;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SubjectController extends Controller
{
    use ListsTables;

    public const array DEPARTMENTS = ['Sciences', 'Languages', 'Arts', 'Technical', 'Commercial', 'General'];

    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $gaps = $this->seriesGaps($school, $year);
        [$query, $filters] = $this->list($request, $school, $gaps);

        $subjects = $query
            ->with(['classSubjects.schoolClass.level:id,code,name,ordinal', 'series:id,stream'])
            ->paginate($this->perPage($request))
            ->withQueryString();

        $all = Subject::where('school_id', $school->id);
        $departments = $all->clone()
            ->selectRaw('department, COUNT(*) as total')
            ->groupBy('department')
            ->orderByDesc('total')
            ->orderBy('department')
            ->pluck('total', 'department');

        return Inertia::render('subjects/roster', [
            'yearLabel' => $year?->label,
            'counts' => [
                'total' => $all->clone()->count(),
                'departments' => $departments->count(),
                'needs_teacher' => $all->clone()->where($this->unstaffed($gaps))->count(),
            ],
            'departments' => $departments->map(fn (int $total, string $name) => ['name' => $name, 'count' => $total])->values(),
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'filters' => $filters,
            'subjects' => [
                'rows' => collect($subjects->items())->map(fn (Subject $subject) => [
                    ...$this->summary($subject),
                    'not_taught' => $gaps[$subject->id] ?? [],
                ]),
                'page' => $subjects->currentPage(),
                'lastPage' => $subjects->lastPage(),
                'total' => $subjects->total(),
                'perPage' => $subjects->perPage(),
                'from' => $subjects->firstItem(),
                'to' => $subjects->lastItem(),
            ],
        ]);
    }

    /**
     * The subject roster as it is filtered on screen, as a CSV file or a
     * list to print. Selected rows narrow it to those subjects only.
     */
    public function export(Request $request): StreamedResponse|Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $gaps = $this->seriesGaps($school, $year);
        [$query, , $applied] = $this->list($request, $school, $gaps);
        $ids = $this->exportIds($request);

        $subjects = $query
            ->with(['classSubjects.schoolClass.level:id,code,name,ordinal', 'classSubjects.staff:id,full_name', 'series:id,stream'])
            ->when($ids !== [], fn (Builder $query) => $query->whereIn('id', $ids))
            ->get();

        $rows = $subjects->map(function (Subject $subject) {
            $summary = $this->summary($subject);

            return [
                'name' => $summary['name'],
                'code' => $summary['code'],
                'department' => $summary['department'],
                'kind' => $this->say($summary['kind']),
                'levels' => implode(', ', $summary['levels']),
                'coefficient' => $summary['coefficient'] ?? '',
                'classes' => $summary['classes'],
                'teachers' => $subject->classSubjects->map(fn (ClassSubject $row) => $row->staff?->full_name)->filter()->unique()->sort()->join(', '),
                'unstaffed' => $summary['unstaffed'],
                'periods' => $summary['periods'],
            ];
        });

        return $this->sendExport($request, $school, $this->say('Subjects'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Subject'),
            'code' => $this->say('Code'),
            'department' => $this->say('Department'),
            'kind' => $this->say('Kind'),
            'levels' => $this->say('Levels'),
            'coefficient' => $this->say('Coeff.'),
            'classes' => $this->say('Classes'),
            'teachers' => $this->say('Teachers'),
            'unstaffed' => $this->say('Classes without a teacher'),
            'periods' => $this->say('Periods a week'),
        ], $rows, $rows->count());
    }

    /**
     * Subjects with a class that has no teacher, no class at all, or a
     * series that should teach them but does not.
     *
     * @param  array<string, list<string>>  $gaps
     * @return \Closure(Builder<Subject>): Builder<Subject>
     */
    protected function unstaffed(array $gaps): \Closure
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
    protected function list(Request $request, School $school, array $gaps): array
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

    public function create(Request $request): Response
    {
        $school = $this->schoolContext->school();

        return $this->form($school, null);
    }

    public function edit(Request $request, string $subject): Response
    {
        $school = $this->schoolContext->school();

        return $this->form($school, $this->subject($school, $subject));
    }

    public function store(SaveSubjectRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $data = $this->validated($request);

        $subject = DB::transaction(function () use ($request, $school, $data) {
            $subject = $this->save($school, new Subject(['school_id' => $school->id]), $data);
            $this->audit($request, $school, $subject, 'registered', ['code' => $subject->code]);

            return $subject;
        });

        $this->notify('Subject saved.');

        return redirect()->route('classes.subjects.show', $subject->id);
    }

    public function update(SaveSubjectRequest $request, string $subject): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->subject($school, $subject);
        $data = $this->validated($request);

        DB::transaction(function () use ($request, $school, $target, $data) {
            $before = $target->only(['name', 'code', 'department', 'coefficient']);
            $this->save($school, $target, $data);
            $this->audit($request, $school, $target, 'updated', [
                'before' => $before,
                'after' => $target->only(['name', 'code', 'department', 'coefficient']),
                'classes' => count($data['classes']),
            ]);
        });

        $this->notify('Subject saved.');

        return redirect()->route('classes.subjects.show', $target->id);
    }

    public function show(Request $request, string $subject): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $target = $this->subject($school, $subject)
            ->load(['classSubjects.schoolClass.level:id,code,name,ordinal', 'classSubjects.staff:id,full_name', 'series:id,stream']);

        $rows = $target->classSubjects->sortBy(fn (ClassSubject $row) => $row->schoolClass?->name)->values();
        $students = $this->studentCounts($rows->pluck('school_class_id')->all());
        $levelIds = $rows->map(fn (ClassSubject $row) => $row->schoolClass?->level_id)->filter()->unique();

        $notOffered = $year
            ? SchoolClass::where('academic_year_id', $year->id)
                ->whereIn('level_id', $levelIds)
                ->whereNotIn('id', $rows->pluck('school_class_id'))
                ->orderBy('name')
                ->pluck('name')
            : collect();

        $lastEdit = AuditEvent::where('entity', 'subject')
            ->where('entity_id', $target->id)
            ->with('actor:id,role')
            ->orderByDesc('occurred_at')
            ->first();

        return Inertia::render('subjects/record', [
            'yearLabel' => $year?->label,
            'subject' => [
                ...$this->summary($target),
                'note' => $target->note,
                'level_names' => $rows
                    ->map(fn (ClassSubject $row) => $row->schoolClass?->level)
                    ->filter()
                    ->unique('id')
                    ->sortBy('ordinal')
                    ->pluck('name')
                    ->values(),
                'rows' => $rows->map(fn (ClassSubject $row) => [
                    'class' => $row->schoolClass?->name,
                    'students' => (int) ($students[$row->school_class_id] ?? 0),
                    'teacher' => $row->staff?->full_name,
                    'weekly_periods' => $row->weekly_periods,
                ]),
                'not_offered' => $notOffered,
            ],
            'lastEdit' => $lastEdit ? [
                'by' => $lastEdit->actor ? Str::lower($lastEdit->actor->role->label()) : null,
                'on' => $lastEdit->occurred_at->toDateString(),
            ] : null,
        ]);
    }

    public function templates(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->get();
        $registered = Subject::where('school_id', $school->id)->pluck('code')->all();

        $sets = collect($this->templateSets())->map(function (array $set, string $key) use ($levels, $registered) {
            $cycle = $levels->filter(fn (Level $level) => $level->cycle->value === $set['cycle'])->values();

            return [
                'key' => $key,
                'name' => $set['name'],
                'description' => $set['description'],
                'subjects' => collect($set['subjects'])->map(function (array $subject) use ($cycle, $registered) {
                    [$name, $code, $department, $coefficient, $periods, $from] = $subject;
                    $covered = $cycle->slice($from)->values();

                    return [
                        'name' => $name,
                        'code' => $code,
                        'department' => $department,
                        'coefficient' => $coefficient,
                        'weekly_periods' => $periods,
                        'level_ids' => $covered->modelKeys(),
                        'levels_label' => $this->levelRange($covered),
                        'registered' => in_array($code, $registered, true),
                    ];
                })->values(),
            ];
        })->values();

        return Inertia::render('subjects/templates', [
            'yearLabel' => $year?->label,
            'sets' => $sets,
            ...$this->pickers($school, $year),
        ]);
    }

    public function storeTemplates(StoreSubjectTemplatesRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $set = $this->templateSets()[$request->string('set')->toString()] ?? null;

        abort_unless($set !== null, 404);

        $data = $request->validated();

        $catalogue = collect($set['subjects'])->keyBy(fn (array $subject) => $subject[1]);
        $registered = Subject::withTrashed()->where('school_id', $school->id)->pluck('code')->all();

        $created = DB::transaction(function () use ($request, $school, $data, $catalogue, $registered) {
            $created = 0;

            foreach ($data['subjects'] as $row) {
                $template = $catalogue->get($row['code']);

                // Subjects the school already has are left alone.
                if (! $template || in_array($row['code'], $registered, true)) {
                    continue;
                }

                [$name, $code, $department, $coefficient, $periods] = $template;

                $subject = $this->save($school, new Subject(['school_id' => $school->id]), [
                    'name' => $name,
                    'code' => $code,
                    'department' => $department,
                    'coefficient' => $coefficient,
                    'note' => null,
                    'classes' => $row['classes'],
                ], $periods);

                $this->audit($request, $school, $subject, 'registered', ['code' => $code, 'template' => true]);
                $created++;
            }

            return $created;
        });

        $this->notify(trans_choice('{1} :count subject created.|[2,*] :count subjects created.', $created, ['count' => $created]));

        return redirect()->route('classes.subjects');
    }

    /**
     * @return array<string, array{name: string, description: string, cycle: string, subjects: list<array{0: string, 1: string, 2: string, 3: int, 4: int, 5: int}>}>
     */
    protected function templateSets(): array
    {
        return config('subject_templates');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{class_id: string, staff_id: string|null, weekly_periods: int}>
     */
    protected function classRows(array $data): array
    {
        return $data['classes'];
    }

    protected function subject(School $school, string $id): Subject
    {
        return Subject::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    protected function form(School $school, ?Subject $subject): Response
    {
        $year = $this->schoolContext->year();
        $subject?->load('classSubjects');

        return Inertia::render('subjects/register', [
            'yearLabel' => $year?->label,
            'departments' => collect(static::DEPARTMENTS)
                ->merge(Subject::where('school_id', $school->id)->distinct()->pluck('department'))
                ->unique()
                ->values(),
            'subject' => $subject ? [
                'id' => $subject->id,
                'name' => $subject->name,
                'code' => $subject->code,
                'coefficient' => (float) $subject->coefficient,
                'department' => $subject->department,
                'note' => $subject->note,
                'classes' => $subject->classSubjects->map(fn (ClassSubject $row) => [
                    'class_id' => $row->school_class_id,
                    'staff_id' => $row->staff_id,
                    'weekly_periods' => $row->weekly_periods,
                ]),
            ] : null,
            ...$this->pickers($school, $year),
        ]);
    }

    /**
     * Levels, this year's classes and the staff a class can be given to.
     *
     * @return array<string, mixed>
     */
    protected function pickers(School $school, ?AcademicYear $year): array
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
    protected function studentCounts(array $classIds): \Illuminate\Support\Collection
    {
        return Enrolment::whereIn('school_class_id', $classIds)
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id');
    }

    /**
     * @return array<string, mixed>
     */
    protected function validated(SaveSubjectRequest $request): array
    {
        $data = $request->validated();

        if ($data['mode'] === 'register') {
            $staffed = collect($this->classRows($data))->every(fn (array $row) => ! empty($row['staff_id']));

            if ($data['classes'] === [] || ! $staffed) {
                throw ValidationException::withMessages([
                    'classes' => __('Every selected class needs a teacher before you can register. Save a draft to finish later.'),
                ]);
            }
        }

        return $data;
    }

    /**
     * Write the subject, its per-class teaching rows, and the per-level
     * coefficient rows that marks are weighted with.
     *
     * @param  array<string, mixed>  $data
     */
    protected function save(School $school, Subject $subject, array $data, ?int $defaultPeriods = null): Subject
    {
        $periods = collect($this->classRows($data))->pluck('weekly_periods');

        $subject->fill([
            'name' => trim((string) $data['name']),
            'code' => mb_strtoupper(trim((string) $data['code'])),
            'department' => trim((string) $data['department']),
            'coefficient' => $data['coefficient'],
            'note' => $data['note'] ?? null,
            'weekly_periods' => (int) ($periods->max() ?? $defaultPeriods ?? $subject->weekly_periods ?? 0),
        ])->save();

        $keep = [];

        foreach ($this->classRows($data) as $row) {
            $keep[] = ClassSubject::updateOrCreate(
                ['school_class_id' => $row['class_id'], 'subject_id' => $subject->id],
                [
                    'school_id' => $school->id,
                    'staff_id' => $row['staff_id'] ?: null,
                    'weekly_periods' => $row['weekly_periods'],
                ],
            )->id;
        }

        ClassSubject::where('subject_id', $subject->id)->whereNotIn('id', $keep)->delete();

        $levelIds = SchoolClass::whereIn('id', collect($this->classRows($data))->pluck('class_id'))
            ->distinct()
            ->pluck('level_id');

        // One coefficient weights sequences and exams alike.
        foreach ($levelIds as $levelId) {
            Coefficient::updateOrCreate(
                ['subject_id' => $subject->id, 'level_id' => $levelId],
                [
                    'sequence_coeff' => $data['coefficient'],
                    'exam_coeff' => $data['coefficient'],
                    'status' => CoefficientStatus::Complete,
                ],
            );
        }

        return $subject;
    }

    /**
     * Series subjects that a class of the series' level does not take
     * at all, so nobody teaches them there: subject id to class names.
     * Students of that class can register for the series, and their
     * marks would have no sheet.
     *
     * @return array<string, list<string>>
     */
    protected function seriesGaps(School $school, ?AcademicYear $year): array
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
    protected function summary(Subject $subject): array
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
    protected function levelRange(\Illuminate\Support\Collection $levels): string
    {
        $codes = $levels->map(fn (Level $level) => $level->code ?? $level->name)->values();

        return match (true) {
            $codes->isEmpty() => '—',
            $codes->count() === 1 => (string) $codes->first(),
            default => $codes->first().'–'.$codes->last(),
        };
    }

    protected function audit(Request $request, School $school, Subject $subject, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'subject',
            'entity_id' => $subject->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
