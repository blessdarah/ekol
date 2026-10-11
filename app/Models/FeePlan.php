<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $school_id
 * @property string $level_id
 * @property string $academic_year_id
 * @property string $annual_amount
 * @property string $currency
 * @property bool $is_active
 */
class FeePlan extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'level_id',
        'academic_year_id',
        'annual_amount',
        'currency',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * Bring each level's plan in line with the year's fee items: its
     * annual amount is what a returning student pays. A level left
     * with no item loses its plan, unless students were billed on it.
     */
    public static function syncFor(School $school, AcademicYear $year): void
    {
        $amounts = FeeItemAmount::whereHas('item', fn (Builder $query) => $query->where('academic_year_id', $year->id))
            ->with('item')
            ->get()
            ->groupBy('level_id');

        foreach (static::where('school_id', $school->id)->where('academic_year_id', $year->id)->get() as $plan) {
            if (! $amounts->has($plan->level_id) && ! $plan->invoices()->exists()) {
                $plan->delete();
            }
        }

        foreach ($amounts as $levelId => $rows) {
            static::updateOrCreate(
                ['school_id' => $school->id, 'level_id' => $levelId, 'academic_year_id' => $year->id],
                [
                    'annual_amount' => number_format((float) $rows
                        ->filter(fn (FeeItemAmount $row) => ! $row->item?->new_students_only)
                        ->sum(fn (FeeItemAmount $row) => (float) $row->amount), 2, '.', ''),
                    'currency' => $school->currency,
                    'is_active' => true,
                ],
            );
        }
    }

    /**
     * What a student of this level is billed: every item with an
     * amount for the level, without those kept for new students when
     * the student is not new. A plan set before items existed bills
     * its one annual amount as school fees.
     *
     * @return list<array{fee_item_id: string|null, name: string, position: int, is_spread: bool, amount: string}>
     */
    public function lines(bool $newStudent): array
    {
        $amounts = FeeItemAmount::where('level_id', $this->level_id)
            ->whereHas('item', fn (Builder $query) => $query->where('academic_year_id', $this->academic_year_id))
            ->with('item')
            ->get();

        if ($amounts->isEmpty()) {
            return [['fee_item_id' => null, 'name' => FeeItem::TUITION, 'position' => 1, 'is_spread' => true, 'amount' => $this->annual_amount]];
        }

        $lines = [];

        foreach ($amounts->sortBy(fn (FeeItemAmount $row) => $row->item?->position) as $row) {
            $item = $row->item;

            if ($item && ($newStudent || ! $item->new_students_only)) {
                $lines[] = [
                    'fee_item_id' => $item->id,
                    'name' => $item->name,
                    'position' => $item->position,
                    'is_spread' => $item->is_spread,
                    'amount' => $row->amount,
                ];
            }
        }

        return $lines;
    }

    /**
     * Issue this plan's invoice to a student for the year.
     */
    public function billTo(Student $student, Term $term, ?string $issuedOn = null): Invoice
    {
        $lines = $this->lines($student->isNewIn($this->academic_year_id));
        $total = array_sum(array_map(fn (array $line) => (float) $line['amount'], $lines));

        return Invoice::issue($student, $term, $this, number_format($total, 2, '.', ''), $issuedOn, $lines);
    }

    /**
     * @return BelongsTo<AcademicYear, $this>
     */
    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /**
     * @return BelongsTo<Level, $this>
     */
    public function level(): BelongsTo
    {
        return $this->belongsTo(Level::class);
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
