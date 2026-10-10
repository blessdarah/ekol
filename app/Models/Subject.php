<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property string $id
 * @property string $school_id
 * @property string $code
 * @property string $name
 * @property string $department
 * @property int $weekly_periods
 * @property bool $is_theory_practical
 */
class Subject extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $fillable = [
        'school_id',
        'code',
        'name',
        'department',
        'weekly_periods',
        'is_theory_practical',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_theory_practical' => 'boolean',
        ];
    }

    /**
     * @return HasMany<Coefficient, $this>
     */
    public function coefficients(): HasMany
    {
        return $this->hasMany(Coefficient::class);
    }

    /**
     * @return HasMany<SubjectTeacher, $this>
     */
    public function subjectTeachers(): HasMany
    {
        return $this->hasMany(SubjectTeacher::class);
    }
}
