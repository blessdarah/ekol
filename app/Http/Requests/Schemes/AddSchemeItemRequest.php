<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;

/**
 * A sub-topic the teacher adds that the syllabus does not have.
 */
class AddSchemeItemRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'topic' => ['required', 'string', 'max:160'],
            'name' => ['nullable', 'string', 'max:160'],
            'periods' => ['required', 'integer', 'min:1', 'max:30'],
            'week' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'topic.required' => __('Give the topic a name.'),
        ];
    }
}
