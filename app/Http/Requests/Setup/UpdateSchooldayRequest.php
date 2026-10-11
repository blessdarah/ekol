<?php

namespace App\Http\Requests\Setup;

use App\Http\Requests\SchoolRequest;

class UpdateSchooldayRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'school_days' => ['sometimes', 'integer', 'min:0', 'max:127'],
            'periods' => ['sometimes', 'array'],
            'periods.*.id' => ['nullable', 'uuid'],
            'periods.*.label' => ['required_with:periods', 'string', 'max:255'],
            'periods.*.starts_at' => ['required_with:periods', 'date_format:H:i'],
            'periods.*.ends_at' => ['required_with:periods', 'date_format:H:i', 'after:periods.*.starts_at'],
            'periods.*.is_break' => ['sometimes', 'boolean'],
            'periods.*._delete' => ['sometimes', 'boolean'],
        ];
    }
}
