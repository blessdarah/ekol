<?php

namespace App\Http\Controllers;

use App\Enums\ApplicationStage;
use App\Enums\EnrolmentStatus;
use App\Http\Controllers\Concerns\ListsTables;
use App\Http\Requests\Enrolment\DecideApplicationRequest;
use App\Http\Requests\Enrolment\StoreApplicationRequest;
use App\Http\Requests\Enrolment\UpdateApplicationDocumentsRequest;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\Student;
use App\Models\StudentGuardian;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Applications to join the school in the coming year, from the first
 * record to the decision that admits, waitlists or declines.
 */
class ApplicationController extends Controller
{
    use ListsTables;

    /**
     * How the list names each stage.
     */
    protected const array STAGES = [
        'to_review' => 'To review',
        'admitted' => 'Admitted',
        'waitlist' => 'Waitlist',
        'declined' => 'Declined',
    ];

    public function index(Request $request): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = EnrolmentController::nextYear($school);

        if (! $year) {
            return redirect()->route('enrolment');
        }

        [$query, $filters] = $this->list($request, $year);
        $stages = Application::where('academic_year_id', $year->id)->pluck('stage');

        $applications = $query->with('level:id,name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('enrolment/applications', [
            'enrolment' => EnrolmentController::progress($school, $year),
            'counts' => [
                'all' => $stages->count(),
                ...collect(ApplicationStage::cases())->mapWithKeys(fn (ApplicationStage $case) => [
                    $case->value => $stages->filter(fn (ApplicationStage $value) => $value === $case)->count(),
                ])->all(),
            ],
            'filters' => $filters,
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'applications' => [
                'rows' => collect($applications->items())
                    ->map(fn (Application $application) => [
                        'id' => $application->id,
                        'name' => $application->full_name,
                        'reference' => $application->reference,
                        'level' => $application->level?->name,
                        'from' => $application->previous_school,
                        'transfer' => $application->transferred,
                        'applied' => $application->created_at->toDateString(),
                        'stage' => $application->stage->value,
                        'missing' => count($application->missingDocuments()),
                    ])
                    ->values(),
                'page' => $applications->currentPage(),
                'lastPage' => $applications->lastPage(),
                'total' => $applications->total(),
                'perPage' => $applications->perPage(),
                'from' => $applications->firstItem(),
                'to' => $applications->lastItem(),
            ],
        ]);
    }

    /**
     * The applications as they are filtered on screen, as a CSV file or
     * a list to print. Selected rows narrow it to those applications.
     */
    public function export(Request $request): StreamedResponse|Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = EnrolmentController::nextYear($school);

        if (! $year) {
            return redirect()->route('enrolment');
        }

        [$query, , $applied] = $this->list($request, $year);
        $ids = $this->exportIds($request);

        $applications = $query->with('level:id,name')
            ->when($ids !== [], fn (Builder $query) => $query->whereIn('id', $ids))
            ->get();

        $rows = $applications->map(function (Application $application) {
            $main = collect($application->guardians)->firstWhere('is_main', true);

            return [
                'name' => $application->full_name,
                'reference' => $application->reference,
                'level' => $application->level?->name,
                'gender' => $this->say(Str::headline($application->gender->value)),
                'date_of_birth' => $application->date_of_birth->toDateString(),
                'from' => $application->previous_school ?? '',
                'transfer' => $application->transferred ? $this->say('Yes') : $this->say('No'),
                'guardian' => $main['name'] ?? '',
                'phone' => $main['phone'] ?? '',
                'applied' => $application->created_at->toDateString(),
                'stage' => $this->say(static::STAGES[$application->stage->value]),
                'missing' => count($application->missingDocuments()),
            ];
        });

        return $this->sendExport($request, $school, $this->say('Admissions'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Applicant'),
            'reference' => $this->say('Reference'),
            'level' => $this->say('Applying to'),
            'gender' => $this->say('Gender'),
            'date_of_birth' => $this->say('Date of birth'),
            'from' => $this->say('Coming from'),
            'transfer' => $this->say('Transfer'),
            'guardian' => $this->say('Main contact'),
            'phone' => $this->say('Phone'),
            'applied' => $this->say('Applied'),
            'stage' => $this->say('Stage'),
            'missing' => $this->say('Documents missing'),
        ], $rows, $rows->count());
    }

    /**
     * A year's applications with the filters, search and sort from the
     * page address applied, the filters as the page shows them, and the
     * same in words for an export.
     *
     * @return array{0: Builder<Application>, 1: array<string, mixed>, 2: list<string>}
     */
    protected function list(Request $request, AcademicYear $year): array
    {
        $search = trim((string) $request->query('q', ''));
        $stages = $this->many($request, 'stage', array_column(ApplicationStage::cases(), 'value'));
        $levels = $this->many($request, 'level');
        $transfer = in_array($request->query('transfer'), ['yes', 'no'], true) ? (string) $request->query('transfer') : '';
        $from = $this->day($request->query('from'));
        $to = $this->day($request->query('to'));
        [$sort, $direction] = $this->sorting($request, ['applied', 'name', 'reference'], '-applied');

        $query = Application::where('academic_year_id', $year->id)
            ->when($stages !== [], fn (Builder $query) => $query->whereIn('stage', $stages))
            ->when($levels !== [], fn (Builder $query) => $query->whereIn('level_id', $levels))
            ->when($transfer !== '', fn (Builder $query) => $query->where('transferred', $transfer === 'yes'))
            ->when($from, fn (Builder $query) => $query->whereDate('created_at', '>=', $from))
            ->when($to, fn (Builder $query) => $query->whereDate('created_at', '<=', $to))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('full_name', "%{$search}%")
                ->orWhereLike('reference', "%{$search}%")));

        match ($sort) {
            'name' => $query->orderBy('full_name', $direction),
            'reference' => $query->orderBy('reference', $direction),
            default => $query->orderBy('created_at', $direction)->orderBy('reference', $direction),
        };

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $stages !== [] ? $this->say('Stage: :value', ['value' => implode(', ', array_map(fn (string $stage) => $this->say(static::STAGES[$stage]), $stages))]) : null,
            $levels !== [] ? $this->say('Applying to: :value', ['value' => Level::whereIn('id', $levels)->orderBy('ordinal')->pluck('name')->join(', ')]) : null,
            $transfer !== '' ? $this->say('Transfer: :value', ['value' => $transfer === 'yes' ? $this->say('Yes') : $this->say('No')]) : null,
            $from || $to ? $this->say('Applied: :from – :to', ['from' => $from ?? '…', 'to' => $to ?? '…']) : null,
        ]));

        return [$query, [
            'q' => $search,
            'stage' => $stages,
            'level' => $levels,
            'transfer' => $transfer,
            'from' => $from ?? '',
            'to' => $to ?? '',
            'sort' => ($direction === 'desc' ? '-' : '').$sort,
        ], $applied];
    }

    public function create(Request $request): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = EnrolmentController::nextYear($school);

        if (! $year) {
            return redirect()->route('enrolment');
        }

        return Inertia::render('enrolment/application-new', [
            'enrolment' => EnrolmentController::progress($school, $year),
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'religions' => Student::RELIGIONS,
            'documents' => Application::DOCUMENTS,
            'canSeePrivate' => (bool) $request->user()?->role->seesPrivateStudentDetails(),
        ]);
    }

    public function store(StoreApplicationRequest $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = $this->requireYear($school);

        $data = $request->validated();

        $guardians = $this->guardians($data);
        $main = collect($guardians)->firstWhere('is_main', true);

        if (! $main || trim((string) $main['phone']) === '') {
            throw ValidationException::withMessages([
                'main_contact' => __('The main contact needs a name and a phone number.'),
            ]);
        }

        $private = (bool) $request->user()?->role->seesPrivateStudentDetails();
        $surname = trim((string) $data['surname']);
        $given = trim((string) $data['given_names']);

        $application = DB::transaction(function () use ($request, $school, $year, $data, $guardians, $private, $surname, $given) {
            $application = Application::create([
                'school_id' => $school->id,
                'academic_year_id' => $year->id,
                'level_id' => $data['level_id'],
                'reference' => Application::nextReference($school, $year),
                'surname' => $surname,
                'given_names' => $given,
                'full_name' => "{$surname} {$given}",
                'date_of_birth' => $data['date_of_birth'],
                'gender' => $data['gender'],
                'place_of_birth' => $data['place_of_birth'] ?? null,
                'religion' => $private ? ($data['religion'] ?? null) : null,
                'disability' => $private ? ($data['disability'] ?? null) : null,
                'transferred' => $data['transferred'],
                'previous_school' => $data['previous_school'] ?? null,
                'previous_class' => $data['previous_class'] ?? null,
                'reason' => $data['reason'] ?? null,
                'guardians' => $guardians,
                'documents' => array_values($data['documents']),
                'stage' => ApplicationStage::ToReview,
            ]);

            $this->audit($request, $school, $application, 'received', ['reference' => $application->reference]);

            return $application;
        });

        $this->notify('Application recorded.');

        return redirect()->route('enrolment.applications.show', $application->id);
    }

    public function show(Request $request, string $application): Response|RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = EnrolmentController::nextYear($school);

        if (! $year) {
            return redirect()->route('enrolment');
        }

        $target = $this->application($school, $application);
        $private = (bool) $request->user()?->role->seesPrivateStudentDetails();
        $sibling = $this->sibling($school, $target);
        $level = collect(EnrolmentController::capacity($school, $year))->firstWhere('id', $target->level_id);
        $required = $target->requiredDocuments();

        return Inertia::render('enrolment/application-review', [
            'enrolment' => EnrolmentController::progress($school, $year),
            'application' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'reference' => $target->reference,
                'level' => $target->level?->name,
                'stage' => $target->stage->value,
                'date_of_birth' => $target->date_of_birth->toDateString(),
                'place_of_birth' => $target->place_of_birth,
                'gender' => $target->gender->value,
                'religion' => $private ? $target->religion : null,
                'disability' => $private ? $target->disability : null,
                'transferred' => $target->transferred,
                'previous_school' => $target->previous_school,
                'previous_class' => $target->previous_class,
                'reason' => $target->reason,
                'guardians' => $target->guardians,
                'documents' => collect($required)->map(fn (string $label, string $key) => [
                    'key' => $key,
                    'label' => $label,
                    'received' => in_array($key, $target->documents, true),
                ])->values(),
                'condition' => $target->condition,
                'student_id' => $target->student_id,
                'matricule' => $target->student?->admission_no,
            ],
            'canSeePrivate' => $private,
            'sibling' => $sibling ? [
                'id' => $sibling->id,
                'name' => $sibling->full_name,
                'class' => $this->currentClass($school, $sibling),
            ] : null,
            'nextMatricule' => Student::nextMatricule($school, $year->starts_on),
            'capacity' => $level ? [
                'expected' => $level['expected'],
                'seats' => $level['seats'],
            ] : null,
            'hasNext' => $this->nextToReview($year, $target) !== null,
        ]);
    }

    /**
     * Mark which papers have come in.
     */
    public function documents(UpdateApplicationDocumentsRequest $request, string $application): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $target = $this->application($school, $application);

        $data = $request->validated();

        $target->update(['documents' => array_values($data['documents'])]);
        $this->audit($request, $school, $target, 'documents_updated', ['received' => $target->documents]);

        $this->notify('Documents updated.');

        return back();
    }

    public function decide(DecideApplicationRequest $request, string $application): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = $this->requireYear($school);
        $target = $this->application($school, $application);

        $data = $request->validated();

        if ($target->stage === ApplicationStage::Admitted) {
            throw ValidationException::withMessages([
                'decision' => __(':full_name is already admitted. Change the student record instead.', ['full_name' => $target->full_name]),
            ]);
        }

        $stage = match ($data['decision']) {
            'admit' => ApplicationStage::Admitted,
            'waitlist' => ApplicationStage::Waitlist,
            default => ApplicationStage::Declined,
        };
        $following = $this->nextToReview($year, $target);

        DB::transaction(function () use ($request, $school, $year, $target, $stage, $data) {
            $target->fill([
                'stage' => $stage,
                'condition' => $stage === ApplicationStage::Admitted ? ($data['condition'] ?? null) : null,
                'decided_by' => $request->user()?->id,
                'decided_at' => now(),
            ]);

            if ($stage === ApplicationStage::Admitted) {
                $target->student_id = $this->admit($school, $year, $target)->id;
            }

            $target->save();
            $this->audit($request, $school, $target, $stage->value, ['student' => $target->student_id]);
        });

        $this->notify('Decision recorded.');

        return $following
            ? redirect()->route('enrolment.applications.show', $following->id)
            : redirect()->route('enrolment.applications');
    }

    /**
     * Turn an application into a student: a matricule of the coming
     * year, the parents, a sibling link when a parent's phone is already
     * known, and a row waiting for a class in the level applied for.
     */
    protected function admit(School $school, AcademicYear $year, Application $application): Student
    {
        $student = Student::register($school, [
            'surname' => $application->surname,
            'given_names' => $application->given_names,
            'full_name' => $application->full_name,
            'date_of_birth' => $application->date_of_birth->toDateString(),
            'gender' => $application->gender,
            'place_of_birth' => $application->place_of_birth,
            'religion' => $application->religion,
            'has_disability' => $application->disability !== null,
            'disability_support' => $application->disability,
            'transferred' => $application->transferred,
            'previous_school' => $application->previous_school,
            'previous_class' => $application->previous_class,
            'transfer_certificate_received' => in_array('transfer_certificate', $application->documents, true),
            'last_report_received' => in_array('last_report', $application->documents, true),
        ], $application->guardians, $year->starts_on);

        $sibling = $this->sibling($school, $application, $student->id);

        if ($sibling) {
            $family = $sibling->family_id ?? (string) Str::uuid7();
            $sibling->update(['family_id' => $family]);
            $student->update(['family_id' => $family]);
        }

        Enrolment::create([
            'student_id' => $student->id,
            'academic_year_id' => $year->id,
            'level_id' => $application->level_id,
            'status' => EnrolmentStatus::Admitted,
        ]);

        return $student;
    }

    /**
     * A student already here who shares a parent's phone number.
     */
    protected function sibling(School $school, Application $application, ?string $exceptId = null): ?Student
    {
        foreach ($application->guardians as $guardian) {
            $digits = preg_replace('/\D+/', '', (string) $guardian['phone']) ?? '';

            if (strlen($digits) < 9) {
                continue;
            }

            $match = StudentGuardian::query()
                ->whereRaw("REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE ?", ['%'.substr($digits, -9)])
                ->whereHas('student', fn (Builder $query) => $query
                    ->where('school_id', $school->id)
                    ->when($exceptId ?? $application->student_id, fn (Builder $inner, string $id) => $inner->where('id', '!=', $id)))
                ->with('student')
                ->first();

            if ($match?->student) {
                return $match->student;
            }
        }

        return null;
    }

    protected function currentClass(School $school, Student $student): ?string
    {
        $year = StructureController::currentYear($school);

        return $year
            ? Enrolment::where('student_id', $student->id)
                ->where('academic_year_id', $year->id)
                ->with('schoolClass:id,name')
                ->first()?->schoolClass?->name
            : null;
    }

    /**
     * The oldest application still to review, other than this one.
     */
    protected function nextToReview(AcademicYear $year, Application $except): ?Application
    {
        return Application::where('academic_year_id', $year->id)
            ->where('stage', ApplicationStage::ToReview)
            ->where('id', '!=', $except->id)
            ->orderBy('created_at')
            ->orderBy('reference')
            ->first();
    }

    protected function application(School $school, string $id): Application
    {
        return Application::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    protected function requireYear(School $school): AcademicYear
    {
        return EnrolmentController::nextYear($school) ?? throw ValidationException::withMessages([
            'year' => __('Enrolment needs a planned academic year. Add next year in School Setup first.'),
        ]);
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
     * @param  array<string, mixed>  $data
     * @return list<array{relation: string, name: string, phone?: string|null, occupation?: string|null}>
     */
    protected function guardianRows(array $data): array
    {
        return $data['guardians'];
    }

    protected function audit(Request $request, School $school, Application $application, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'application',
            'entity_id' => $application->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
