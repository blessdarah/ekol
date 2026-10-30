<?php

namespace App\Http\Requests\Series;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class RegisterSeriesRequest extends SchoolRequest
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
            'student_id' => ['required', 'string'],
            'series_id' => ['required', Rule::exists('series', 'id')->where('school_id', $this->school()->id)],
            'electives' => ['present', 'array'],
            'electives.*' => ['string', 'distinct'],
            'next_id' => ['nullable', 'string'],
        ];
    }
}
