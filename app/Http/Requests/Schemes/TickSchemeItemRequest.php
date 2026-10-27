<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;

class TickSchemeItemRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'taught' => ['required', 'boolean'],
        ];
    }
}
