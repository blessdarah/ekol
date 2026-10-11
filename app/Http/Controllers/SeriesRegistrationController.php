<?php

namespace App\Http\Controllers;

use App\Http\Requests\Series\BulkRegisterSeriesRequest;
use App\Http\Requests\Series\RegisterSeriesRequest;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Subject;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SeriesRegistrationController extends Controller
{
    public const array REASONS = [
        "Student's request",
        "Parent's request",
        'Teacher advice',
        'Placed in the wrong series',
        'Other',
    ];

    protected const int QUEUE_PREVIEW = 4;

    public function index(Request $request): Response
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = StudentController::currentTerm($school);
        $levels = $this->levels($school);
        $level = $levels->firstWhere('id', $request->query('level')) ?? $levels->first();

        $cards = $levels->map(function (Level $option) use ($school, $year, $term) {
            $students = $this->students($school, $year, $option)->pluck('students.id');

            return [
                'id' => $option->id,
                'name' => $option->name,
                'total' => $students->count(),
                'registered' => $this->registrations($term, $option)->whereIn('student_id', $students)->count(),
            ];
        });

        if (! $level) {
            return Inertia::render('series/overview', [
                'yearLabel' => $year?->label,
                'hasTerm' => $term !== null,
                'levels' => [],
                'level' => null,
            ]);
        }

        $students = $this->students($school, $year, $level)->orderBy('students.full_name')->get();
        $registrations = $this->registrations($term, $level)
            ->with('electives:id')
            ->get()
            ->keyBy('student_id');
        $series = Series::where('level_id', $level->id)->with('subjects:id,name')->orderBy('code')->get();
        $unassigned = $students->reject(fn (Student $student) => $registrations->has($student->id))->values();

        return Inertia::render('series/overview', [
            'yearLabel' => $year?->label,
            'hasTerm' => $term !== null,
            'levels' => $cards,
            'level' => $level->only(['id', 'name']),
            'series' => $series->map(fn (Series $item) => [
                'id' => $item->id,
                'code' => $item->code,
                'name' => $item->name,
                'stream' => $item->stream ?? 'science',
                'core' => $item->subjects->where('pivot.kind', 'core')->pluck('name')->values(),
                'students' => $registrations->where('series_id', $item->id)->count(),
            ]),
            'unassigned' => [
                'total' => $unassigned->count(),
                'preview' => $unassigned->take(static::QUEUE_PREVIEW)->map(fn (Student $student) => [
                    'id' => $student->id,
                    'name' => $student->full_name,
                    'class' => $student->getAttribute('class_name'),
                ])->values(),
            ],
            'unstaffed' => $this->unstaffed($school, $students, $registrations, $series),
        ]);
    }

    public function one(Request $request): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = StudentController::currentTerm($school);
        $levels = $this->levels($school);

        // A link from a student's record names the student, not the level.
        $levelId = $request->query('level') ?? SchoolClass::query()
            ->where('academic_year_id', $year?->id)
            ->whereIn('id', Enrolment::where('student_id', $request->query('student'))->select('school_class_id'))
            ->value('level_id');
        $level = $levels->firstWhere('id', $levelId) ?? $levels->first();

        if (! $level) {
            return redirect()->route('series');
        }

        $tab = $request->query('tab') === 'registered' ? 'registered' : 'unassigned';
        $search = trim((string) $request->query('q', ''));
        $everyone = $this->students($school, $year, $level)->orderBy('students.full_name')->get();
        $registrations = $this->registrations($term, $level)->with('electives:id')->get()->keyBy('student_id');
        $unassigned = $everyone->reject(fn (Student $student) => $registrations->has($student->id))->values();

        $selected = $everyone->firstWhere('id', $request->query('student'))
            ?? ($tab === 'unassigned' ? $unassigned->first() : $everyone->first(fn (Student $student) => $registrations->has($student->id)));

        // Opening a student from elsewhere shows the list that student is in.
        if ($request->query('student') && $selected && ! $request->has('tab')) {
            $tab = $registrations->has($selected->id) ? 'registered' : 'unassigned';
        }

        $list = ($tab === 'unassigned' ? $unassigned : $everyone->filter(fn (Student $student) => $registrations->has($student->id)))
            ->filter(fn (Student $student) => $search === ''
                || str_contains(mb_strtolower($student->full_name), mb_strtolower($search))
                || str_contains(mb_strtolower($student->admission_no), mb_strtolower($search)))
            ->values();

        $registration = $selected ? $registrations->get($selected->id) : null;
        $position = $selected ? $unassigned->search(fn (Student $student) => $student->id === $selected->id) : false;
        $next = $unassigned->filter(fn (Student $student) => $student->id !== $selected?->id)->values();

        return Inertia::render('series/register', [
            'yearLabel' => $year?->label,
            'hasTerm' => $term !== null,
            'level' => $level->only(['id', 'name']),
            'counts' => ['total' => $everyone->count(), 'unassigned' => $unassigned->count()],
            'tab' => $tab,
            'q' => $search,
            'students' => $list->map(fn (Student $student) => [
                'id' => $student->id,
                'name' => $student->full_name,
                'matricule' => $student->admission_no,
            ]),
            'student' => $selected ? [
                'id' => $selected->id,
                'name' => $selected->full_name,
                'matricule' => $selected->admission_no,
                'class' => $selected->getAttribute('class_name'),
                'series_id' => $registration?->series_id,
                'electives' => $registration ? $registration->electives->modelKeys() : [],
            ] : null,
            'nextId' => ($position !== false ? $unassigned->get((int) $position + 1) : null)?->id
                ?: $next->first()?->id,
            'series' => $this->seriesOptions($level),
            'teachers' => $selected ? $this->teachers([(string) $selected->getAttribute('class_id')]) : [],
        ]);
    }

    public function register(RegisterSeriesRequest $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = $this->term($school);

        $data = $request->validated();

        $series = Series::whereKey($data['series_id'])->with('subjects:id')->firstOrFail();
        $level = Level::whereKey($series->level_id)->firstOrFail();
        $electives = $this->electives($series, $data['electives']);
        $student = $this->students($school, $year, $level)->where('students.id', $data['student_id'])->first();

        if (! $student) {
            throw ValidationException::withMessages([
                'series_id' => "That student is not in {$level->name} this year.",
            ]);
        }

        DB::transaction(function () use ($request, $school, $term, $series, $electives, $student) {
            $this->save($request, $term, $student, $series, $electives);
            $this->audit($request, $school, $student, 'series_registered', ['series' => $series->code]);
        });

        $next = $data['next_id'] ?? null;

        return $next
            ? redirect()->route('series.one', ['level' => $level->id, 'student' => $next])
            : redirect()->route('series', ['level' => $level->id]);
    }

    public function bulk(Request $request): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = StudentController::currentTerm($school);
        $level = $this->levels($school)->firstWhere('id', $request->query('level')) ?? $this->levels($school)->first();

        if (! $level) {
            return redirect()->route('series');
        }

        $registered = $this->registrations($term, $level)->pluck('student_id');
        $students = $this->students($school, $year, $level)
            ->whereNotIn('students.id', $registered)
            ->orderBy('students.full_name')
            ->get();
        $classIds = SchoolClass::where('level_id', $level->id)
            ->where('academic_year_id', $year?->id)
            ->pluck('id')
            ->all();

        return Inertia::render('series/bulk', [
            'yearLabel' => $year?->label,
            'hasTerm' => $term !== null,
            'level' => $level->only(['id', 'name']),
            'students' => $students->map(fn (Student $student) => [
                'id' => $student->id,
                'name' => $student->full_name,
                'matricule' => $student->admission_no,
                'class_id' => $student->getAttribute('class_id'),
                'class' => $student->getAttribute('class_name'),
            ]),
            'series' => $this->seriesOptions($level),
            'staffed' => array_keys($this->teachers($classIds)),
        ]);
    }

    public function bulkStore(BulkRegisterSeriesRequest $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = $this->term($school);

        $data = $request->validated();

        $series = Series::whereKey($data['series_id'])->with('subjects:id')->firstOrFail();
        $level = Level::whereKey($series->level_id)->firstOrFail();
        $electives = $this->electives($series, $data['electives']);
        $students = $this->students($school, $year, $level)->whereIn('students.id', $data['student_ids'])->get();

        if ($students->count() !== count($data['student_ids'])) {
            throw ValidationException::withMessages([
                'student_ids' => "Some of those students are not in {$level->name} this year.",
            ]);
        }

        DB::transaction(function () use ($request, $school, $term, $series, $electives, $students) {
            foreach ($students as $student) {
                $this->save($request, $term, $student, $series, $electives);
                $this->audit($request, $school, $student, 'series_registered', ['series' => $series->code, 'bulk' => true]);
            }
        });

        return redirect()->route('series', ['level' => $level->id]);
    }

    public function change(Request $request, string $student): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = StudentController::currentTerm($school);
        $target = Student::where('school_id', $school->id)->where('id', $student)->firstOrFail();
        $registration = $term
            ? StudentSeries::where('student_id', $target->id)
                ->where('term_id', $term->id)
                ->with(['series.subjects:id,name', 'electives:id'])
                ->first()
            : null;
        $current = $registration?->series;
        $level = $current ? Level::whereKey($current->level_id)->first() : null;

        // Nothing to change yet: a first registration happens one by one.
        if (! $registration || ! $current || ! $level) {
            return redirect()->route('series.one', ['student' => $target->id]);
        }

        $chosen = $registration->electives->modelKeys();

        return Inertia::render('series/change', [
            'yearLabel' => $year?->label,
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'matricule' => $target->admission_no,
                'class' => $this->students($school, $year, $level)->where('students.id', $target->id)->first()?->getAttribute('class_name'),
            ],
            'current' => [
                'id' => $current->id,
                'code' => $current->code,
                'stream' => $current->stream ?? 'science',
                'taken' => $current->subjects
                    ->filter(fn (Subject $subject) => $this->kind($subject) === 'core' || in_array($subject->id, $chosen, true))
                    ->map(fn (Subject $subject) => [
                        'id' => $subject->id,
                        'name' => $subject->name,
                        'kind' => $this->kind($subject),
                    ])
                    ->values(),
            ],
            'series' => $this->seriesOptions($level),
            'reasons' => static::REASONS,
        ]);
    }

    public function changeStore(Request $request, string $student): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $term = $this->term($school);
        $target = Student::where('school_id', $school->id)->where('id', $student)->firstOrFail();
        $registration = StudentSeries::where('student_id', $target->id)
            ->where('term_id', $term->id)
            ->with(['series.subjects:id', 'electives:id'])
            ->firstOrFail();

        $data = $request->validate([
            'series_id' => [
                'required',
                Rule::exists('series', 'id')
                    ->where('school_id', $school->id)
                    ->where('level_id', $registration->series?->level_id),
                Rule::notIn([$registration->series_id]),
            ],
            'reason' => ['required', Rule::in(static::REASONS)],
            'note' => ['nullable', 'string', 'max:255'],
            'parent_agreed' => ['accepted'],
        ], [
            'parent_agreed.accepted' => 'A parent or guardian must agree before the series changes.',
            'series_id.not_in' => 'The student is already in that series.',
        ]);

        $series = Series::whereKey($data['series_id'])->with('subjects:id')->firstOrFail();

        if ($series->subjects->where('pivot.kind', 'core')->isEmpty()) {
            throw ValidationException::withMessages([
                'series_id' => "{$series->name} has no core subjects yet, so nobody can be moved into it.",
            ]);
        }

        // Everything the student took and the new pool still offers is kept.
        $taken = [
            ...$registration->electives->modelKeys(),
            ...($registration->series ? array_values($registration->series->subjects->where('pivot.kind', 'core')->modelKeys()) : []),
        ];
        $kept = array_values(array_intersect($taken, array_values($series->subjects->where('pivot.kind', 'elective')->modelKeys())));

        DB::transaction(function () use ($request, $school, $registration, $series, $kept, $data, $target) {
            $from = $registration->series?->code;

            $registration->update([
                'series_id' => $series->id,
                'chosen_by' => $request->user()?->id,
                'chosen_at' => now(),
                'change_reason' => $data['reason'],
                'change_note' => $data['note'] ?? null,
                'parent_agreed' => true,
            ]);
            $registration->electives()->sync($kept);

            $this->audit($request, $school, $target, 'series_changed', [
                'from' => $from,
                'to' => $series->code,
                'reason' => $data['reason'],
                'note' => $data['note'] ?? null,
            ]);
        });

        return redirect()->route('students.show', $target->id);
    }

    /**
     * Whether a series carries the subject as core or elective.
     */
    protected function kind(Subject $subject): string
    {
        $pivot = $subject->getRelationValue('pivot');

        return $pivot instanceof Pivot ? (string) $pivot->getAttribute('kind') : '';
    }

    /**
     * Series are registered per term, so one must be active.
     */
    protected function term(School $school): Term
    {
        $term = StudentController::currentTerm($school);

        if (! $term) {
            throw ValidationException::withMessages([
                'series_id' => 'Series are registered for a term. Make a term active in School Setup first.',
            ]);
        }

        return $term;
    }

    /**
     * @return Collection<int, Level>
     */
    protected function levels(School $school): Collection
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
    protected function students(School $school, ?AcademicYear $year, Level $level): Builder
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
    protected function registrations(?Term $term, Level $level): Builder
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
    protected function seriesOptions(Level $level): array
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
    protected function teachers(array $classIds): array
    {
        return ClassSubject::whereIn('school_class_id', $classIds)
            ->whereNotNull('staff_id')
            ->with('staff:id,full_name')
            ->get()
            ->mapWithKeys(fn (ClassSubject $row) => [$row->subject_id => (string) $row->staff?->full_name])
            ->all();
    }

    /**
     * The chosen electives, checked against the series' pool and limits.
     *
     * @param  array<int, string>  $chosen
     * @return list<string>
     */
    protected function electives(Series $series, array $chosen): array
    {
        $core = $series->subjects->where('pivot.kind', 'core');
        $pool = array_values($series->subjects->where('pivot.kind', 'elective')->modelKeys());

        if ($core->isEmpty()) {
            throw ValidationException::withMessages([
                'series_id' => "{$series->name} has no core subjects yet. Set it up before registering students in it.",
            ]);
        }

        if (array_diff($chosen, $pool) !== []) {
            throw ValidationException::withMessages([
                'electives' => "Some of those subjects are not in the elective pool of {$series->code}.",
            ]);
        }

        $total = $core->count() + count($chosen);

        if ($series->min_subjects !== null && $total < $series->min_subjects) {
            throw ValidationException::withMessages([
                'electives' => "{$series->code} needs at least {$series->min_subjects} subjects. That is {$total}.",
            ]);
        }

        if ($series->max_subjects !== null && $total > $series->max_subjects) {
            throw ValidationException::withMessages([
                'electives' => "{$series->code} allows at most {$series->max_subjects} subjects. That is {$total}.",
            ]);
        }

        return array_values($chosen);
    }

    /**
     * @param  list<string>  $electives
     */
    protected function save(Request $request, Term $term, Student $student, Series $series, array $electives): void
    {
        $registration = StudentSeries::updateOrCreate(
            ['student_id' => $student->id, 'term_id' => $term->id],
            ['series_id' => $series->id, 'chosen_by' => $request->user()?->id, 'chosen_at' => now()],
        );

        $registration->electives()->sync($electives);
    }

    /**
     * Subjects students already take with no teacher in their class.
     *
     * @param  Collection<int, Student>  $students
     * @param  \Illuminate\Support\Collection<array-key, StudentSeries>  $registrations
     * @param  Collection<int, Series>  $series
     * @return array<int, array{id: string, name: string, students: int}>
     */
    protected function unstaffed(School $school, Collection $students, \Illuminate\Support\Collection $registrations, Collection $series): array
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

    protected function audit(Request $request, School $school, Student $student, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'student',
            'entity_id' => $student->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
