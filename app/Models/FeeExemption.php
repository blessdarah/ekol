<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An exemption or discount on one student's invoice. The amount is
 * fixed when it is granted; a percentage is kept only to show how it
 * was worked out. It lowers what is owed, never what was billed.
 *
 * @property string $id
 * @property string $invoice_id
 * @property string $kind
 * @property string|null $percent
 * @property string $amount
 * @property string $reason
 * @property string|null $granted_by
 * @property Carbon $created_at
 */
class FeeExemption extends Model
{
    use HasUuids;

    public const array KINDS = ['percent', 'amount'];

    protected $fillable = [
        'invoice_id',
        'kind',
        'percent',
        'amount',
        'reason',
        'granted_by',
    ];

    protected static function booted(): void
    {
        static::saved(function (FeeExemption $record): void {
            Invoice::syncStatuses([$record->invoice_id, (string) $record->getRawOriginal('invoice_id')]);
        });

        static::deleted(function (FeeExemption $record): void {
            Invoice::syncStatuses([$record->invoice_id]);
        });
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function granter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }
}
