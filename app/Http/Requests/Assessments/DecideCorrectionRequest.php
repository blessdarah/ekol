<?php

namespace App\Http\Requests\Assessments;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class DecideCorrectionRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        $role = $this->user()?->role;

        return $role !== null && $role->managesAssessments() && $role->managesStaff();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['approve', 'decline'])],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
