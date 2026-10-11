<?php

namespace App\Http\Requests\Setup;

use App\Http\Requests\SchoolRequest;

class UpdateWindowsRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'assessments' => ['required', 'array'],
            'assessments.*.id' => ['required', 'uuid'],
            'assessments.*.window_starts_on' => ['nullable', 'date'],
            'assessments.*.window_ends_on' => ['nullable', 'date', 'after_or_equal:assessments.*.window_starts_on'],
        ];
    }
}
