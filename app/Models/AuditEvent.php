<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Polymorphic by design: one table instead of per-entity audit tables.
 * Written in the same transaction as the change; never updated or deleted.
 *
 * @property string $id
 * @property string $school_id
 * @property string|null $actor_id
 * @property string $entity
 * @property string $entity_id
 * @property string $action
 * @property array<string, mixed> $diff
 * @property Carbon $occurred_at
 */
class AuditEvent extends Model
{
    use BelongsToSchool, HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'school_id',
        'actor_id',
        'entity',
        'entity_id',
        'action',
        'diff',
        'occurred_at',
    ];

    /**
     * Record an explicit business action in the caller's transaction.
     *
     * @param  array<string, mixed>  $diff
     */
    public static function record(School $school, ?User $actor, string $entity, string $entityId, string $action, array $diff): self
    {
        return static::create([
            'school_id' => $school->id,
            'actor_id' => $actor?->id,
            'entity' => $entity,
            'entity_id' => $entityId,
            'action' => $action,
            'diff' => $diff,
        ]);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'diff' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
