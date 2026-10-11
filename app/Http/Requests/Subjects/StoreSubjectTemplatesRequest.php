<?php

namespace App\Http\Requests\Subjects;

use App\Http\Controllers\StructureController;
use App\Http\Requests\SchoolRequest;

class StoreSubjectTemplatesRequest extends SchoolRequest
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
        $school = $this->school();

        return [
            'subjects' => ['required', 'array', 'min:1'],
            'subjects.*.code' => ['required', 'string', 'distinct'],
            'subjects.*.classes' => ['present', 'array'],
            ...SaveSubjectRequest::classRules($school, StructureController::currentYear($school), 'subjects.*.classes'),
        ];
    }
}
