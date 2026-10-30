<?php

namespace App\Http\Requests\Assessments;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class DecideCorrectionRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->can('manage-assessments') && $user->can('manage-staff');
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
