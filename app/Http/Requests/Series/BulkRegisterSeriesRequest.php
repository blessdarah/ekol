<?php

namespace App\Http\Requests\Series;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class BulkRegisterSeriesRequest extends SchoolRequest
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
            'student_ids' => ['required', 'array', 'min:1'],
            'student_ids.*' => ['string', 'distinct'],
            'series_id' => ['required', Rule::exists('series', 'id')->where('school_id', $this->school()->id)],
            'electives' => ['present', 'array'],
            'electives.*' => ['string', 'distinct'],
        ];
    }
}
