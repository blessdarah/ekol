<?php

namespace App\Http\Requests\Enrolment;

use App\Http\Requests\SchoolRequest;
use App\Models\Application;
use Illuminate\Validation\Rule;

class UpdateApplicationDocumentsRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-students');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $application = Application::where('school_id', $this->school()->id)
            ->where('id', $this->route('application'))
            ->firstOrFail();

        return [
            'documents' => ['present', 'array'],
            'documents.*' => ['distinct', Rule::in(array_keys($application->requiredDocuments()))],
        ];
    }
}
