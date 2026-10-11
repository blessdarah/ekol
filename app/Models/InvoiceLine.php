<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One item on a student's bill, copied from the fee structure the day
 * the invoice was issued. Later changes to the structure never reach it.
 *
 * @property string $id
 * @property string $invoice_id
 * @property string|null $fee_item_id
 * @property string $name
 * @property int $position
 * @property bool $is_spread
 * @property string $amount
 */
class InvoiceLine extends Model
{
    use HasUuids;

    protected $fillable = [
        'invoice_id',
        'fee_item_id',
        'name',
        'position',
        'is_spread',
        'amount',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_spread' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<FeeItem, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(FeeItem::class, 'fee_item_id');
    }
}
