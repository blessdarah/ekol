<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Immutable report card. A published card is corrected by voiding
 * (voided_at) and issuing a new row — never by updating.
 *
 * @property string $id
 * @property string $student_id
 * @property string $term_id
 * @property int|null $class_position
 * @property string $total_score
 * @property string $head_teacher_remark
 * @property Carbon|null $next_term_opens_on
 * @property Carbon $published_at
 * @property Carbon|null $voided_at
 */
class Report extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'student_id',
        'term_id',
        'class_position',
        'total_score',
        'head_teacher_remark',
        'next_term_opens_on',
        'published_at',
        'voided_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'next_term_opens_on' => 'date',
            'published_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }
}
