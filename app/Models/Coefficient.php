<?php

namespace App\Models;

use App\Enums\CoefficientStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One subject×level matrix cell. Weight history lives append-only on versions.
 *
 * @property string $id
 * @property string $subject_id
 * @property string $level_id
 * @property string $sequence_coeff
 * @property string $exam_coeff
 * @property string|null $current_version_id
 * @property CoefficientStatus $status
 */
class Coefficient extends Model
{
    use HasUuids;

    protected $fillable = [
        'subject_id',
        'level_id',
        'sequence_coeff',
        'exam_coeff',
        'current_version_id',
        'status',
        'last_reviewed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CoefficientStatus::class,
            'last_reviewed_at' => 'datetime',
        ];
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

    /**
     * @return BelongsTo<CoefficientVersion, $this>
     */
    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(CoefficientVersion::class, 'current_version_id');
    }

    /**
     * @return HasMany<CoefficientVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(CoefficientVersion::class);
    }
}
