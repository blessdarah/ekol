<?php

namespace App\Http\Controllers;

use App\Actions\Students\AdmitStudent;
use App\Http\Requests\Students\SaveStudentRequest;
use App\Http\StudentRegistrationForm;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentGuardian;
use App\Models\StudentSeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Response;

class StudentRegistrationController extends Controller
{
    public function create(Request $request, StudentRegistrationForm $form): Response
    {
        $school = $this->schoolContext->school();

        return $form->render($request, $school, null);
    }

    public function edit(Request $request, string $student, StudentRegistrationForm $form): Response
    {
        $school = $this->schoolContext->school();

        return $form->render($request, $school, $this->student($school, $student));
    }

    public function store(SaveStudentRequest $request, AdmitStudent $admitStudent): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();

        if (! $year) {
            throw ValidationException::withMessages([
                'class_id' => __('Students are placed in a class of an academic year. Make a year active in School Setup first.'),
            ]);
        }

        $data = $this->validated($request, $school, null);
        $class = SchoolClass::whereKey($data['class_id'])->firstOrFail();
        $series = $data['series_id'] ? Series::whereKey($data['series_id'])->first() : null;

        $student = $admitStudent->handle(
            $school, $year, $this->schoolContext->term(), $class,
            $this->profile($request, $data), $this->guardians($data),
            $request->user(), $series, $data['link_sibling_id'] ?? null,
            (bool) ($data['allow_duplicate'] ?? false),
        );

        $this->notify(__(':name registered as :matricule.', ['name' => $student->full_name, 'matricule' => $student->admission_no]));

        return $request->boolean('another')
            ? redirect()->route('students.create')
            : redirect()->route('students.show', $student->id);
    }

    public function update(SaveStudentRequest $request, string $student): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
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

            if ($term = $this->schoolContext->term()) {
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
            AuditEvent::record($school, $request->user(), 'student', $target->id, 'updated', ['class_id' => $data['class_id']]);
        });

        $this->notify('Student record saved.');

        return redirect()->route('students.show', $target->id);
    }

    /**
     * Another student whose parent has the same phone number.
     */
    public function siblingCheck(Request $request): JsonResponse
    {
        $school = $this->schoolContext->school();
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

    protected function student(School $school, string $id): Student
    {
        return Student::where('school_id', $school->id)->where('id', $id)->firstOrFail();
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
                'main_contact' => __('The main contact needs a name and a phone number.'),
            ]);
        }

        $class = SchoolClass::whereKey($data['class_id'])->firstOrFail();
        $taken = Enrolment::where('school_class_id', $class->id)
            ->when($student, fn (Builder $query) => $query->where('student_id', '!=', $student?->id))
            ->count();

        if ($taken >= $class->capacity) {
            throw ValidationException::withMessages([
                'class_id' => __(':name is full, :taken of :capacity. Choose another class or add seats under Levels.', ['name' => $class->name, 'taken' => $taken, 'capacity' => $class->capacity]),
            ]);
        }

        if ($data['series_id'] && Series::whereKey($data['series_id'])->value('level_id') !== $class->level_id) {
            throw ValidationException::withMessages([
                'series_id' => __('That series belongs to another level.'),
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
                'duplicate' => __(':full_name (:admission_no) has the same name and date of birth.', ['full_name' => $twin->full_name, 'admission_no' => $twin->admission_no]),
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

        if ($request->user()?->can('see-private-student-details')) {
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
}
