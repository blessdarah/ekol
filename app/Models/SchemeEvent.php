<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One line of a scheme's history: opened, submitted, approved, sent
 * back with a note, a note from the school, closed.
 *
 * @property string $id
 * @property string $scheme_id
 * @property string|null $user_id
 * @property string $action
 * @property string|null $note
 * @property Carbon $created_at
 */
class SchemeEvent extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = [
        'scheme_id',
        'user_id',
        'action',
        'note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
