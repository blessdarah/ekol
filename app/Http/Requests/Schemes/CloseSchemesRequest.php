<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;

class CloseSchemesRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-schemes');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'open_next' => ['required', 'boolean'],
        ];
    }
}
