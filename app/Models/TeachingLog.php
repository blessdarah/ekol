<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Syllabus-progress record: topic drives coverage reports.
 *
 * @property string $id
 * @property string $timetable_slot_id
 * @property string|null $staff_id
 * @property Carbon $date
 * @property string $topic
 * @property string|null $notes
 */
class TeachingLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'timetable_slot_id',
        'staff_id',
        'date',
        'topic',
        'started_at',
        'ended_at',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<TimetableSlot, $this>
     */
    public function timetableSlot(): BelongsTo
    {
        return $this->belongsTo(TimetableSlot::class);
    }
}
