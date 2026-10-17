<?php

namespace App\Http\Requests\Pay;

use Illuminate\Foundation\Http\FormRequest;

class ChooseAmountRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amount.required' => __('Choose how much to pay.'),
            'amount.integer' => __('Enter the amount in whole francs.'),
            'amount.min' => __('Enter an amount above zero.'),
        ];
    }
}
