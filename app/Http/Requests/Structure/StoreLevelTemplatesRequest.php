<?php

namespace App\Http\Requests\Structure;

use App\Http\Requests\SchoolRequest;

class StoreLevelTemplatesRequest extends SchoolRequest
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
            'levels' => ['required', 'array', 'min:1'],
            'levels.*.code' => ['required', 'string', 'distinct'],
            'levels.*.class_count' => ['required', 'integer', 'min:0', 'max:12'],
        ];
    }
}
