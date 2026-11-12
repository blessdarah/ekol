<?php

namespace App\Http\Requests\Staff;

use App\Enums\UserRole;
use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class SaveStaffAccessRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-staff');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $member = $this->route('staff');

        return [
            'role' => ['required', Rule::enum(UserRole::class)->only(UserRole::assignable())],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users')->where('school_id', $this->school()->id)->ignore($member),
            ],
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

    /**
     * @return array{role: UserRole, email: string, phone: string, channel: string, create_now: bool}
     */
    public function accessData(): array
    {
        return [
            'role' => UserRole::from($this->string('role')->toString()),
            'email' => $this->string('email')->toString(),
            'phone' => $this->string('phone')->toString(),
            'channel' => $this->string('channel')->toString(),
            'create_now' => $this->boolean('create_now'),
        ];
    }
}
