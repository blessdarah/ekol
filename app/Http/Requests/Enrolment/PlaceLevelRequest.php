<?php

namespace App\Http\Requests\Enrolment;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class PlaceLevelRequest extends SchoolRequest
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
            'level_id' => ['required', Rule::exists('levels', 'id')->where('school_id', $this->school()->id)],
        ];
    }
}
