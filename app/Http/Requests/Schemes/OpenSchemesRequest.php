<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;
use App\Models\SchemeOpening;
use Illuminate\Validation\Rule;

class OpenSchemesRequest extends SchoolRequest
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
