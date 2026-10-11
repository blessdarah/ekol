<?php

namespace App\Http\Requests\Setup;

use App\Http\Requests\SchoolRequest;

class UpdateInstallmentsRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'templates' => ['required', 'array', 'min:1'],
            'templates.*.seq' => ['required', 'integer', 'min:1'],
            'templates.*.percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'templates.*.due_on' => ['nullable', 'date'],
        ];
    }
}
