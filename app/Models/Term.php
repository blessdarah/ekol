<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * @property string $id
 * @property string $school_id
 * @property string $academic_year_id
 * @property string $label
 * @property int $sequence
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property int $week_count
 * @property bool $is_current
 */
class Term extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'academic_year_id',
        'label',
        'sequence',
        'starts_on',
        'ends_on',
        'week_count',
        'is_current',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'is_current' => 'boolean',
        ];
    }

    /**
     * The term the school is in now.
     *
     * @param  Builder<static>  $query
     */
    public function scopeCurrent(Builder $query): void
    {
        $query->where('is_current', true);
    }

    /**
     * A term's dates must fall inside its academic year. This is a
     * cross-table rule, so no declarative CHECK can express it.
     *
     * Once any marks exist for the term, its dates and sequence lock:
     * history must stay explainable.
     */
    protected static function booted(): void
    {
        static::saving(function (Term $term) {
            if ($term->exists
                && $term->isDirty(['starts_on', 'ends_on', 'sequence'])
                && $term->hasMarks()
            ) {
                throw ValidationException::withMessages([
                    'starts_on' => __('This term already has marks and can no longer be changed.'),
                ]);
            }

            if (! $term->academic_year_id) {
                return;
            }

            $year = $term->academicYear()->first(['starts_on', 'ends_on']);

            if (! $year) {
                return;
            }

            $starts = Carbon::parse($term->starts_on)->startOfDay();
            $ends = Carbon::parse($term->ends_on)->startOfDay();

            if ($starts->lt($year->starts_on) || $ends->gt($year->ends_on)) {
                throw ValidationException::withMessages([
                    'starts_on' => __('Term dates must fall inside its academic year.'),
                    'ends_on' => __('Term dates must fall inside its academic year.'),
                ]);
            }
        });
    }

    /**
     * Whether any marks have been entered for this term's assessments.
     */
    public function hasMarks(): bool
    {
        return Mark::whereHas(
            'assessmentSubject.assessment',
            fn ($query) => $query->where('term_id', $this->id)
        )->exists();
    }

    /**
     * @return BelongsTo<AcademicYear, $this>
     */
    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /**
     * @return HasMany<StudentSeries, $this>
     */
    public function studentSeries(): HasMany
    {
        return $this->hasMany(StudentSeries::class);
    }

    /**
     * @return HasMany<Assessment, $this>
     */
    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class);
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
