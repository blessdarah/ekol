<?php

namespace App\Http\Requests\Fees;

use App\Http\Requests\SchoolRequest;
use App\Models\FeeExemption;
use Illuminate\Validation\Rule;

class ExemptInvoiceRequest extends SchoolRequest
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
            'kind' => ['required', Rule::in(FeeExemption::KINDS)],
            'value' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', 'string', 'max:150'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'value.gt' => 'Enter an amount above zero.',
            'reason.required' => 'Say why, so the bursar and the principal can account for it.',
        ];
    }
}
