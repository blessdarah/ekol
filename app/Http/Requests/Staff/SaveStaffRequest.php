<?php

namespace App\Http\Requests\Staff;

use App\Enums\EmploymentType;
use App\Enums\Gender;
use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

/**
 * A staff member's details, when added and when edited.
 */
class SaveStaffRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-staff');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $member = $this->route('staff');

        return [
            'given_name' => ['required', 'string', 'max:100'],
            'family_name' => ['required', 'string', 'max:100'],
            'gender' => ['required', Rule::enum(Gender::class)],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users')->where('school_id', $this->school()->id)->ignore($member),
            ],
            'phone' => [
                'required',
                'string',
                'max:30',
                Rule::unique('users')->where('school_id', $this->school()->id)->ignore($member),
            ],
            'address' => ['required', 'string', 'max:255'],
            'qualification' => ['required', 'string', 'max:255'],
            'employment_type' => ['required', Rule::enum(EmploymentType::class)],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }
}
