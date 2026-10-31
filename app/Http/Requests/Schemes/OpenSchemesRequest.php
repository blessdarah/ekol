<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;
use App\Models\SchemeOpening;
use Illuminate\Validation\Rule;

class OpenSchemesRequest extends SchoolRequest
{
    /**
     * @return array{due_on: string, approval: string, starts_from: string, free_changes: bool}
     */
    public function openingData(): array
    {
        return [
            'due_on' => $this->string('due_on')->toString(),
            'approval' => $this->string('approval')->toString(),
            'starts_from' => $this->string('starts_from')->toString(),
            'free_changes' => $this->boolean('free_changes'),
        ];
    }

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
            'due_on' => ['required', 'date'],
            'approval' => ['required', Rule::in(SchemeOpening::APPROVALS)],
            'starts_from' => ['required', Rule::in([SchemeOpening::FROM_SYLLABUS, SchemeOpening::FROM_LAST_YEAR])],
            'free_changes' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'due_on.required' => __('Choose the date teachers submit by.'),
        ];
    }
}
