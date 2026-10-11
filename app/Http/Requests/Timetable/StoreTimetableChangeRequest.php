<?php

namespace App\Http\Requests\Timetable;

use App\Models\TimetableChange;
use Illuminate\Validation\Rule;

class StoreTimetableChangeRequest extends TermRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school();

        return [
            'kind' => ['required', Rule::in(TimetableChange::KINDS)],
            'date' => ['required', 'date', ...$this->insideTerm()],
            'whole_week' => ['sometimes', 'boolean'],
            'covers' => ['required_if:kind,cover', 'array', 'min:1'],
            'covers.*.slot_id' => ['required', 'uuid'],
            'covers.*.staff_id' => ['required', Rule::exists('users', 'id')->where('school_id', $school->id)],
            'slot_id' => ['required_unless:kind,cover', 'uuid'],
            'other_slot_id' => ['required_if:kind,swap', 'uuid', 'different:slot_id'],
            'room_id' => ['required_if:kind,room', Rule::exists('rooms', 'id')->where('school_id', $school->id)->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.after_or_equal' => 'Choose a date inside the term.',
            'date.before_or_equal' => 'Choose a date inside the term.',
            'covers.required_if' => 'Choose who covers at least one lesson.',
        ];
    }
}
