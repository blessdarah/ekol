<?php

namespace App\Models;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $school_id
 * @property string $term_id
 * @property string $school_class_id
 * @property AssessmentKind $kind
 * @property string $name
 * @property AssessmentState $state
 * @property string $sequence_weight
 * @property string $exam_weight
 * @property Carbon|null $window_starts_on
 * @property Carbon|null $window_ends_on
 * @property string|null $assessment_plan_id
 */
class Assessment extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'term_id',
        'school_class_id',
        'kind',
        'name',
        'state',
        'sequence_weight',
        'exam_weight',
        'scheduled_for',
        'window_starts_on',
        'window_ends_on',
        'total_max',
        'assessment_plan_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => AssessmentKind::class,
            'state' => AssessmentState::class,
            'scheduled_for' => 'datetime',
            'window_starts_on' => 'date',
            'window_ends_on' => 'date',
        ];
    }

    /**
     * Whether teachers may currently enter marks: today inside the
     * window when both bounds are set; unconstrained otherwise.
     */
    public function windowOpen(): bool
    {
        if (! $this->window_starts_on || ! $this->window_ends_on) {
            return true;
        }

        return today()->between($this->window_starts_on, $this->window_ends_on);
    }

    /**
     * @return BelongsTo<AssessmentPlan, $this>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(AssessmentPlan::class, 'assessment_plan_id');
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * @return BelongsTo<SchoolClass, $this>
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'school_class_id');
    }

    /**
     * @return HasMany<AssessmentSubject, $this>
     */
    public function subjects(): HasMany
    {
        return $this->hasMany(AssessmentSubject::class);
    }
}
