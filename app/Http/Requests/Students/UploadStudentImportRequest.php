<?php

namespace App\Http\Requests\Students;

use App\Http\Requests\SchoolRequest;

class UploadStudentImportRequest extends SchoolRequest
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
        return [
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.mimes' => __('Upload a CSV file. In Excel or Google Sheets, use Save as or Download as CSV.'),
        ];
    }
}
