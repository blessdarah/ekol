<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * @property string $id
 * @property string $school_id
 * @property string $user_id
 * @property Carbon $started_at
 * @property Carbon $expires_at
 * @property Carbon|null $ended_at
 */
class SchoolVisit extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['school_id', 'user_id', 'started_at', 'expires_at', 'ended_at'];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'expires_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    /** @return BelongsTo<School, $this> */
    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class)->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function finish(): void
    {
        DB::transaction(function () {
            $visit = static::whereKey($this->id)->lockForUpdate()->firstOrFail();
            if ($visit->ended_at) {
                return;
            }
            $visit->update(['ended_at' => now()->min($visit->expires_at)]);
            $visit->record('visit.ended');
        });
    }

    public function record(string $action): void
    {
        AuditEvent::create([
            'school_id' => $this->school_id, 'actor_id' => $this->user_id,
            'entity' => 'school_visit', 'entity_id' => $this->id, 'action' => $action,
            'diff' => ['by' => 'Campus super-admin'], 'occurred_at' => $this->ended_at ?? $this->started_at,
        ]);
    }
}
