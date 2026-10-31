<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property string $id
 * @property string $school_id
 * @property string $level_id
 * @property string $name
 * @property string $code
 * @property bool $is_open
 * @property string|null $stream
 * @property int|null $min_subjects
 * @property int|null $max_subjects
 */
class Series extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $table = 'series';

    protected $fillable = [
        'school_id',
        'level_id',
        'name',
        'code',
        'is_open',
        'stream',
        'min_subjects',
        'max_subjects',
    ];

    public const array STREAMS = ['science', 'arts', 'commercial'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_open' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Level, $this>
     */
    public function level(): BelongsTo
    {
        return $this->belongsTo(Level::class);
    }

    /**
     * Core subjects every student takes plus the elective pool; the
     * pivot `kind` tells them apart.
     *
     * @return BelongsToMany<Subject, $this>
     */
    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'series_subjects')
            ->withPivot('kind')
            ->withTimestamps()
            ->orderBy('name');
    }

    /**
     * @return HasMany<StudentSeries, $this>
     */
    public function studentSeries(): HasMany
    {
        return $this->hasMany(StudentSeries::class);
    }
}
