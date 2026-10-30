<?php

namespace App\Http\Requests\Enrolment;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class DecideApplicationRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-students');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['admit', 'waitlist', 'decline'])],
            'condition' => ['nullable', 'string', 'max:255'],
        ];
    }
}
