<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A request to change a published mark. The teacher asks, the
 * principal decides; the mark only changes on approval.
 *
 * @property string $id
 * @property string $school_id
 * @property string $mark_id
 * @property string $reference
 * @property string|null $old_score
 * @property string $new_score
 * @property string $reason
 * @property string $status
 * @property string|null $requested_by
 * @property string|null $decided_by
 * @property Carbon|null $decided_at
 * @property string|null $note
 * @property Carbon $created_at
 */
class MarkCorrection extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'mark_id',
        'reference',
        'old_score',
        'new_score',
        'reason',
        'status',
        'requested_by',
        'decided_by',
        'decided_at',
        'note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }

    /**
     * The next reference for a school, like C-014.
     */
    public static function nextReference(string $schoolId): string
    {
        $last = static::where('school_id', $schoolId)->pluck('reference')
            ->map(fn (string $reference) => (int) substr($reference, 2))
            ->max();

        return 'C-'.str_pad((string) (((int) $last) + 1), 3, '0', STR_PAD_LEFT);
    }

    /**
     * @return BelongsTo<Mark, $this>
     */
    public function mark(): BelongsTo
    {
        return $this->belongsTo(Mark::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
