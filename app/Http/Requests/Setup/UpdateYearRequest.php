<?php

namespace App\Http\Requests\Setup;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class UpdateYearRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'label' => [
                'required', 'string', 'max:255',
                Rule::unique('academic_years')->where('school_id', $this->school()->id)->ignore($this->route('year')),
            ],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
        ];
    }
}
