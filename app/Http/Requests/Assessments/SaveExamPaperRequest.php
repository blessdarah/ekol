<?php

namespace App\Http\Requests\Assessments;

use App\Enums\AssessmentKind;
use App\Http\Requests\SchoolRequest;
use App\Models\AssessmentPlan;
use Illuminate\Validation\Rule;

class SaveExamPaperRequest extends SchoolRequest
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
        $school = $this->school();
        $exam = AssessmentPlan::where('school_id', $school->id)
            ->where('kind', AssessmentKind::Exam)
            ->where('id', $this->route('plan'))
            ->firstOrFail();

        return [
            'level_id' => ['required', Rule::in($exam->level_ids)],
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where('school_id', $school->id)],
            'held_on' => ['required', 'date', ...($exam->held_from && $exam->held_until
                ? ['after_or_equal:'.$exam->held_from->toDateString(), 'before_or_equal:'.$exam->held_until->toDateString()]
                : [])],
            'starts_at' => ['required', 'date_format:H:i'],
            'hours' => ['required', 'numeric', 'min:0.5', 'max:6'],
            'room_id' => ['nullable', Rule::exists('rooms', 'id')->where('school_id', $school->id)->whereNull('deleted_at')],
            'invigilator_ids' => ['present', 'array', 'max:6'],
            'invigilator_ids.*' => ['distinct', Rule::exists('users', 'id')->where('school_id', $school->id)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'held_on.after_or_equal' => __('Choose a day inside the exam dates.'),
            'held_on.before_or_equal' => __('Choose a day inside the exam dates.'),
        ];
    }
}
