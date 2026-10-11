<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One thing a school charges for in a year: school fees, the PTA
 * contribution, registration. Each has its own amount per level. Its
 * position is the order parents' money is shared out in.
 *
 * @property string $id
 * @property string $school_id
 * @property string $academic_year_id
 * @property string $name
 * @property int $position
 * @property bool $is_spread
 * @property bool $new_students_only
 */
class FeeItem extends Model
{
    use BelongsToSchool, HasUuids;

    /**
     * What a bill is called when it was issued before items existed.
     */
    public const string TUITION = 'School fees';

    protected $fillable = [
        'school_id',
        'academic_year_id',
        'name',
        'position',
        'is_spread',
        'new_students_only',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_spread' => 'boolean',
            'new_students_only' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<AcademicYear, $this>
     */
    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /**
     * @return HasMany<FeeItemAmount, $this>
     */
    public function amounts(): HasMany
    {
        return $this->hasMany(FeeItemAmount::class);
    }
}
