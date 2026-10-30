<?php

namespace App\Http\Requests\Structure;

use App\Http\Requests\SchoolRequest;
use App\Models\SchoolClass;
use Illuminate\Validation\Rule;

class UpdateClassRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-structure');
    }

    /**
     * Join the letter to the level number, as every class name is written.
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => SchoolClass::tidyName($this->input('name'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school();
        $class = SchoolClass::where('school_id', $school->id)->where('id', $this->route('class'))->firstOrFail();

        return [
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('school_classes')
                    ->where('academic_year_id', $class->academic_year_id)
                    ->where('level_id', $class->level_id)
                    ->ignore($class->id),
            ],
            'capacity' => ['required', 'integer', 'min:1', 'max:500'],
            'form_master_id' => ['nullable', Rule::exists('users', 'id')->where('school_id', $school->id)],
            'home_room_id' => [
                'nullable',
                Rule::exists('rooms', 'id')->where('school_id', $school->id),
                Rule::unique('school_classes', 'home_room_id')
                    ->where('academic_year_id', $class->academic_year_id)
                    ->ignore($class->id),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'home_room_id.unique' => __('That room is already the home room of another class.'),
        ];
    }
}
