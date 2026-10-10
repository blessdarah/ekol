<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One exam paper: a subject sat by a whole level on a day, in a room,
 * watched by its invigilators.
 *
 * @property string $id
 * @property string $assessment_plan_id
 * @property string $level_id
 * @property string $subject_id
 * @property Carbon $held_on
 * @property string $starts_at
 * @property string $hours
 * @property string|null $room_id
 * @property list<string> $invigilator_ids
 */
class ExamPaper extends Model
{
    use HasUuids;

    protected $fillable = [
        'assessment_plan_id',
        'level_id',
        'subject_id',
        'held_on',
        'starts_at',
        'hours',
        'room_id',
        'invigilator_ids',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'held_on' => 'date',
            'invigilator_ids' => 'array',
        ];
    }

    /**
     * When the paper runs, as minutes from midnight: start and end.
     *
     * @return array{0: int, 1: int}
     */
    public function span(): array
    {
        [$hour, $minute] = array_map('intval', explode(':', $this->starts_at));
        $start = $hour * 60 + $minute;

        return [$start, $start + (int) round((float) $this->hours * 60)];
    }

    public function overlaps(self $other): bool
    {
        if (! $this->held_on->isSameDay($other->held_on)) {
            return false;
        }

        [$from, $to] = $this->span();
        [$otherFrom, $otherTo] = $other->span();

        return $from < $otherTo && $otherFrom < $to;
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
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }
}
