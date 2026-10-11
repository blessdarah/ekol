<?php

namespace App\Http\Requests\Series;

use App\Http\Requests\SchoolRequest;
use App\Models\Series;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * A series, when added to a level and when edited. Its code and name
 * are unique within the level it belongs to.
 */
class SaveSeriesRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesStructure();
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
        $ownSubject = Rule::exists('subjects', 'id')->where('school_id', $school->id);

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
            'level_ids.*' => [Rule::exists('levels', 'id')->where('school_id', $school->id)->where('uses_series', true)],
            'core' => ['present', 'array'],
            'core.*' => ['distinct', $ownSubject],
            'electives' => ['present', 'array'],
            'electives.*' => ['distinct', $ownSubject],
        ];
    }
}
