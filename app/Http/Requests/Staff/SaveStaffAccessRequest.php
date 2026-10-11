<?php

namespace App\Http\Requests\Staff;

use App\Enums\UserRole;
use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class SaveStaffAccessRequest extends SchoolRequest
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
        $member = $this->route('staff');

        return [
            'role' => ['required', Rule::enum(UserRole::class)->only(UserRole::assignable())],
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($member)],
            'phone' => [
                'required',
                'string',
                'max:30',
                Rule::unique('users')->where('school_id', $this->school()->id)->ignore($member),
            ],
            'channel' => ['required', Rule::in(['email', 'sms', 'both'])],
            'create_now' => ['required', 'boolean'],
        ];
    }
}
