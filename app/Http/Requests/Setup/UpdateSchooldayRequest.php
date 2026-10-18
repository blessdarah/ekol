<?php

namespace App\Http\Requests\Setup;

use App\Http\Requests\SchoolRequest;

/**
 * The school day: which days are taught, when the day starts, how long
 * a lesson lasts by default, and the periods in order. Times are worked
 * out from these, so periods carry a length rather than start and end.
 */
class UpdateSchooldayRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'school_days' => ['sometimes', 'integer', 'min:0', 'max:127'],
            'day_starts_at' => ['sometimes', 'date_format:H:i'],
            'period_minutes' => ['sometimes', 'integer', 'min:10', 'max:180'],
            'periods' => ['sometimes', 'array'],
            'periods.*.id' => ['nullable', 'uuid'],
            'periods.*.label' => ['required_with:periods', 'string', 'max:255'],
            'periods.*.is_break' => ['sometimes', 'boolean'],
            'periods.*.custom_minutes' => ['nullable', 'integer', 'min:5', 'max:240', 'required_if_accepted:periods.*.is_break'],
            'periods.*._delete' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'period_minutes.min' => __('A period lasts at least 10 minutes.'),
            'period_minutes.max' => __('A period lasts at most 180 minutes.'),
            'periods.*.custom_minutes.min' => __('A period or break lasts at least 5 minutes.'),
            'periods.*.custom_minutes.max' => __('A period or break lasts at most 240 minutes.'),
            'periods.*.custom_minutes.required_if_accepted' => __('Give the break a length.'),
        ];
    }
}
