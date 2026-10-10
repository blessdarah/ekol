<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $student_id
 * @property string $series_id
 * @property string $term_id
 * @property string|null $chosen_by
 * @property Carbon $chosen_at
 * @property string|null $change_reason
 * @property string|null $change_note
 * @property bool $parent_agreed
 */
class StudentSeries extends Model
{
    use HasUuids;

    protected $table = 'student_series';

    protected $fillable = [
        'student_id',
        'series_id',
        'term_id',
        'chosen_by',
        'chosen_at',
        'change_reason',
        'change_note',
        'parent_agreed',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'chosen_at' => 'datetime',
            'parent_agreed' => 'boolean',
        ];
    }

    /**
     * The electives this student chose; core subjects come with the series.
     *
     * @return BelongsToMany<Subject, $this>
     */
    public function electives(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'student_series_subjects')->withTimestamps();
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<Series, $this>
     */
    public function series(): BelongsTo
    {
        return $this->belongsTo(Series::class, 'series_id');
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function chosenBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chosen_by');
    }
}
