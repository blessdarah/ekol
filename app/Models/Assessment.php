<?php

namespace App\Models;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'total_max',
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
        ];
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
