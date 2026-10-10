<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One row per subject covered by an assessment. The coefficient_id is a
 * frozen snapshot: later weight changes never rewrite this row.
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $subject_id
 * @property string $coefficient_id
 * @property string $max_score
 * @property string|null $examiner_id
 * @property string|null $venue
 */
class AssessmentSubject extends Model
{
    use HasUuids;

    protected $table = 'assessment_subjects';

    protected $fillable = [
        'assessment_id',
        'subject_id',
        'coefficient_id',
        'max_score',
        'examiner_id',
        'venue',
    ];

    /**
     * @return BelongsTo<Assessment, $this>
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * @return BelongsTo<Subject, $this>
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * @return BelongsTo<Coefficient, $this>
     */
    public function coefficient(): BelongsTo
    {
        return $this->belongsTo(Coefficient::class);
    }

    /**
     * @return HasMany<Mark, $this>
     */
    public function marks(): HasMany
    {
        return $this->hasMany(Mark::class);
    }
}
