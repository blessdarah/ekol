<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * The schemes of a term being opened: when teachers submit by, who
 * approves, what each scheme starts from, and when the term was closed.
 *
 * @property string $id
 * @property string $school_id
 * @property string $term_id
 * @property Carbon $due_on
 * @property string $approval
 * @property string $starts_from
 * @property bool $free_changes
 * @property string|null $opened_by
 * @property Carbon|null $closed_at
 * @property string|null $closed_by
 */
class SchemeOpening extends Model
{
    use BelongsToSchool, HasUuids;

    /**
     * Heads of department approve schemes of their department; the
     * principal can approve any.
     */
    public const string HEAD_OF_DEPARTMENT = 'head_of_department';

    public const string PRINCIPAL = 'principal';

    /**
     * A submitted scheme counts as approved at once.
     */
    public const string NONE = 'none';

    public const array APPROVALS = [self::HEAD_OF_DEPARTMENT, self::PRINCIPAL, self::NONE];

    public const string FROM_SYLLABUS = 'syllabus';

    public const string FROM_LAST_YEAR = 'last_year';

    protected $fillable = [
        'school_id',
        'term_id',
        'due_on',
        'approval',
        'starts_from',
        'free_changes',
        'opened_by',
        'closed_at',
        'closed_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_on' => 'date',
            'free_changes' => 'boolean',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }
}
