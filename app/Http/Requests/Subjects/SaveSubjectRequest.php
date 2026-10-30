<?php

namespace App\Http\Requests\Subjects;

use App\Http\Requests\SchoolRequest;
use App\Models\AcademicYear;
use App\Models\School;
use Illuminate\Validation\Rule;

/**
 * A subject and the classes that take it, when added and when edited.
 */
class SaveSubjectRequest extends SchoolRequest
{
    /**
     * Rules for a list of class rows: the class, its teacher and the
     * weekly periods. Classes come from the current year only.
     *
     * @return array<string, mixed>
     */
    public static function classRules(School $school, ?AcademicYear $year, string $prefix): array
    {
        return [
            "{$prefix}.*.class_id" => [
                'required',
                Rule::exists('school_classes', 'id')
                    ->where('school_id', $school->id)
                    ->where('academic_year_id', $year?->id),
            ],
            "{$prefix}.*.staff_id" => ['nullable', Rule::exists('users', 'id')->where('school_id', $school->id)],
            "{$prefix}.*.weekly_periods" => ['required', 'integer', 'min:1', 'max:20'],
        ];
    }

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
            'name' => ['required', 'string', 'max:100'],
            'code' => [
                'required', 'string', 'max:20',
                Rule::unique('subjects')->where('school_id', $school->id)->ignore($this->route('subject')),
            ],
            'coefficient' => ['required', 'numeric', 'min:0.5', 'max:10'],
            'department' => ['required', 'string', 'max:60'],
            'note' => ['nullable', 'string', 'max:255'],
            'mode' => ['required', Rule::in(['draft', 'register'])],
            'classes' => ['present', 'array'],
            'classes.*.class_id' => ['distinct'],
            ...static::classRules($school, $this->schoolContext()->year(), 'classes'),
        ];
    }
}
