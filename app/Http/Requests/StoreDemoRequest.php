<?php

namespace App\Http\Requests;

use App\Models\DemoRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDemoRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'school_name' => ['required', 'string', 'max:150'],
            'role' => ['required', Rule::in(DemoRequest::ROLES)],
            'students' => ['required', Rule::in(DemoRequest::SIZES)],
            'whatsapp' => ['required', 'string', 'regex:/^[0-9 ]{8,14}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'school_name.required' => __('Tell us the name of your school.'),
            'whatsapp.required' => __('Enter the WhatsApp number we should call.'),
            'whatsapp.regex' => __('Enter the number with digits only, without the country code.'),
        ];
    }
}
