<?php

namespace App\Http\Requests\Students;

use App\Http\Requests\SchoolRequest;

class ExcuseAbsenceRequest extends SchoolRequest
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
            'note' => ['required', 'string', 'max:160'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required' => __('Say why the absence is excused.'),
        ];
    }
}
