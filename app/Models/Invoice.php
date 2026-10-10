<?php

namespace App\Models;

use App\Enums\InstallmentStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * amount_due is copied from the fee plan, never looked up. Balance is
 * always amount_due, less any exemption, minus payments.
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
     * @return HasOne<FeeExemption, $this>
     */
    public function exemption(): HasOne
    {
        return $this->hasOne(FeeExemption::class);
    }

    /**
     * What an exemption or discount takes off the bill.
     */
    public function exempted(): float
    {
        return min((float) $this->amount_due, (float) ($this->exemption->amount ?? 0));
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
        ?\DateTimeInterface $receivedAt = null,
    ): Payment {
        return DB::transaction(function () use ($amount, $method, $receivedBy, $installmentId, $reference, $receivedAt) {
            $receivedAt ??= now();
            $schoolId = (string) $this->student()->withTrashed()->value('school_id');
            $targetId = $installmentId ?? $this->oldestUnpaidInstallmentId();

            $payment = $this->payments()->create([
                'installment_id' => $targetId,
                'amount' => $amount,
                'method' => $method,
                'reference' => $reference,
                'received_at' => $receivedAt,
                'received_by' => $receivedBy?->id,
                'receipt_no' => Payment::nextReceipt($schoolId, $receivedAt),
            ]);

            $this->unsetRelation('payments')->syncStatus();

            return $payment;
        });
    }

    /**
     * The invoice as the bursar reads it: each installment with what
     * has been paid towards it. Payments fill installments in order,
     * oldest first, whatever installment a receipt was written against.
     *
     * @return array{gross: float, exempted: float, due: float, paid: float, balance: float, overdue: float, installments: list<array{seq: int, label: string, due_on: string, amount: float, paid: float, state: string, days_late: int}>}
     */
    public function ledger(): array
    {
        $gross = (float) $this->amount_due;
        $exempted = $this->exempted();
        $due = $gross - $exempted;
        $paid = (float) $this->payments->sum(fn (Payment $payment) => (float) $payment->amount);
        $left = $paid;
        $overdue = 0.0;
        $rows = [];

        $installments = $this->installments->sortBy('seq')->values();
        $parts = $installments->isEmpty()
            ? [['seq' => 1, 'label' => 'Annual fees', 'amount' => $gross, 'due_on' => $this->issued_on]]
            : $installments->map(fn (Installment $installment) => [
                'seq' => $installment->seq,
                'label' => static::ordinal($installment->seq).' installment',
                'amount' => (float) $installment->amount,
                'due_on' => $installment->due_on,
            ])->all();

        if ($exempted > 0 && $gross > 0) {
            $spread = 0.0;
            $final = count($parts) - 1;

            foreach ($parts as $position => $part) {
                $parts[$position]['amount'] = $position === $final
                    ? round($due - $spread, 2)
                    : round($part['amount'] * $due / $gross);
                $spread += $parts[$position]['amount'];
            }
        }

        foreach ($parts as $part) {
            $covered = min($left, $part['amount']);
            $left -= $covered;
            $short = $part['amount'] - $covered;
            $late = $short > 0 && $part['due_on']->lt(today());

            if ($late) {
                $overdue += $short;
            }

            $rows[] = [
                'seq' => $part['seq'],
                'label' => $part['label'],
                'due_on' => $part['due_on']->toDateString(),
                'amount' => $part['amount'],
                'paid' => $covered,
                'state' => match (true) {
                    $short <= 0 => 'paid',
                    $late => 'overdue',
                    $covered > 0 => 'partial',
                    default => 'upcoming',
                },
                'days_late' => $late ? (int) $part['due_on']->diffInDays(today()) : 0,
            ];
        }

        return [
            'gross' => $gross,
            'exempted' => $exempted,
            'due' => $due,
            'paid' => $paid,
            'balance' => max(0.0, $due - $paid),
            'overdue' => $overdue,
            'installments' => $rows,
        ];
    }

    /**
     * Bring the stored status in line with the payments and today's date.
     */
    public function syncStatus(): static
    {
        $ledger = $this->ledger();
        $status = match (true) {
            $ledger['balance'] <= 0 => InvoiceStatus::Paid,
            $ledger['overdue'] > 0 => InvoiceStatus::Overdue,
            $ledger['paid'] > 0 => InvoiceStatus::Partial,
            default => InvoiceStatus::Pending,
        };

        if ($this->status !== $status) {
            $this->update(['status' => $status]);
        }

        return $this;
    }

    public static function ordinal(int $number): string
    {
        $suffix = match (true) {
            $number % 100 >= 11 && $number % 100 <= 13 => 'th',
            $number % 10 === 1 => 'st',
            $number % 10 === 2 => 'nd',
            $number % 10 === 3 => 'rd',
            default => 'th',
        };

        return "{$number}{$suffix}";
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
        return (float) $this->amount_due - $this->exempted() - $this->paidTotal();
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
