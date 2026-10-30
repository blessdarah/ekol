<?php

namespace App\Http\Requests\Assessments;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Http\Controllers\StructureController;
use App\Http\Requests\SchoolRequest;
use App\Models\AssessmentPlan;
use App\Models\Term;
use Illuminate\Validation\Rule;

/**
 * A sequence or exam, when planned and when edited. Its dates are
 * optional while it is a draft and required once it is scheduled.
 */
class SaveAssessmentPlanRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-assessments');
    }

    /**
     * Whether the plan is, or is being, scheduled.
     */
    public function scheduling(): bool
    {
        return $this->boolean('schedule') || $this->plan()?->state === AssessmentState::Scheduled;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school();
        $year = StructureController::currentYear($school);
        $term = Term::where('school_id', $school->id)
            ->where('academic_year_id', $year?->id)
            ->where('id', (string) $this->input('term_id'))
            ->first();
        $inside = $term ? ['after_or_equal:'.$term->starts_on->toDateString(), 'before_or_equal:'.$term->ends_on->toDateString()] : [];
        $need = $this->scheduling() ? 'required' : 'nullable';

        return [
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('assessment_plans')->where('term_id', $term?->id)->ignore($this->plan()?->id),
            ],
            'kind' => ['required', Rule::enum(AssessmentKind::class)],
            'term_id' => ['required', Rule::exists('terms', 'id')->where('school_id', $school->id)->where('academic_year_id', $year?->id)],
            'held_from' => [$need, 'date', ...$inside],
            'held_until' => [$need, 'date', 'after_or_equal:held_from', ...$inside],
            'window_starts_on' => [$need, 'date', 'after_or_equal:held_from', ...$inside],
            'window_ends_on' => [$need, 'date', 'after_or_equal:window_starts_on', 'after_or_equal:held_until', ...$inside],
            'level_ids' => ['required', 'array', 'min:1'],
            'level_ids.*' => ['distinct', Rule::exists('levels', 'id')->where('school_id', $school->id)->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => __('This term already has an assessment with that name.'),
            'held_from.required' => __('Set the dates before scheduling.'),
            'held_from.after_or_equal' => __('Keep the dates inside the term.'),
            'held_from.before_or_equal' => __('Keep the dates inside the term.'),
            'held_until.after_or_equal' => __('This must be on or after the first day, inside the term.'),
            'held_until.before_or_equal' => __('Keep the dates inside the term.'),
            'window_starts_on.after_or_equal' => __('The marks window opens with the tests, inside the term.'),
            'window_starts_on.before_or_equal' => __('Keep the dates inside the term.'),
            'window_ends_on.after_or_equal' => __('The window closes after it opens and after the last test.'),
            'window_ends_on.before_or_equal' => __('Keep the dates inside the term.'),
            'level_ids.required' => __('Choose at least one level.'),
        ];
    }

    /**
     * The plan being edited, or null when a new one is planned.
     */
    protected function plan(): ?AssessmentPlan
    {
        $id = $this->route('plan');

        return $id ? AssessmentPlan::where('school_id', $this->school()->id)->where('id', $id)->first() : null;
    }
}
