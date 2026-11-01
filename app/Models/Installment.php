<?php

namespace App\Models;

use App\Enums\InstallmentStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $invoice_id
 * @property int $seq
 * @property string $label
 * @property string $amount
 * @property Carbon $due_on
 * @property InstallmentStatus $status
 */
class Installment extends Model
{
    use HasUuids;

    protected $fillable = [
        'invoice_id',
        'seq',
        'label',
        'amount',
        'due_on',
        'status',
    ];

    protected static function booted(): void
    {
        static::saved(function (Installment $record): void {
            Invoice::syncStatuses([$record->invoice_id, (string) $record->getRawOriginal('invoice_id')]);
        });
        static::deleted(function (Installment $record): void {
            Invoice::syncStatuses([$record->invoice_id]);
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_on' => 'date',
            'status' => InstallmentStatus::class,
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
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
