<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;

class CloseSchemesRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesSchemes();
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
