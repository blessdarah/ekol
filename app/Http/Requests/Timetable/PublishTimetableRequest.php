<?php

namespace App\Http\Requests\Timetable;

class PublishTimetableRequest extends TermRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'effective_on' => ['required', 'date', ...$this->insideTerm()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'effective_on.after_or_equal' => 'Choose a date inside the term.',
            'effective_on.before_or_equal' => 'Choose a date inside the term.',
        ];
    }
}
