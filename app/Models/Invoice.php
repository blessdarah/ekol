<?php

namespace App\Models;

use App\Enums\InstallmentStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Models\Concerns\BelongsToSchool;
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
 * @property string|null $school_id
 * @property string $student_id
 * @property string $term_id
 * @property string $fee_plan_id
 * @property string $amount_due
 * @property Carbon $issued_on
 * @property InvoiceStatus $status
 */
class Invoice extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'student_id',
        'term_id',
        'fee_plan_id',
        'amount_due',
        'issued_on',
        'status',
    ];

    /**
     * An invoice belongs to its student's school, wherever it is issued.
     */
    protected static function booted(): void
    {
        static::creating(function (Invoice $invoice): void {
            $invoice->school_id ??= Student::withoutGlobalScopes()->whereKey($invoice->student_id)->value('school_id');
        });
    }

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
     * @return HasMany<InvoiceLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(InvoiceLine::class);
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
    public function exemptedMinor(): int
    {
        return min(Money::units($this->amount_due), Money::units((string) ($this->exemption->amount ?? 0)));
    }

    public function exempted(): float
    {
        return Money::number($this->exemptedMinor());
    }

    /**
     * Issue an invoice with the lines it is billed for, and materialize
     * its installments from the school year's template, due on the
     * template's date (or the issue date when none is set). Without
     * lines the whole amount is billed as school fees.
     *
     * @param  list<array{fee_item_id?: string|null, name: string, position: int, is_spread: bool, amount: string}>|null  $lines
     */
    public static function issue(
        Student $student,
        Term $term,
        FeePlan $feePlan,
        string $amountDue,
        ?string $issuedOn = null,
        ?array $lines = null,
    ): self {
        return DB::transaction(function () use ($student, $term, $feePlan, $amountDue, $issuedOn, $lines) {
            $lines ??= [['name' => FeeItem::TUITION, 'position' => 1, 'is_spread' => true, 'amount' => $amountDue]];

            $invoice = static::create([
                'student_id' => $student->id,
                'term_id' => $term->id,
                'fee_plan_id' => $feePlan->id,
                'amount_due' => $amountDue,
                'issued_on' => $issuedOn ?? today()->toDateString(),
            ]);

            foreach ($lines as $line) {
                $invoice->lines()->create($line);
            }

            $templates = FeeInstallmentTemplate::where('school_id', $student->school_id)
                ->where('academic_year_id', $term->academic_year_id)
                ->orderBy('seq')
                ->get();

            foreach (static::schedule($lines, array_values($templates->map(fn (FeeInstallmentTemplate $template) => (string) $template->percent)->all())) as $index => $cents) {
                $template = $templates[$index];

                $invoice->installments()->create([
                    'seq' => $template->seq,
                    'label' => "Installment {$template->seq}",
                    'amount' => Money::decimal($cents),
                    'due_on' => $template->due_on ?? $invoice->issued_on,
                    'status' => InstallmentStatus::Pending,
                ]);
            }

            return $invoice;
        });
    }

    /**
     * Share a bill out over installments, in cents. Lines that are
     * spread follow each installment's percent; lines paid up front
     * land whole on the first. Cents lost to rounding go to the last
     * installment so the parts always sum to the whole.
     *
     * @param  array<int, array{is_spread: bool, amount: string|int|float, ...}>  $lines
     * @param  list<string|int|float>  $percents
     * @return list<int>
     */
    public static function schedule(array $lines, array $percents): array
    {
        $spread = 0;
        $upfront = 0;

        foreach ($lines as $line) {
            $units = Money::units((string) $line['amount']);
            $line['is_spread'] ? $spread += $units : $upfront += $units;
        }

        $parts = Money::allocate($spread, array_map(fn ($percent) => Money::units((string) $percent), $percents));

        if ($parts !== []) {
            $parts[0] += $upfront;
        }

        return $parts;
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

            $this->unsetRelation('payments')->refresh();

            return $payment;
        });
    }

    /**
     * Major-unit page values derived from the integer ledger.
     *
     * @return array{gross: float, exempted: float, due: float, paid: float, balance: float, overdue: float, installments: list<array{seq: int, label: string, due_on: string, amount: float, paid: float, state: string, days_late: int}>, items: list<array{name: string, upfront: bool, billed: float, amount: float, paid: float, balance: float}>}
     */
    public function ledger(): array
    {
        $ledger = $this->ledgerMinor();

        return [
            'gross' => Money::number($ledger['gross']),
            'exempted' => Money::number($ledger['exempted']),
            'due' => Money::number($ledger['due']),
            'paid' => Money::number($ledger['paid']),
            'balance' => Money::number($ledger['balance']),
            'overdue' => Money::number($ledger['overdue']),
            'installments' => array_map(fn (array $part) => [
                ...$part, 'amount' => Money::number($part['amount']), 'paid' => Money::number($part['paid']),
            ], $ledger['installments']),
            'items' => array_map(fn (array $item) => [
                ...$item, 'billed' => Money::number($item['billed']), 'amount' => Money::number($item['amount']),
                'paid' => Money::number($item['paid']), 'balance' => Money::number($item['balance']),
            ], $ledger['items']),
        ];
    }

    /**
     * The invoice as the bursar reads it: each installment with what
     * has been paid towards it, and each item on the bill with what
     * has gone to it. Payments fill installments in order, oldest
     * first, and inside an installment the items in their set order,
     * whatever installment a receipt was written against.
     *
     * @return array{gross: int, exempted: int, due: int, paid: int, balance: int, overdue: int, installments: list<array{seq: int, label: string, due_on: string, amount: int, paid: int, state: string, days_late: int}>, items: list<array{name: string, upfront: bool, billed: int, amount: int, paid: int, balance: int}>}
     */
    public function ledgerMinor(): array
    {
        $gross = Money::units($this->amount_due);
        $exempted = $this->exemptedMinor();
        $due = $gross - $exempted;
        $paid = Money::sum($this->payments->pluck('amount'));
        $lines = $this->billed();
        $parts = $this->parts();
        $cells = $this->cells($parts, $lines);
        $poured = $this->pour($cells, $paid);
        $overdue = 0;
        $rows = [];

        foreach ($parts as $index => $part) {
            $covered = array_sum($poured[$index]);
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

        $items = [];

        foreach ($lines as $key => $line) {
            $amount = array_sum(array_column($cells, $key));
            $covered = array_sum(array_column($poured, $key));

            $items[] = [
                'name' => $line['name'],
                'upfront' => ! $line['is_spread'],
                'billed' => $line['amount'],
                'amount' => $amount,
                'paid' => $covered,
                'balance' => max(0, $amount - $covered),
            ];
        }

        return [
            'gross' => $gross,
            'exempted' => $exempted,
            'due' => $due,
            'paid' => $paid,
            'balance' => max(0, $due - $paid),
            'overdue' => $overdue,
            'installments' => $rows,
            'items' => $items,
        ];
    }

    /**
     * How one payment was shared between the items on the bill: what
     * each item had received after it, less what it had before.
     *
     * @return list<array{name: string, amount: float}>
     */
    public function split(Payment $payment): array
    {
        $lines = $this->billed();
        $cells = $this->cells($this->parts(), $lines);
        $before = Money::sum($this->payments
            ->filter(fn (Payment $other) => $other->id !== $payment->id
                && [$other->received_at, $other->receipt_no] < [$payment->received_at, $payment->receipt_no])
            ->pluck('amount'));
        $earlier = $this->pour($cells, $before);
        $after = $this->pour($cells, $before + Money::units($payment->amount));
        $shares = [];

        foreach ($lines as $key => $line) {
            $cents = array_sum(array_column($after, $key)) - array_sum(array_column($earlier, $key));

            if ($cents > 0) {
                $shares[] = ['name' => $line['name'], 'amount' => Money::number($cents)];
            }
        }

        return $shares;
    }

    /**
     * The items on the bill, in the order money is shared out. An
     * invoice from before items existed is one line of school fees.
     *
     * @return list<array{name: string, is_spread: bool, amount: int}>
     */
    protected function billed(): array
    {
        if ($this->lines->isEmpty()) {
            return [['name' => FeeItem::TUITION, 'is_spread' => true, 'amount' => Money::units($this->amount_due)]];
        }

        return array_values($this->lines->sortBy('position')->map(fn (InvoiceLine $line) => [
            'name' => $line->name,
            'is_spread' => $line->is_spread,
            'amount' => Money::units($line->amount),
        ])->all());
    }

    /**
     * The installments as they are owed: what each was billed, and
     * what it comes to once any exemption is spread across them.
     *
     * @return list<array{seq: int, label: string, gross: int, amount: int, due_on: Carbon}>
     */
    protected function parts(): array
    {
        $gross = Money::units($this->amount_due);
        $due = $gross - $this->exemptedMinor();
        $installments = $this->installments->sortBy('seq')->values();
        $parts = $installments->isEmpty()
            ? [['seq' => 1, 'label' => __('Annual fees'), 'gross' => $gross, 'amount' => $gross, 'due_on' => $this->issued_on]]
            : array_values($installments->map(fn (Installment $installment) => [
                'seq' => $installment->seq,
                'label' => __(':ordinal installment', ['ordinal' => static::ordinal($installment->seq, true)]),
                'gross' => Money::units($installment->amount),
                'amount' => Money::units($installment->amount),
                'due_on' => $installment->due_on,
            ])->all());

        if ($due < $gross && $gross > 0) {
            $allocated = Money::allocate($due, array_column($parts, 'gross'));

            foreach ($parts as $position => $part) {
                $parts[$position]['amount'] = $allocated[$position];
            }
        }

        return $parts;
    }

    /**
     * What each installment holds of each item, in cents: a row per
     * installment, a column per line. Up-front lines sit whole in the
     * first installment; the rest of every installment is shared
     * between the spread lines by what they still have to place. An
     * exemption shrinks every cell of an installment alike.
     *
     * @param  list<array{gross: int, amount: int, ...}>  $parts
     * @param  list<array{is_spread: bool, amount: int, ...}>  $lines
     * @return array<int, array<int, int>>
     */
    protected function cells(array $parts, array $lines): array
    {
        $left = array_map(fn (array $line) => $line['amount'], $lines);
        $final = count($parts) - 1;
        $cells = [];

        foreach ($parts as $index => $part) {
            $room = $part['gross'];
            $row = array_fill(0, count($lines), 0);

            if ($index === $final) {
                $row = $left;
            } else {
                foreach ($lines as $key => $line) {
                    if ($index === 0 && ! $line['is_spread']) {
                        $row[$key] = min($left[$key], $room);
                        $room -= $row[$key];
                    }
                }

                $spread = array_keys(array_filter($lines, fn (array $line) => $line['is_spread']));
                $allocated = Money::allocate($room, array_map(fn (int $key) => $left[$key], $spread));

                foreach ($spread as $place => $key) {
                    $row[$key] = min($allocated[$place], $left[$key], $room);
                    $room -= $row[$key];
                }
            }

            foreach ($row as $key => $cents) {
                $left[$key] -= $cents;
            }

            $cells[] = $this->shrink($row, $part['amount']);
        }

        return $cells;
    }

    /**
     * Scale a row of cents down to a smaller total, the last filled
     * cell taking what rounding leaves.
     *
     * @param  array<int, int>  $row
     * @return array<int, int>
     */
    protected function shrink(array $row, int $total): array
    {
        $whole = array_sum($row);

        if ($whole <= 0 || $total >= $whole) {
            return $row;
        }

        $allocated = Money::allocate($total, array_values($row));
        $row = array_combine(array_keys($row), $allocated);

        return $row;
    }

    /**
     * Pour money over the cells in order and say how much each took.
     *
     * @param  array<int, array<int, int>>  $cells
     * @return array<int, array<int, int>>
     */
    protected function pour(array $cells, int $cents): array
    {
        foreach ($cells as $index => $row) {
            foreach ($row as $key => $room) {
                $cells[$index][$key] = min($cents, $room);
                $cents -= $cells[$index][$key];
            }
        }

        return $cells;
    }

    /**
     * Reconcile records affected by a payment or exemption mutation.
     *
     * @param  array<int, string|null>  $invoiceIds
     */
    public static function syncStatuses(array $invoiceIds): void
    {
        static::withoutGlobalScope('school')
            ->whereKey(array_values(array_unique(array_filter($invoiceIds))))
            ->with(['payments' => fn ($query) => $query->withoutGlobalScope('school'), 'exemption', 'installments', 'lines'])
            ->each(fn (Invoice $invoice) => $invoice->syncStatus());
    }

    /**
     * Bring the stored status in line with the payments and today's date.
     */
    public function syncStatus(): static
    {
        $ledger = $this->ledgerMinor();
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

    /**
     * "1st", "2nd"; in French "1er" or "1re", then "2e".
     */
    public static function ordinal(int $number, bool $feminine = false): string
    {
        if (app()->getLocale() === 'fr') {
            return $number === 1 ? ($feminine ? '1re' : '1er') : "{$number}e";
        }

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
        return Money::number(Money::sum($this->payments()->pluck('amount')));
    }

    /**
     * Remaining balance. Never stored, always derived.
     */
    public function outstanding(): float
    {
        return Money::number($this->ledgerMinor()['balance']);
    }

    protected function oldestUnpaidInstallmentId(): ?string
    {
        $next = collect($this->ledgerMinor()['installments'])->first(fn (array $part) => $part['state'] !== 'paid');

        return $next ? $this->installments->firstWhere('seq', $next['seq'])?->id : null;
    }
}
