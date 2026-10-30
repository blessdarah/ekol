<?php

namespace App\Models\Concerns;

use App\Models\School;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Convention for every tenant-scoped table: a `school_id` UUID FK.
 *
 * While a school is bound for the request (`currentSchool`, set by the
 * tenant middleware), every query is limited to that school and a new
 * record without a school is given it. Outside a school (the bare
 * domain, the admin site, the console, queued jobs) nothing is added,
 * so platform work sees every school. A model whose rows are looked up
 * before the school is known (users, at sign-in) opts out with
 * `scopesToCurrentSchool()`.
 */
trait BelongsToSchool
{
    public static function bootBelongsToSchool(): void
    {
        if (! static::scopesToCurrentSchool()) {
            return;
        }

        static::addGlobalScope('school', function (Builder $query): void {
            $school = static::currentSchool();

            if ($school) {
                $query->where($query->getModel()->qualifyColumn('school_id'), $school->id);
            }
        });

        static::creating(function (Model $model): void {
            $school = static::currentSchool();

            if ($school && $model->getAttribute('school_id') === null) {
                $model->setAttribute('school_id', $school->id);
            }
        });
    }

    /**
     * Whether queries are limited to the school bound for the request.
     */
    public static function scopesToCurrentSchool(): bool
    {
        return true;
    }

    /**
     * The school bound for the request, if any.
     */
    public static function currentSchool(): ?School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        return $school instanceof School ? $school : null;
    }

    /**
     * @return BelongsTo<School, $this>
     */
    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForSchool(Builder $query, string $schoolId): Builder
    {
        return $query->where($query->getModel()->getTable() . '.school_id', $schoolId);
    }
}
