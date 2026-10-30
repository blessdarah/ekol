<?php

namespace App\Http\Requests\Enrolment;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class ClearClassRequest extends SchoolRequest
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
        $school = $this->school();

        return [
            'class_id' => ['required', Rule::exists('school_classes', 'id')
                ->where('school_id', $school->id)
                ->where('academic_year_id', $this->schoolContext()->requireNextYear()->id)],
        ];
    }
}
