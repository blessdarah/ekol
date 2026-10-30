<?php

namespace App\Http\Requests\Structure;

use App\Enums\SchoolCycle;
use App\Http\Requests\SchoolRequest;
use App\Models\Level;
use Illuminate\Validation\Rule;

class StoreLevelRequest extends SchoolRequest
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
        $school = $this->school();

        return [
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('levels')->where('school_id', $school->id),
            ],
            'code' => [
                'required', 'string', 'max:10',
                Rule::unique('levels')->where('school_id', $school->id),
            ],
            'cycle' => ['required', Rule::in([SchoolCycle::Secondary->value, SchoolCycle::HighSchool->value])],
            'subsystem' => ['required', Rule::in(Level::SUBSYSTEMS)],
            'uses_series' => ['required', 'boolean'],
            'class_count' => ['required', 'integer', 'min:0', 'max:12'],
        ];
    }
}
