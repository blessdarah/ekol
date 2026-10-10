<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Append-only receipt. A null installment_id is a lump-sum top-up
 * against the whole invoice. Rows are never updated.
 *
 * @property string $id
 * @property string $invoice_id
 * @property string|null $installment_id
 * @property string $amount
 * @property PaymentMethod $method
 * @property string|null $reference
 * @property Carbon $received_at
 * @property string|null $received_by
 */
class Payment extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'invoice_id',
        'installment_id',
        'amount',
        'method',
        'reference',
        'received_at',
        'received_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'method' => PaymentMethod::class,
            'received_at' => 'datetime',
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
     * @return BelongsTo<Installment, $this>
     */
    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class);
    }
}
