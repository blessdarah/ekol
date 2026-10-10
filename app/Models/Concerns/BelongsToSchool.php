<?php

namespace App\Models\Concerns;

use App\Models\School;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Convention for every tenant-scoped table: a `school_id` UUID FK plus
 * a local scope. No automatic global scope is applied because tenant
 * resolution (middleware) lands in a follow-up change.
 */
trait BelongsToSchool
{
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
        return $query->where($query->getModel()->getTable().'.school_id', $schoolId);
    }
}
