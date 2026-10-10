<?php

namespace App\Models;

use App\Enums\AcademicYearStatus;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $school_id
 * @property string $label
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property AcademicYearStatus $status
 * @property Carbon $created_at
 * @property Carbon|null $enrolment_confirmed_at
 */
class AcademicYear extends Model
{
    use BelongsToSchool, HasUuids;

    public $timestamps = false;

    protected $table = 'academic_years';

    protected $fillable = [
        'school_id',
        'label',
        'starts_on',
        'ends_on',
        'status',
        'created_at',
        'enrolment_confirmed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'status' => AcademicYearStatus::class,
            'created_at' => 'datetime',
            'enrolment_confirmed_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Term, $this>
     */
    public function terms(): HasMany
    {
        return $this->hasMany(Term::class);
    }

    /**
     * @return HasMany<FeePlan, $this>
     */
    public function feePlans(): HasMany
    {
        return $this->hasMany(FeePlan::class);
    }

    /**
     * @return HasMany<SchoolClass, $this>
     */
    public function schoolClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class);
    }

    /**
     * @return HasMany<Enrolment, $this>
     */
    public function enrolments(): HasMany
    {
        return $this->hasMany(Enrolment::class);
    }
}
