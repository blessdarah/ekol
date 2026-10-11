<?php

namespace App\Http\Requests\Fees;

use App\Enums\PaymentMethod;
use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class RecordPaymentRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesFees();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'invoice_id' => ['required', Rule::exists('invoices', 'id')->where('student_id', $this->route('student'))],
            'amount' => ['required', 'numeric', 'min:1'],
            'method' => ['required', Rule::in([PaymentMethod::Cash->value, PaymentMethod::MobileMoney->value, PaymentMethod::BankTransfer->value])],
            'reference' => ['nullable', 'required_unless:method,cash', 'string', 'max:60'],
            'date' => ['required', 'date', 'before_or_equal:today'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reference.required_unless' => 'Enter the transaction reference.',
            'date.before_or_equal' => 'A payment cannot be dated in the future.',
        ];
    }
}
