<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $assessment_subject_id
 * @property string $student_id
 * @property string|null $score
 * @property string|null $grade_band_id
 * @property bool $is_absent
 * @property string|null $remark
 * @property string|null $entered_by
 */
class Mark extends Model
{
    use HasUuids;

    protected $fillable = [
        'assessment_subject_id',
        'student_id',
        'score',
        'grade_band_id',
        'is_absent',
        'remark',
        'entered_by',
        'entered_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_absent' => 'boolean',
            'entered_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<AssessmentSubject, $this>
     */
    public function assessmentSubject(): BelongsTo
    {
        return $this->belongsTo(AssessmentSubject::class);
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<GradeBand, $this>
     */
    public function gradeBand(): BelongsTo
    {
        return $this->belongsTo(GradeBand::class);
    }
}
