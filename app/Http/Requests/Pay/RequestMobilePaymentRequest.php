<?php

namespace App\Http\Requests\Pay;

use App\Models\MobilePayment;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class RequestMobilePaymentRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => [
                'required',
                'string',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (MobilePayment::operatorFor((string) $value) === null) {
                        $fail(__('Enter an MTN or Orange number of 9 digits, starting with 6.'));
                    }
                },
            ],
        ];
    }
}
