<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One part of a syllabus topic, and the periods it is expected to take.
 *
 * @property string $id
 * @property string $syllabus_topic_id
 * @property int $position
 * @property string $name
 * @property int $periods
 */
class SyllabusSubtopic extends Model
{
    use HasUuids;

    protected $fillable = [
        'syllabus_topic_id',
        'position',
        'name',
        'periods',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'periods' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<SyllabusTopic, $this>
     */
    public function topic(): BelongsTo
    {
        return $this->belongsTo(SyllabusTopic::class, 'syllabus_topic_id');
    }
}
