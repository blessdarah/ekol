<?php

namespace App\Http\Requests\Enrolment;

use App\Enums\Gender;
use App\Http\Requests\SchoolRequest;
use App\Models\Application;
use App\Models\Student;
use App\Models\StudentGuardian;
use Illuminate\Validation\Rule;

class StoreApplicationRequest extends SchoolRequest
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
        return [
            'surname' => ['required', 'string', 'max:100'],
            'given_names' => ['required', 'string', 'max:100'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'gender' => ['required', Rule::enum(Gender::class)],
            'place_of_birth' => ['nullable', 'string', 'max:100'],
            'religion' => ['nullable', Rule::in(Student::RELIGIONS)],
            'disability' => ['nullable', 'string', 'max:255'],
            'level_id' => ['required', Rule::exists('levels', 'id')->where('school_id', $this->school()->id)->whereNull('deleted_at')],
            'transferred' => ['required', 'boolean'],
            'previous_school' => ['nullable', 'required_if_accepted:transferred', 'string', 'max:150'],
            'previous_class' => ['nullable', 'string', 'max:60'],
            'reason' => ['nullable', 'string', 'max:255'],
            'guardians' => ['required', 'array', 'min:1', 'max:3'],
            'guardians.*.relation' => ['required', 'distinct', Rule::in(StudentGuardian::RELATIONS)],
            'guardians.*.name' => ['required', 'string', 'max:150'],
            'guardians.*.phone' => ['nullable', 'string', 'max:30'],
            'guardians.*.occupation' => ['nullable', 'string', 'max:100'],
            'main_contact' => ['required', Rule::in(StudentGuardian::RELATIONS)],
            'documents' => ['present', 'array'],
            'documents.*' => ['distinct', Rule::in(array_keys(Application::DOCUMENTS))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'previous_school.required_if_accepted' => __('Enter the school the applicant is coming from.'),
        ];
    }
}
