<?php

namespace App\Http\Requests\Timetable;

use App\Http\Requests\SchoolRequest;

class GenerateTimetableRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-structure');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'options' => ['present', 'array'],
            'options.*' => ['boolean'],
        ];
    }
}
