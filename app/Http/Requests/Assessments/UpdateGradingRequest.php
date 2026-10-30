<?php

namespace App\Http\Requests\Assessments;

use App\Http\Requests\SchoolRequest;
use App\Models\AssessmentPlan;

class UpdateGradingRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->can('manage-assessments') && $user->can('manage-staff');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $top = AssessmentPlan::OUT_OF;

        return [
            'pass_mark' => ['required', 'numeric', 'min:0', "max:{$top}"],
            'bands' => ['required', 'array', 'min:2', 'max:10'],
            'bands.*.letter' => ['required', 'string', 'max:2', 'distinct'],
            'bands.*.from' => ['required', 'numeric', 'min:0', "max:{$top}"],
            'bands.*.to' => ['required', 'numeric', 'min:0', "max:{$top}"],
            'bands.*.meaning' => ['required', 'string', 'max:40'],
            'bands.*.remark' => ['required', 'string', 'max:160'],
        ];
    }
}
