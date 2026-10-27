<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A sub-topic in a scheme: the week it is planned for (none yet when
 * it is still to place), the periods it takes, and when it was taught.
 *
 * @property string $id
 * @property string $scheme_id
 * @property string|null $syllabus_topic_id
 * @property string|null $syllabus_subtopic_id
 * @property int $position
 * @property string $topic
 * @property string|null $name
 * @property int|null $week
 * @property int $periods
 * @property bool $added_by_teacher
 * @property bool $carried_over
 * @property Carbon|null $taught_on
 */
class SchemeItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'scheme_id',
        'syllabus_topic_id',
        'syllabus_subtopic_id',
        'position',
        'topic',
        'name',
        'week',
        'periods',
        'added_by_teacher',
        'carried_over',
        'taught_on',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'week' => 'integer',
            'periods' => 'integer',
            'added_by_teacher' => 'boolean',
            'carried_over' => 'boolean',
            'taught_on' => 'date',
        ];
    }

    /**
     * "6.2 The chain rule", or the topic itself when it has no parts.
     */
    public function label(): string
    {
        return $this->name ?? $this->topic;
    }

    /**
     * @return BelongsTo<Scheme, $this>
     */
    public function scheme(): BelongsTo
    {
        return $this->belongsTo(Scheme::class);
    }
}
