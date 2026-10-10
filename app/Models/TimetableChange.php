<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A short-lived change to the live timetable: a cover, a swap or a
 * room change, for a day or a week. It never makes a new version.
 *
 * @property string $id
 * @property string $school_id
 * @property string $timetable_version_id
 * @property string $kind
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property string $timetable_slot_id
 * @property string|null $other_slot_id
 * @property string|null $staff_id
 * @property string|null $room_id
 * @property string $summary
 * @property string|null $created_by
 * @property Carbon $created_at
 */
class TimetableChange extends Model
{
    use BelongsToSchool, HasUuids;

    public const array KINDS = ['cover', 'swap', 'room'];

    protected $fillable = [
        'school_id',
        'timetable_version_id',
        'kind',
        'starts_on',
        'ends_on',
        'timetable_slot_id',
        'other_slot_id',
        'staff_id',
        'room_id',
        'summary',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
