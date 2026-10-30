<?php

namespace App\Http\Requests\Fees;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class UpdateFeeStructureRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-fees');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'year_id' => ['required', Rule::exists('academic_years', 'id')->where('school_id', $this->school()->id)],
            'items' => ['present', 'array', 'max:12'],
            'items.*.id' => ['nullable', 'uuid'],
            'items.*.name' => ['required', 'string', 'max:40', 'distinct:ignore_case'],
            'items.*.spread' => ['required', 'boolean'],
            'items.*.new_only' => ['required', 'boolean'],
            'items.*.amounts' => ['present', 'array'],
            'items.*.amounts.*' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.*.name.required' => __('Give the item a name.'),
            'items.*.name.distinct' => __('Two items have the same name.'),
            'items.*.amounts.*.numeric' => __('Enter the fee as a number.'),
            'items.*.amounts.*.min' => __('A fee cannot be negative.'),
        ];
    }
}
