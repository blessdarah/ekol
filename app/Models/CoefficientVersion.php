<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Append-only weight history. Rows are never updated or deleted.
 *
 * @property string $id
 * @property string $coefficient_id
 * @property int $version
 * @property string $sequence_coeff
 * @property string $exam_coeff
 * @property string $effective_term_id
 * @property string|null $changed_by
 * @property Carbon $changed_at
 * @property string $reason
 */
class CoefficientVersion extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'coefficient_id',
        'version',
        'sequence_coeff',
        'exam_coeff',
        'effective_term_id',
        'changed_by',
        'changed_at',
        'reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'changed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Coefficient, $this>
     */
    public function coefficient(): BelongsTo
    {
        return $this->belongsTo(Coefficient::class);
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function effectiveTerm(): BelongsTo
    {
        return $this->belongsTo(Term::class, 'effective_term_id');
    }
}
