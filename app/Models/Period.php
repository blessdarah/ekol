<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Bell-schedule slot scoped per school (tenant-scoped divergence from ERD global).
 *
 * @property string $id
 * @property string $school_id
 * @property string $label
 * @property int $ordinal
 * @property string $starts_at
 * @property string $ends_at
 * @property bool $is_break
 * @property int|null $custom_minutes
 */
class Period extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $fillable = [
        'school_id',
        'label',
        'ordinal',
        'starts_at',
        'ends_at',
        'is_break',
        'custom_minutes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_break' => 'boolean',
            'custom_minutes' => 'integer',
        ];
    }

    /**
     * How long the period lasts: its own length when it has one, else
     * the school's default lesson length.
     */
    public function minutesWith(int $defaultMinutes): int
    {
        return $this->custom_minutes ?? $defaultMinutes;
    }

    /**
     * @return HasMany<TimetableSlot, $this>
     */
    public function timetableSlots(): HasMany
    {
        return $this->hasMany(TimetableSlot::class);
    }
}
