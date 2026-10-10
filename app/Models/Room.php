<?php

namespace App\Models;

use App\Enums\RoomKind;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property string $id
 * @property string $school_id
 * @property string $code
 * @property string $name
 * @property int $capacity
 * @property RoomKind $kind
 */
class Room extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $fillable = [
        'school_id',
        'code',
        'name',
        'capacity',
        'kind',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => RoomKind::class,
        ];
    }

    /**
     * @return HasMany<TimetableSlot, $this>
     */
    public function timetableSlots(): HasMany
    {
        return $this->hasMany(TimetableSlot::class);
    }
}
