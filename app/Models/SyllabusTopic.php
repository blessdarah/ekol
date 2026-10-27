<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A topic a subject must cover at a level, with the term and weeks it
 * is suggested for. Kept from year to year; its sub-topics are what a
 * teacher places in the scheme.
 *
 * @property string $id
 * @property string $school_id
 * @property string $level_id
 * @property string $subject_id
 * @property int $position
 * @property string $name
 * @property int $term_sequence
 * @property int|null $week_from
 * @property int|null $week_to
 * @property int $periods
 */
class SyllabusTopic extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'level_id',
        'subject_id',
        'position',
        'name',
        'term_sequence',
        'week_from',
        'week_to',
        'periods',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'term_sequence' => 'integer',
            'week_from' => 'integer',
            'week_to' => 'integer',
            'periods' => 'integer',
        ];
    }

    /**
     * @return HasMany<SyllabusSubtopic, $this>
     */
    public function subtopics(): HasMany
    {
        return $this->hasMany(SyllabusSubtopic::class)->orderBy('position');
    }

    /**
     * @return BelongsTo<Subject, $this>
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * @return BelongsTo<Level, $this>
     */
    public function level(): BelongsTo
    {
        return $this->belongsTo(Level::class);
    }
}
