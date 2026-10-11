<?php

namespace App\Http\Requests\Setup;

use App\Http\Requests\SchoolRequest;

class UpdateTermsRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'terms' => ['required', 'array', 'min:1'],
            'terms.*.id' => ['nullable', 'uuid'],
            'terms.*.label' => ['required', 'string', 'max:255'],
            'terms.*.sequence' => ['required', 'integer', 'min:1'],
            'terms.*.starts_on' => ['required', 'date'],
            'terms.*.ends_on' => ['required', 'date', 'after_or_equal:terms.*.starts_on'],
            'terms.*.week_count' => ['required', 'integer', 'min:1'],
        ];
    }
}
