<?php

namespace App\Http\Requests\Structure;

use App\Http\Requests\SchoolRequest;

class UpdateLevelRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesStructure();
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
