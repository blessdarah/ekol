<?php

namespace App\Http\Requests\Students;

use App\Enums\Gender;
use App\Http\Controllers\StructureController;
use App\Http\Requests\SchoolRequest;
use App\Models\Student;
use App\Models\StudentGuardian;
use Illuminate\Validation\Rule;

/**
 * A student's record, when registered and when edited.
 */
class SaveStudentRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesStudents();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school();
        $year = StructureController::currentYear($school);

        return [
            'surname' => ['required', 'string', 'max:100'],
            'given_names' => ['required', 'string', 'max:100'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'gender' => ['required', Rule::enum(Gender::class)],
            'place_of_birth' => ['nullable', 'string', 'max:100'],
            'religion' => ['nullable', Rule::in(Student::RELIGIONS)],
            'has_disability' => ['required', 'boolean'],
            'disability_types' => ['present', 'array'],
            'disability_types.*' => [Rule::in(Student::DISABILITY_TYPES)],
            'disability_support' => ['nullable', 'string', 'max:255'],
            'transferred' => ['required', 'boolean'],
            'previous_school' => ['nullable', 'required_if_accepted:transferred', 'string', 'max:150'],
            'previous_class' => ['nullable', 'string', 'max:60'],
            'previous_year_left' => ['nullable', 'integer', 'min:1990', 'max:'.(today()->year)],
            'transfer_certificate_received' => ['required', 'boolean'],
            'last_report_received' => ['required', 'boolean'],
            'on_whatsapp' => ['required', 'boolean'],
            'lives_with' => ['nullable', Rule::in(Student::LIVES_WITH)],
            'class_id' => [
                'required',
                Rule::exists('school_classes', 'id')
                    ->where('school_id', $school->id)
                    ->where('academic_year_id', $year?->id),
            ],
            'series_id' => ['nullable', Rule::exists('series', 'id')->where('school_id', $school->id)],
            'guardians' => ['required', 'array', 'min:1', 'max:3'],
            'guardians.*.relation' => ['required', 'distinct', Rule::in(StudentGuardian::RELATIONS)],
            'guardians.*.name' => ['required', 'string', 'max:150'],
            'guardians.*.phone' => ['nullable', 'string', 'max:30'],
            'guardians.*.occupation' => ['nullable', 'string', 'max:100'],
            'main_contact' => ['required', Rule::in(StudentGuardian::RELATIONS)],
            'link_sibling_id' => ['nullable', Rule::exists('students', 'id')->where('school_id', $school->id)],
            'allow_duplicate' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'previous_school.required_if_accepted' => 'Enter the school the student is transferring from.',
        ];
    }
}
