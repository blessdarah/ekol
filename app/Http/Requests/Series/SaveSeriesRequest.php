<?php

namespace App\Http\Requests\Series;

use App\Http\Requests\SchoolRequest;
use App\Models\Series;
use App\Models\Subject;
use Closure;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A series, when added to a level and when edited. Its code and name
 * are unique within the level it belongs to.
 */
class SaveSeriesRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-structure');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $school = $this->school();
        $series = $this->route('series');
        $level = $series
            ? Series::where('school_id', $school->id)->where('id', $series)->value('level_id')
            : $this->input('level_id');
        $levelId = is_string($level) && Str::isUuid($level) ? $level : null;
        $ownSubject = Rule::in(Subject::forSeriesLevel($school, $levelId, $this->schoolContext()->year(), $this->string('stream')->toString())->pluck('id')->all());

        return [
            'code' => [
                'required', 'string', 'max:10',
                Rule::unique('series')->where('level_id', $levelId)->ignore($series),
            ],
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('series')->where('level_id', $levelId)->ignore($series),
            ],
            'stream' => ['required', Rule::in(Series::STREAMS)],
            'min_subjects' => ['required', 'integer', 'min:1', 'max:20'],
            'max_subjects' => ['required', 'integer', 'gte:min_subjects', 'max:20'],
            'level_ids' => ['present', 'array'],
            'level_ids.*' => ['string', Rule::exists('levels', 'id')->where('school_id', $school->id)->where('uses_series', true)],
            'core' => ['present', 'array'],
            'core.*' => ['string', 'distinct', $ownSubject],
            'electives' => ['present', 'array'],
            'electives.*' => ['string', 'distinct', $ownSubject],
        ];
    }

    /** @return list<Closure> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->any()) {
                return;
            }
            $subjectIds = array_unique([...$this->array('core'), ...$this->array('electives')]);
            foreach (array_keys($this->array('level_ids')) as $key) {
                $levelId = $this->string("level_ids.{$key}")->toString();
                $eligible = Subject::forSeriesLevel($this->school(), $levelId, $this->schoolContext()->year(), $this->string('stream')->toString())->pluck('id')->all();
                if (array_diff($subjectIds, $eligible) !== []) {
                    $validator->errors()->add('level_ids', __('Every selected level must offer all selected subjects in the current academic year.'));
                    break;
                }
            }
        }];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'core.*.in' => __('Choose a subject assigned to this level for the current academic year.'),
            'electives.*.in' => __('Choose a subject assigned to this level for the current academic year.'),
        ];
    }
}
