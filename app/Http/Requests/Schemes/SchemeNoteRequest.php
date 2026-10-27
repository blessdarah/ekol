<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;

class SchemeNoteRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->followsSchemes();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'note' => ['required', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required' => __('Write the note first.'),
        ];
    }
}
