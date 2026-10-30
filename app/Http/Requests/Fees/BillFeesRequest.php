<?php

namespace App\Http\Requests\Fees;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class BillFeesRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-fees');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school();

        return [
            'year_id' => ['required', Rule::exists('academic_years', 'id')->where('school_id', $school->id)],
            'level_id' => ['nullable', Rule::exists('levels', 'id')->where('school_id', $school->id)],
        ];
    }
}
