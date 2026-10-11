<?php

namespace App\Http\Requests\Fees;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class UpdateFeeStructureRequest extends SchoolRequest
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
            'year_id' => ['required', Rule::exists('academic_years', 'id')->where('school_id', $this->school()->id)],
            'amounts' => ['present', 'array'],
            'amounts.*' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amounts.*.numeric' => 'Enter the fee as a number.',
            'amounts.*.min' => 'A fee cannot be negative.',
        ];
    }
}
