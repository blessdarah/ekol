<?php

namespace App\Models;

use App\Enums\InstallmentStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * amount_due is copied from the fee plan, never looked up. Balance is
 * always amount_due minus payments.
 *
 * @property string $id
 * @property string $student_id
 * @property string $term_id
 * @property string $fee_plan_id
 * @property string $amount_due
 * @property Carbon $issued_on
 * @property InvoiceStatus $status
 */
class Invoice extends Model
{
    use HasUuids;

    protected $fillable = [
        'student_id',
        'term_id',
        'fee_plan_id',
        'amount_due',
        'issued_on',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'issued_on' => 'date',
            'status' => InvoiceStatus::class,
        ];
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * @return BelongsTo<FeePlan, $this>
     */
    public function feePlan(): BelongsTo
    {
        return $this->belongsTo(FeePlan::class);
    }

    /**
     * @return HasMany<Installment, $this>
     */
    public function installments(): HasMany
    {
        return $this->hasMany(Installment::class);
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Issue an invoice, materializing installments from the school year's
     * template as amount_due × percent, due on the template's date (or
     * the issue date when none is set). Cents lost to rounding land on
     * the last row so the parts always sum to the whole.
     */
    public static function issue(
        Student $student,
        Term $term,
        FeePlan $feePlan,
        string $amountDue,
        ?string $issuedOn = null,
    ): self {
        return DB::transaction(function () use ($student, $term, $feePlan, $amountDue, $issuedOn) {
            $invoice = static::create([
                'student_id' => $student->id,
                'term_id' => $term->id,
                'fee_plan_id' => $feePlan->id,
                'amount_due' => $amountDue,
                'issued_on' => $issuedOn ?? today()->toDateString(),
            ]);

            $templates = FeeInstallmentTemplate::where('school_id', $student->school_id)
                ->where('academic_year_id', $term->academic_year_id)
                ->orderBy('seq')
                ->get();

            $dueCents = (int) round((float) $amountDue * 100);
            $madeCents = 0;

            foreach ($templates as $index => $template) {
                $last = $index === $templates->count() - 1;
                $cents = $last
                    ? $dueCents - $madeCents
                    : (int) round($dueCents * (float) $template->percent / 100);
                $madeCents += $cents;

                $invoice->installments()->create([
                    'seq' => $template->seq,
                    'label' => "Installment {$template->seq}",
                    'amount' => number_format($cents / 100, 2, '.', ''),
                    'due_on' => $template->due_on ?? $invoice->issued_on,
                    'status' => InstallmentStatus::Pending,
                ]);
            }

            return $invoice;
        });
    }

    /**
     * Record a cash-office payment. Without an explicit installment the
     * payment fills the oldest unpaid installment first; when everything
     * is covered it lands as a lump-sum top-up (null installment).
     */
    public function recordPayment(
        string $amount,
        PaymentMethod|string $method,
        ?User $receivedBy = null,
        ?string $installmentId = null,
        ?string $reference = null,
    ): Payment {
        return DB::transaction(function () use ($amount, $method, $receivedBy, $installmentId, $reference) {
            $targetId = $installmentId ?? $this->oldestUnpaidInstallmentId();

            $payment = $this->payments()->create([
                'installment_id' => $targetId,
                'amount' => $amount,
                'method' => $method,
                'reference' => $reference,
                'received_at' => now(),
                'received_by' => $receivedBy?->id,
            ]);

            $paid = (float) $this->payments()->sum('amount');
            $due = (float) $this->amount_due;

            $this->update([
                'status' => $paid >= $due ? InvoiceStatus::Paid
                    : ($paid > 0 ? InvoiceStatus::Partial : InvoiceStatus::Pending),
            ]);

            return $payment;
        });
    }

    /**
     * Total received across all payments.
     */
    public function paidTotal(): float
    {
        return (float) $this->payments()->sum('amount');
    }

    /**
     * Remaining balance. Never stored, always derived.
     */
    public function outstanding(): float
    {
        return (float) $this->amount_due - $this->paidTotal();
    }

    protected function oldestUnpaidInstallmentId(): ?string
    {
        $received = $this->payments()
            ->selectRaw('installment_id, SUM(amount) as total')
            ->whereNotNull('installment_id')
            ->groupBy('installment_id')
            ->pluck('total', 'installment_id');

        $oldest = $this->installments()->orderBy('seq')->get()
            ->first(fn ($installment) => ((float) ($received[$installment->id] ?? 0)) < (float) $installment->amount);

        return $oldest?->id;
    }
}
