<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;

/**
 * Approving a scheme, or asking for changes, with a note to the
 * teacher. The note is needed only when sending it back.
 */
class ReviewSchemeRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('follow-schemes');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', 'in:approve,changes'],
            'note' => ['nullable', 'required_if:decision,changes', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required_if' => __('Tell the teacher what to change.'),
        ];
    }
}
