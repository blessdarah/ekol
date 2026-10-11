<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What one level pays for a fee item. A level with no row does not
 * pay the item at all.
 *
 * @property string $id
 * @property string $fee_item_id
 * @property string $level_id
 * @property string $amount
 */
class FeeItemAmount extends Model
{
    use HasUuids;

    protected $fillable = [
        'fee_item_id',
        'level_id',
        'amount',
    ];

    /**
     * @return BelongsTo<FeeItem, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(FeeItem::class, 'fee_item_id');
    }

    /**
     * @return BelongsTo<Level, $this>
     */
    public function level(): BelongsTo
    {
        return $this->belongsTo(Level::class);
    }
}
