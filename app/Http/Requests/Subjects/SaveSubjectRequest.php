<?php

namespace App\Http\Requests\Subjects;

use App\Enums\SubjectDomain;
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

    /**
     * @return array{name: string, code: string, department: string, domain: SubjectDomain, coefficient: string, note: string|null, classes: list<array{class_id: string, staff_id: string|null, weekly_periods: int}>}
     */
    public function subjectData(): array
    {
        $classes = [];

        foreach ($this->array('classes') as $key => $row) {
            $prefix = "classes.{$key}";
            $classes[] = [
                'class_id' => $this->string("{$prefix}.class_id")->toString(),
                'staff_id' => $this->input("{$prefix}.staff_id") === null ? null : $this->string("{$prefix}.staff_id")->toString(),
                'weekly_periods' => $this->integer("{$prefix}.weekly_periods"),
            ];
        }

        return [
            'name' => $this->string('name')->toString(),
            'code' => $this->string('code')->toString(),
            'department' => $this->string('department')->toString(),
            'domain' => SubjectDomain::from($this->string('domain')->toString()),
            'coefficient' => $this->string('coefficient')->toString(),
            'note' => $this->input('note') === null ? null : $this->string('note')->toString(),
            'classes' => $classes,
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
            'domain' => ['required', Rule::enum(SubjectDomain::class)],
            'note' => ['nullable', 'string', 'max:255'],
            'mode' => ['required', Rule::in(['draft', 'register'])],
            'classes' => ['present', 'array'],
            'classes.*.class_id' => ['distinct'],
            ...static::classRules($school, $this->schoolContext()->year(), 'classes'),
        ];
    }
}
