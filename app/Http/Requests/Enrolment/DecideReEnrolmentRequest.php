<?php

namespace App\Http\Requests\Enrolment;

use App\Enums\EnrolmentDecision;
use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class DecideReEnrolmentRequest extends SchoolRequest
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
            'enrolment_id' => ['required', 'uuid'],
            'decision' => ['nullable', Rule::enum(EnrolmentDecision::class)],
        ];
    }
}
