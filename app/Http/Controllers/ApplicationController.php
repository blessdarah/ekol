<?php

namespace App\Http\Controllers;

use App\Actions\Admissions\DecideApplication;
use App\Actions\Admissions\MatchApplicationSibling;
use App\Enums\ApplicationStage;
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
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ApplicationController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->nextYear();

        if (! $year) {
            return redirect()->route('enrolment');
        }

        return Inertia::render('enrolment/application-new', [
            'enrolment' => $year->enrolmentProgress($school, $this->schoolContext->year()),
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'religions' => Student::RELIGIONS,
            'documents' => Application::DOCUMENTS,
            'canSeePrivate' => (bool) $request->user()?->can('see-private-student-details'),
        ]);
    }

    public function store(StoreApplicationRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->requireYear($school);

        $data = $request->validated();

        $guardians = $this->guardians($data);
        $main = collect($guardians)->firstWhere('is_main', true);

        if (! $main || trim((string) $main['phone']) === '') {
            throw ValidationException::withMessages([
                'main_contact' => __('The main contact needs a name and a phone number.'),
            ]);
        }

        $private = (bool) $request->user()?->can('see-private-student-details');
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

            AuditEvent::record($school, $request->user(), 'application', $application->id, 'received', ['reference' => $application->reference]);

            return $application;
        });

        $this->notify('Application recorded.');

        return redirect()->route('enrolment.applications.show', $application->id);
    }

    public function show(Request $request, string $application, MatchApplicationSibling $siblings): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->nextYear();

        if (! $year) {
            return redirect()->route('enrolment');
        }

        $target = $this->application($school, $application);
        $private = (bool) $request->user()?->can('see-private-student-details');
        $sibling = $siblings->handle($school, $target);
        $level = collect($year->enrolmentCapacity($school))->firstWhere('id', $target->level_id);
        $required = $target->requiredDocuments();

        return Inertia::render('enrolment/application-review', [
            'enrolment' => $year->enrolmentProgress($school, $this->schoolContext->year()),
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
        $school = $this->schoolContext->school();
        $target = $this->application($school, $application);

        $data = $request->validated();

        $target->update(['documents' => array_values($data['documents'])]);
        AuditEvent::record($school, $request->user(), 'application', $target->id, 'documents_updated', ['received' => $target->documents]);

        $this->notify('Documents updated.');

        return back();
    }

    public function decide(DecideApplicationRequest $request, string $application, DecideApplication $decideApplication): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->requireYear($school);
        $target = $this->application($school, $application);
        $data = $request->validated();
        $stage = match ($data['decision']) {
            'admit' => ApplicationStage::Admitted,
            'waitlist' => ApplicationStage::Waitlist,
            default => ApplicationStage::Declined,
        };
        $following = $this->nextToReview($year, $target);

        $decideApplication->handle($school, $year, $target, $request->user(), $stage, $data['condition'] ?? null);
        $this->notify('Decision recorded.');

        return $following
            ? redirect()->route('enrolment.applications.show', $following->id)
            : redirect()->route('enrolment.applications');
    }

    protected function currentClass(School $school, Student $student): ?string
    {
        $year = $this->schoolContext->year();

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
        return $this->schoolContext->nextYear() ?? throw ValidationException::withMessages([
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
}
