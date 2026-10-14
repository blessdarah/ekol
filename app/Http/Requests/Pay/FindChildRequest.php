<?php

namespace App\Http\Requests\Pay;

use Illuminate\Foundation\Http\FormRequest;

class FindChildRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'school' => ['required', 'string', 'exists:schools,slug'],
            'matricule' => ['required', 'string', 'max:40'],
            'phone' => ['required', 'string', 'regex:/^[0-9 +]{8,16}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'school.required' => __('Choose your child’s school.'),
            'school.exists' => __('Choose your child’s school from the list.'),
            'matricule.required' => __('Enter the matricule from the report card or a receipt.'),
            'phone.required' => __('Enter your phone number.'),
            'phone.regex' => __('Enter the phone number with digits only.'),
        ];
    }
}
