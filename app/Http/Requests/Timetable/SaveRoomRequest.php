<?php

namespace App\Http\Requests\Timetable;

use App\Enums\RoomKind;
use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

/**
 * A room and when it cannot be used, when added and when edited.
 */
class SaveRoomRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesStructure();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school();

        return [
            'code' => [
                'required', 'string', 'max:20',
                Rule::unique('rooms')->where('school_id', $school->id)->ignore($this->route('room')),
            ],
            'kind' => ['required', Rule::enum(RoomKind::class)],
            'capacity' => ['required', 'integer', 'min:1', 'max:1000'],
            'unavailable' => ['present', 'array', 'max:60'],
            'unavailable.*.weekday' => ['required', 'integer', 'min:0', 'max:6'],
            'unavailable.*.period_id' => ['required', Rule::exists('periods', 'id')->where('school_id', $school->id)],
            'unavailable.*.reason' => ['nullable', 'string', 'max:100'],
            'subject_ids' => ['sometimes', 'array'],
            'subject_ids.*' => [Rule::exists('subjects', 'id')->where('school_id', $school->id)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.unique' => __('Another room already has this name.'),
        ];
    }
}
