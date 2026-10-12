<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Http\Requests\Students\SaveStudentRequest;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentGuardian;
use App\Models\StudentSeries;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StudentController extends Controller
{
    protected const int PER_PAGE = 8;

    /**
     * The bound school, for a signed-in user allowed to manage students.
     */
    public static function schoolFor(Request $request): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        abort_unless((bool) $request->user()?->role->managesStudents(), 403);

        return $school;
    }

    public static function currentTerm(School $school): ?Term
    {
        return Term::where('school_id', $school->id)->where('is_current', true)->first();
    }

    public function index(Request $request): Response
    {
        $school = static::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = static::currentTerm($school);
        $tab = (string) $request->query('tab', 'all');
        $search = trim((string) $request->query('q', ''));
        $levelId = (string) $request->query('level', '');
        $classId = (string) $request->query('class', '');

        $seriesLevels = Level::where('school_id', $school->id)->where('uses_series', true)->pluck('id');

        $noSeries = fn (Builder $query) => $query
            ->whereIn('school_classes.level_id', $seriesLevels)
            ->whereDoesntHave('studentSeries', fn (Builder $chosen) => $chosen->where('term_id', $term?->id));
        $overdue = fn (Builder $query) => $query
            ->whereHas('invoices', fn (Builder $invoices) => $invoices->where('status', InvoiceStatus::Overdue));
        $newThisTerm = fn (Builder $query) => $query
            ->whereDate('students.admitted_on', '>=', $term ? $term->starts_on : today()->addDay());

        $base = fn () => $this->rosterQuery($school, $year);

        $students = $base()
            ->select('students.*', 'school_classes.name as class_name', 'school_classes.level_id as class_level_id')
            ->with([
                'studentSeries' => fn ($query) => $query->where('term_id', $term?->id)->with('series:id,code,stream'),
                'invoices.payments',
                'invoices.exemption',
            ])
            ->when($tab === 'overdue', $overdue)
            ->when($tab === 'no_series', $noSeries)
            ->when($tab === 'new', $newThisTerm)
            ->when($levelId !== '', fn (Builder $query) => $query->where('school_classes.level_id', $levelId))
            ->when($classId !== '', fn (Builder $query) => $query->where('school_classes.id', $classId))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('students.full_name', "%{$search}%")
                ->orWhereLike('students.admission_no', "%{$search}%")
                ->orWhereLike('students.guardian_phone', "%{$search}%")))
            ->orderByRaw('school_classes.name IS NULL')
            ->orderBy('school_classes.name')
            ->orderBy('students.full_name')
            ->paginate(static::PER_PAGE)
            ->withQueryString();

        $classes = $this->classes($school, $year);

        return Inertia::render('students/roster', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'counts' => [
                'total' => Student::where('school_id', $school->id)->count(),
                'classes' => $classes->count(),
                'overdue' => $base()->where($overdue)->count(),
                'no_series' => $base()->where($noSeries)->count(),
                'new' => $base()->where($newThisTerm)->count(),
            ],
            'filters' => ['tab' => $tab, 'q' => $search, 'level' => $levelId, 'class' => $classId],
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'classes' => $classes->map(fn (SchoolClass $class) => $class->only(['id', 'name', 'level_id'])),
            'students' => [
                'rows' => collect($students->items())
                    ->filter(fn (mixed $row) => $row instanceof Student)
                    ->map(fn (Student $student) => $this->row($student, $seriesLevels->all()))
                    ->values(),
                'page' => $students->currentPage(),
                'lastPage' => $students->lastPage(),
                'total' => $students->total(),
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        $school = static::schoolFor($request);

        return $this->form($request, $school, null);
    }

    public function edit(Request $request, string $student): Response
    {
        $school = static::schoolFor($request);

        return $this->form($request, $school, $this->student($school, $student));
    }

    public function store(SaveStudentRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request);
        $year = StructureController::currentYear($school);

        if (! $year) {
            throw ValidationException::withMessages([
                'class_id' => 'Students are placed in a class of an academic year. Make a year active in School Setup first.',
            ]);
        }

        $data = $this->validated($request, $school, null);
        $class = SchoolClass::whereKey($data['class_id'])->firstOrFail();
        $series = $data['series_id'] ? Series::whereKey($data['series_id'])->first() : null;

        $student = DB::transaction(function () use ($request, $school, $year, $class, $series, $data) {
            $student = Student::admit(
                $school,
                $year,
                static::currentTerm($school),
                $class,
                $this->profile($request, $data),
                $this->guardians($data),
                $series,
            );

            $this->linkSibling($school, $student, $data['link_sibling_id'] ?? null);
            $this->audit($request, $school, $student, 'admitted', [
                'matricule' => $student->admission_no,
                'class' => $class->name,
            ]);

            return $student;
        });

        $this->notify("{$student->full_name} registered as {$student->admission_no}.");

        return $request->boolean('another')
            ? redirect()->route('students.create')
            : redirect()->route('students.show', $student->id);
    }

    public function update(SaveStudentRequest $request, string $student): RedirectResponse
    {
        $school = static::schoolFor($request);
        $year = StructureController::currentYear($school);
        $target = $this->student($school, $student);
        $data = $this->validated($request, $school, $target);

        DB::transaction(function () use ($request, $school, $year, $target, $data) {
            $target->update($this->profile($request, $data));
            $target->replaceGuardians($this->guardians($data));

            if ($year) {
                Enrolment::updateOrCreate(
                    ['student_id' => $target->id, 'academic_year_id' => $year->id],
                    ['school_class_id' => $data['class_id']],
                );
            }

            if ($term = static::currentTerm($school)) {
                if ($data['series_id']) {
                    StudentSeries::updateOrCreate(
                        ['student_id' => $target->id, 'term_id' => $term->id],
                        ['series_id' => $data['series_id']],
                    );
                } else {
                    StudentSeries::where('student_id', $target->id)->where('term_id', $term->id)->delete();
                }
            }

            $this->linkSibling($school, $target, $data['link_sibling_id'] ?? null);
            $this->audit($request, $school, $target, 'updated', ['class_id' => $data['class_id']]);
        });

        $this->notify('Student record saved.');

        return redirect()->route('students.show', $target->id);
    }

    public function show(Request $request, string $student): Response
    {
        $school = static::schoolFor($request);
        $year = StructureController::currentYear($school);
        $term = static::currentTerm($school);
        $target = $this->student($school, $student)->load(['guardians', 'invoices.payments', 'invoices.exemption']);
        $private = (bool) $request->user()?->role->seesPrivateStudentDetails();

        $enrolment = $year
            ? Enrolment::where('student_id', $target->id)
                ->where('academic_year_id', $year->id)
                ->with('schoolClass.level')
                ->first()
            : null;
        $class = $enrolment?->schoolClass;
        $series = $term
            ? StudentSeries::where('student_id', $target->id)->where('term_id', $term->id)->with('series.subjects:id')->first()?->series
            : null;
        $fees = $this->fees($target->invoices);

        return Inertia::render('students/record', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'canSeePrivate' => $private,
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'surname' => $target->surname ?? Str::before($target->full_name, ' '),
                'given_names' => $target->given_names ?? Str::after($target->full_name, ' '),
                'matricule' => $target->admission_no,
                'gender' => $target->gender->value,
                'date_of_birth' => $target->date_of_birth->toDateString(),
                'place_of_birth' => $target->place_of_birth,
                'religion' => $private ? $target->religion : null,
                'disability' => $private && $target->has_disability
                    ? trim(implode(', ', $target->disability_types ?? []).($target->disability_support ? " · {$target->disability_support}" : ''), ' ·')
                    : null,
                'admitted_on' => $target->admitted_on->toDateString(),
                'transferred_from' => $target->transferred
                    ? trim("{$target->previous_school}".($target->previous_class ? ", {$target->previous_class}" : ''))
                    : null,
                'class' => $class ? [
                    'name' => $class->name,
                    'students' => Enrolment::where('school_class_id', $class->id)->count(),
                    'level' => $class->level?->name,
                    'uses_series' => (bool) $class->level?->uses_series,
                ] : null,
                'series' => $series ? [
                    'code' => $series->code,
                    'name' => $series->name,
                    'stream' => $series->stream ?? 'science',
                    'core' => $series->subjects->where('pivot.kind', 'core')->count(),
                    'electives' => $series->subjects->where('pivot.kind', 'elective')->count(),
                ] : null,
                'guardians' => $target->guardians
                    ->sortBy(fn (StudentGuardian $guardian) => array_search($guardian->relation, StudentGuardian::RELATIONS, true))
                    ->values()
                    ->map(fn (StudentGuardian $guardian) => $guardian->only(['relation', 'name', 'phone', 'occupation', 'is_main'])),
                'on_whatsapp' => $target->on_whatsapp,
                'lives_with' => $target->lives_with,
                'fees' => $target->invoices->isEmpty() ? null : [
                    'status' => $fees['status'],
                    'balance' => $fees['balance'],
                    'due' => $fees['due'],
                ],
            ],
        ]);
    }

    /**
     * Another student whose parent has the same phone number.
     */
    public function siblingCheck(Request $request): JsonResponse
    {
        $school = static::schoolFor($request);
        $digits = preg_replace('/\D+/', '', (string) $request->query('phone', '')) ?? '';

        if (strlen($digits) < 9) {
            return response()->json(['sibling' => null]);
        }

        $guardian = StudentGuardian::query()
            ->whereRaw("REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE ?", ['%'.substr($digits, -9)])
            ->whereHas('student', fn (Builder $query) => $query
                ->where('school_id', $school->id)
                ->when($request->query('exclude'), fn (Builder $inner, mixed $id) => $inner->where('id', '!=', $id)))
            ->with('student')
            ->first();

        return response()->json([
            'sibling' => $guardian && $guardian->student ? [
                'id' => $guardian->student->id,
                'name' => $guardian->student->full_name,
                'matricule' => $guardian->student->admission_no,
                'relation' => $guardian->relation,
            ] : null,
        ]);
    }

    /**
     * Students joined to their class for the year, so the roster can
     * sort and filter by it.
     *
     * @return Builder<Student>
     */
    protected function rosterQuery(School $school, ?AcademicYear $year): Builder
    {
        return Student::query()
            ->where('students.school_id', $school->id)
            ->leftJoin('enrolments', fn ($join) => $join
                ->on('enrolments.student_id', '=', 'students.id')
                ->where('enrolments.academic_year_id', '=', $year?->id))
            ->leftJoin('school_classes', 'school_classes.id', '=', 'enrolments.school_class_id');
    }

    /**
     * One roster line.
     *
     * @param  array<int, string>  $seriesLevels
     * @return array<string, mixed>
     */
    protected function row(Student $student, array $seriesLevels): array
    {
        $series = $student->studentSeries->first()?->series;
        $fees = $this->fees($student->invoices);

        return [
            'id' => $student->id,
            'name' => $student->full_name,
            'initials' => $this->initials($student),
            'matricule' => $student->admission_no,
            'class' => $student->getAttribute('class_name'),
            'series' => $series ? ['code' => $series->code, 'stream' => $series->stream ?? 'science'] : null,
            'needs_series' => ! $series && in_array($student->getAttribute('class_level_id'), $seriesLevels, true),
            'guardian' => $student->guardian_name,
            'phone' => $student->guardian_phone,
            'fees' => $fees['status'],
            'balance' => $fees['balance'],
        ];
    }

    protected function student(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    protected function form(Request $request, School $school, ?Student $student): Response
    {
        $year = StructureController::currentYear($school);
        $term = static::currentTerm($school);
        $private = (bool) $request->user()?->role->seesPrivateStudentDetails();
        $classes = $this->classes($school, $year);
        $counts = Enrolment::whereIn('school_class_id', $classes->modelKeys())
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id');
        $student?->load('guardians');

        $enrolment = $student && $year
            ? Enrolment::where('student_id', $student->id)->where('academic_year_id', $year->id)->first()
            : null;
        $seriesId = $student && $term
            ? StudentSeries::where('student_id', $student->id)->where('term_id', $term->id)->value('series_id')
            : null;

        return Inertia::render('students/register', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'matricule' => $student->admission_no ?? Student::nextMatricule($school, today()),
            'canSeePrivate' => $private,
            'religions' => Student::RELIGIONS,
            'disabilityTypes' => Student::DISABILITY_TYPES,
            'livesWithOptions' => Student::LIVES_WITH,
            'levels' => Level::where('school_id', $school->id)
                ->orderBy('ordinal')
                ->get()
                ->map(fn (Level $level) => $level->only(['id', 'name', 'uses_series'])),
            'classes' => $classes->map(fn (SchoolClass $class) => [
                'id' => $class->id,
                'name' => $class->name,
                'level_id' => $class->level_id,
                'capacity' => $class->capacity,
                'students' => (int) ($counts[$class->id] ?? 0),
            ]),
            'series' => Series::where('school_id', $school->id)
                ->orderBy('stream', 'desc')
                ->orderBy('code')
                ->get()
                ->map(fn (Series $series) => [
                    'id' => $series->id,
                    'code' => $series->code,
                    'name' => $series->name,
                    'stream' => $series->stream ?? 'science',
                    'level_id' => $series->level_id,
                ]),
            'feePlans' => $this->feePlans($school, $year),
            'student' => $student ? [
                'id' => $student->id,
                'surname' => $student->surname ?? Str::before($student->full_name, ' '),
                'given_names' => $student->given_names ?? Str::after($student->full_name, ' '),
                'date_of_birth' => $student->date_of_birth->toDateString(),
                'gender' => $student->gender->value,
                'place_of_birth' => $student->place_of_birth,
                'religion' => $private ? $student->religion : null,
                'has_disability' => $private && $student->has_disability,
                'disability_types' => $private ? ($student->disability_types ?? []) : [],
                'disability_support' => $private ? $student->disability_support : null,
                'transferred' => $student->transferred,
                'previous_school' => $student->previous_school,
                'previous_class' => $student->previous_class,
                'previous_year_left' => $student->previous_year_left,
                'transfer_certificate_received' => $student->transfer_certificate_received,
                'last_report_received' => $student->last_report_received,
                'on_whatsapp' => $student->on_whatsapp,
                'lives_with' => $student->lives_with,
                'class_id' => $enrolment?->school_class_id,
                'series_id' => $seriesId,
                'guardians' => $student->guardians->map(fn (StudentGuardian $guardian) => $guardian->only(['relation', 'name', 'phone', 'occupation', 'is_main'])),
            ] : null,
        ]);
    }

    /**
     * @return Collection<int, SchoolClass>
     */
    protected function classes(School $school, ?AcademicYear $year): Collection
    {
        return $year
            ? SchoolClass::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->orderBy('name')
                ->get()
            : new Collection;
    }

    /**
     * What a new student of each level is billed, item by item, split
     * by the year's installment schedule.
     *
     * @return array<int, array{level_id: string, amount: float, items: list<array{name: string, amount: float}>, installments: array<int, array{seq: int, due_on: string|null, amount: float}>}>
     */
    protected function feePlans(School $school, ?AcademicYear $year): array
    {
        if (! $year) {
            return [];
        }

        $templates = FeeInstallmentTemplate::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->orderBy('seq')
            ->get();

        $percents = array_values($templates->map(fn (FeeInstallmentTemplate $template) => (float) $template->percent)->all());

        return FeePlan::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->get()
            ->map(function (FeePlan $plan) use ($templates, $percents) {
                $lines = $plan->lines(true);
                $parts = Invoice::schedule($lines, $percents);

                return [
                    'level_id' => $plan->level_id,
                    'amount' => array_sum(array_map(fn (array $line) => (float) $line['amount'], $lines)),
                    'items' => array_map(fn (array $line) => ['name' => $line['name'], 'amount' => (float) $line['amount']], $lines),
                    'installments' => $templates->values()->map(fn (FeeInstallmentTemplate $template, int $index) => [
                        'seq' => $template->seq,
                        'due_on' => $template->due_on?->toDateString(),
                        'amount' => ($parts[$index] ?? 0) / 100,
                    ])->all(),
                ];
            })
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function validated(SaveStudentRequest $request, School $school, ?Student $student): array
    {
        $data = $request->validated();

        $main = collect($this->guardianRows($data))->firstWhere('relation', $data['main_contact']);

        if (! $main || trim((string) ($main['phone'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'main_contact' => 'The main contact needs a name and a phone number.',
            ]);
        }

        $class = SchoolClass::whereKey($data['class_id'])->firstOrFail();
        $taken = Enrolment::where('school_class_id', $class->id)
            ->when($student, fn (Builder $query) => $query->where('student_id', '!=', $student?->id))
            ->count();

        if ($taken >= $class->capacity) {
            throw ValidationException::withMessages([
                'class_id' => "{$class->name} is full, {$taken} of {$class->capacity}. Choose another class or add seats under Levels.",
            ]);
        }

        if ($data['series_id'] && Series::whereKey($data['series_id'])->value('level_id') !== $class->level_id) {
            throw ValidationException::withMessages([
                'series_id' => 'That series belongs to another level.',
            ]);
        }

        $fullName = trim($data['surname']).' '.trim($data['given_names']);
        $twin = Student::where('school_id', $school->id)
            ->whereRaw('LOWER(full_name) = ?', [mb_strtolower($fullName)])
            ->whereDate('date_of_birth', $data['date_of_birth'])
            ->when($student, fn (Builder $query) => $query->where('id', '!=', $student?->id))
            ->first();

        if ($twin && ! ($data['allow_duplicate'] ?? false)) {
            throw ValidationException::withMessages([
                'duplicate' => "{$twin->full_name} ({$twin->admission_no}) has the same name and date of birth.",
            ]);
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{relation: string, name: string, phone?: string|null, occupation?: string|null}>
     */
    protected function guardianRows(array $data): array
    {
        return $data['guardians'];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}>
     */
    protected function guardians(array $data): array
    {
        return array_map(fn (array $row) => [
            'relation' => $row['relation'],
            'name' => trim($row['name']),
            'phone' => isset($row['phone']) ? trim($row['phone']) : null,
            'occupation' => isset($row['occupation']) ? trim($row['occupation']) : null,
            'is_main' => $row['relation'] === $data['main_contact'],
        ], $this->guardianRows($data));
    }

    /**
     * The student's own columns. Private details are only written by
     * roles allowed to see them, so a registrar's save cannot blank them.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function profile(Request $request, array $data): array
    {
        $surname = trim((string) $data['surname']);
        $given = trim((string) $data['given_names']);

        $profile = [
            'surname' => $surname,
            'given_names' => $given,
            'full_name' => "{$surname} {$given}",
            'date_of_birth' => $data['date_of_birth'],
            'gender' => $data['gender'],
            'place_of_birth' => $data['place_of_birth'] ?? null,
            'transferred' => $data['transferred'],
            'previous_school' => $data['transferred'] ? $data['previous_school'] : null,
            'previous_class' => $data['transferred'] ? ($data['previous_class'] ?? null) : null,
            'previous_year_left' => $data['transferred'] ? ($data['previous_year_left'] ?? null) : null,
            'transfer_certificate_received' => $data['transferred'] && $data['transfer_certificate_received'],
            'last_report_received' => $data['transferred'] && $data['last_report_received'],
            'on_whatsapp' => $data['on_whatsapp'],
            'lives_with' => $data['lives_with'] ?? null,
        ];

        if ($request->user()?->role->seesPrivateStudentDetails()) {
            $profile += [
                'religion' => $data['religion'] ?? null,
                'has_disability' => $data['has_disability'],
                'disability_types' => $data['has_disability'] ? $data['disability_types'] : null,
                'disability_support' => $data['has_disability'] ? ($data['disability_support'] ?? null) : null,
            ];
        }

        return $profile;
    }

    protected function linkSibling(School $school, Student $student, ?string $siblingId): void
    {
        if (! $siblingId || $siblingId === $student->id) {
            return;
        }

        $sibling = $this->student($school, $siblingId);
        $family = $sibling->family_id ?? $student->family_id ?? (string) Str::uuid7();

        $sibling->update(['family_id' => $family]);
        $student->update(['family_id' => $family]);
    }

    /**
     * Fee state across a student's invoices: what is still owed and how
     * the roster should label it.
     *
     * @param  \Illuminate\Support\Collection<int, Invoice>  $invoices
     * @return array{status: string|null, balance: float, due: float}
     */
    protected function fees(\Illuminate\Support\Collection $invoices): array
    {
        if ($invoices->isEmpty()) {
            return ['status' => null, 'balance' => 0.0, 'due' => 0.0];
        }

        $due = (float) $invoices->sum(fn (Invoice $invoice) => (float) $invoice->amount_due - $invoice->exempted());
        $paid = (float) $invoices->sum(fn (Invoice $invoice) => (float) $invoice->payments->sum(fn (Payment $payment) => (float) $payment->amount));
        $balance = max(0.0, $due - $paid);

        $status = match (true) {
            $balance <= 0 => 'paid',
            $invoices->contains(fn (Invoice $invoice) => $invoice->status === InvoiceStatus::Overdue) => 'overdue',
            $paid > 0 => 'partial',
            default => 'due',
        };

        return ['status' => $status, 'balance' => $balance, 'due' => $due];
    }

    protected function initials(Student $student): string
    {
        $parts = preg_split('/\s+/', trim($student->full_name)) ?: [];

        return mb_strtoupper(mb_substr($parts[0] ?? '', 0, 1).mb_substr($parts[1] ?? '', 0, 1));
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
