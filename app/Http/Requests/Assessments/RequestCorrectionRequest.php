<?php

namespace App\Http\Requests\Assessments;

use App\Http\Requests\SchoolRequest;

/**
 * A request to change a mark after results are out. Whether the user
 * may ask depends on the sheet, so the controller decides that.
 */
class RequestCorrectionRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mark_id' => ['required', 'uuid'],
            'new_score' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Say why the mark should change.',
        ];
    }
}
