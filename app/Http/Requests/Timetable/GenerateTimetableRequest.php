<?php

namespace App\Http\Requests\Timetable;

use App\Http\Requests\SchoolRequest;

class GenerateTimetableRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesStructure();
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
