<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

/**
 * A syllabus topic and its sub-topics, when added and when edited.
 */
class SaveSyllabusTopicRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-schemes');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school()->id;

        return [
            'level_id' => [Rule::requiredIf($this->route('topic') === null), Rule::exists('levels', 'id')->where('school_id', $school)],
            'subject_id' => [Rule::requiredIf($this->route('topic') === null), Rule::exists('subjects', 'id')->where('school_id', $school)],
            'name' => ['required', 'string', 'max:160'],
            'term_sequence' => ['required', 'integer', 'min:1', 'max:3'],
            'week_from' => ['nullable', 'integer', 'min:1', 'max:20'],
            'week_to' => ['nullable', 'integer', 'min:1', 'max:20', 'gte:week_from'],
            'periods' => ['required', 'integer', 'min:1', 'max:60'],
            'subtopics' => ['array', 'max:30'],
            'subtopics.*.id' => ['nullable', 'uuid'],
            'subtopics.*.name' => ['required', 'string', 'max:160'],
            'subtopics.*.periods' => ['required', 'integer', 'min:1', 'max:30'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => __('Give the topic a name.'),
            'week_to.gte' => __('The last week comes after the first.'),
            'subtopics.*.name.required' => __('Give each sub-topic a name.'),
        ];
    }
}
