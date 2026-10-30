<?php

namespace App\Http\Requests\Structure;

use App\Http\Requests\SchoolRequest;

class UpdateLevelRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-structure');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'uses_series' => ['required', 'boolean'],
        ];
    }
}
