<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
 * @property string|null $coefficient
 * @property string|null $note
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
        'coefficient',
        'note',
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
     * The classes that take this subject, each with its own teacher.
     *
     * @return HasMany<ClassSubject, $this>
     */
    public function classSubjects(): HasMany
    {
        return $this->hasMany(ClassSubject::class);
    }

    /**
     * Series that carry this subject, as core or elective.
     *
     * @return BelongsToMany<Series, $this>
     */
    public function series(): BelongsToMany
    {
        return $this->belongsToMany(Series::class, 'series_subjects')->withPivot('kind');
    }

    /**
     * @return HasMany<SubjectTeacher, $this>
     */
    public function subjectTeachers(): HasMany
    {
        return $this->hasMany(SubjectTeacher::class);
    }
}
