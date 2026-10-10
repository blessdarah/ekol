<?php

namespace App\Models;

use App\Enums\SchoolCycle;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $school_id
 * @property string $name
 * @property string|null $code
 * @property int $ordinal
 * @property SchoolCycle $cycle
 * @property string|null $subsystem
 * @property bool $uses_series
 * @property Carbon|null $deleted_at
 */
class Level extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $fillable = [
        'school_id',
        'name',
        'code',
        'ordinal',
        'cycle',
        'subsystem',
        'uses_series',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cycle' => SchoolCycle::class,
            'uses_series' => 'boolean',
        ];
    }

    /**
     * @return HasMany<SchoolClass, $this>
     */
    public function schoolClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class);
    }

    /**
     * @return HasMany<Series, $this>
     */
    public function series(): HasMany
    {
        return $this->hasMany(Series::class);
    }

    /**
     * @return HasMany<Coefficient, $this>
     */
    public function coefficients(): HasMany
    {
        return $this->hasMany(Coefficient::class);
    }

    /**
     * @return HasMany<FeePlan, $this>
     */
    public function feePlans(): HasMany
    {
        return $this->hasMany(FeePlan::class);
    }
}
