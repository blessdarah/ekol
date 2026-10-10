<?php

namespace App\Models;

use App\Enums\Gender;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Read-only record in this system: no login, no credentials.
 * One row covers the student's whole life; the class for a given
 * year lives on enrolments.
 *
 * @property string $id
 * @property string $school_id
 * @property string $admission_no
 * @property string $full_name
 * @property Gender $gender
 * @property Carbon $date_of_birth
 * @property string $guardian_name
 * @property string $guardian_phone
 * @property Carbon $admitted_on
 */
class Student extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $fillable = [
        'school_id',
        'admission_no',
        'full_name',
        'gender',
        'date_of_birth',
        'guardian_name',
        'guardian_phone',
        'admitted_on',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'gender' => Gender::class,
            'date_of_birth' => 'date',
            'admitted_on' => 'date',
        ];
    }

    /**
     * @return HasMany<Enrolment, $this>
     */
    public function enrolments(): HasMany
    {
        return $this->hasMany(Enrolment::class);
    }

    /**
     * @return HasMany<StudentSeries, $this>
     */
    public function studentSeries(): HasMany
    {
        return $this->hasMany(StudentSeries::class);
    }

    /**
     * @return HasMany<Mark, $this>
     */
    public function marks(): HasMany
    {
        return $this->hasMany(Mark::class);
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * @return HasMany<Report, $this>
     */
    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}
