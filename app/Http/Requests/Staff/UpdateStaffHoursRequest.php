<?php

namespace App\Http\Requests\Staff;

use App\Http\Requests\SchoolRequest;

class UpdateStaffHoursRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesStaff();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'teaching_days' => ['nullable', 'integer', 'min:1', 'max:127'],
            'max_periods_week' => ['nullable', 'integer', 'min:1', 'max:60'],
            'max_periods_day' => ['nullable', 'integer', 'min:1', 'max:12'],
            'unavailable_times' => ['present', 'array', 'max:20'],
            'unavailable_times.*.weekday' => ['required', 'integer', 'min:0', 'max:6'],
            'unavailable_times.*.from' => ['required', 'string', 'max:20'],
            'unavailable_times.*.to' => ['required', 'string', 'max:20'],
            'unavailable_times.*.reason' => ['nullable', 'string', 'max:100'],
        ];
    }
}
