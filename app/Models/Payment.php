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
 * @property string|null $receipt_no
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
        'receipt_no',
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
     * The next receipt number for a school and year, like RC-25-0388.
     */
    public static function nextReceipt(string $schoolId, \DateTimeInterface $receivedAt): string
    {
        $prefix = 'RC-'.$receivedAt->format('y').'-';

        $last = static::where('receipt_no', 'like', $prefix.'%')
            ->whereHas('invoice.student', fn ($query) => $query->withTrashed()->where('school_id', $schoolId))
            ->pluck('receipt_no')
            ->map(fn (?string $number) => (int) substr((string) $number, strlen($prefix)))
            ->max();

        return $prefix.str_pad((string) (((int) $last) + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
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
