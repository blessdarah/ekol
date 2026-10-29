<?php

namespace App\Http\Requests\Profile;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

/**
 * The signed-in person's own name, phone and photo. The email is not
 * here: only the school's administrator changes it.
 */
class UpdateProfileRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'given_name' => ['required', 'string', 'max:100'],
            'family_name' => ['required', 'string', 'max:100'],
            'phone' => [
                'required',
                'string',
                'max:30',
                Rule::unique('users')->where('school_id', $this->school()->id)->ignore($this->user()),
            ],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.unique' => __('Someone else at this school already uses this number.'),
        ];
    }
}
