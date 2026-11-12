<?php

namespace App\Http\Requests\Attendance;

use App\Actions\Attendance\SaveLessonRegister;
use App\Enums\AttendanceStatus;
use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class SaveLessonRegisterRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'marks' => ['required', 'array', 'list'],
            'marks.*' => ['required', 'array'],
            'marks.*.student_id' => ['required', 'string', 'distinct'],
            'marks.*.status' => ['required', Rule::in(array_map(fn (AttendanceStatus $status) => $status->value, SaveLessonRegister::MARKS))],
            'marks.*.note' => ['nullable', 'string', 'max:160'],
        ];
    }
}
