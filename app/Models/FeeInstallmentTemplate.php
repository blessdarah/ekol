<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One slice of a school year's fee schedule. Percents across a year
 * must sum to 100 (validated app-side on save). Invoices materialize
 * per-invoice installments from these rows at issue time.
 *
 * @property string $id
 * @property string $school_id
 * @property string $academic_year_id
 * @property int $seq
 * @property string $percent
 * @property Carbon|null $due_on
 */
class FeeInstallmentTemplate extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'academic_year_id',
        'seq',
        'percent',
        'due_on',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<AcademicYear, $this>
     */
    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }
}
