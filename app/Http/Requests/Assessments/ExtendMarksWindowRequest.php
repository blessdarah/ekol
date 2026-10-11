<?php

namespace App\Http\Requests\Assessments;

use App\Http\Requests\SchoolRequest;
use App\Models\AssessmentPlan;

class ExtendMarksWindowRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesAssessments();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $plan = AssessmentPlan::where('school_id', $this->school()->id)->where('id', $this->route('plan'))->firstOrFail();
        $ends = $plan->term()->value('ends_on');

        return [
            'window_ends_on' => [
                'required', 'date', 'after_or_equal:today',
                'after_or_equal:'.($plan->window_starts_on?->toDateString() ?? 'today'),
                'before_or_equal:'.$ends?->toDateString(),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'window_ends_on.after_or_equal' => 'Choose today or a later day, after the window opens.',
            'window_ends_on.before_or_equal' => 'The window must close inside the term.',
        ];
    }
}
