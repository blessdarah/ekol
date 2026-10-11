<?php

namespace App\Http\Requests\Enrolment;

use App\Http\Requests\SchoolRequest;

class PromoteClassRequest extends SchoolRequest
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
            'class_id' => ['required', 'uuid'],
        ];
    }
}
