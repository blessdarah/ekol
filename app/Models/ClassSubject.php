<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A subject as one class takes it: who teaches it there and for how
 * many periods a week. A null teacher means the class still needs one.
 *
 * @property string $id
 * @property string $school_id
 * @property string $school_class_id
 * @property string $subject_id
 * @property string|null $staff_id
 * @property int $weekly_periods
 */
class ClassSubject extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'school_class_id',
        'subject_id',
        'staff_id',
        'weekly_periods',
    ];

    /**
     * @return BelongsTo<SchoolClass, $this>
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'school_class_id');
    }

    /**
     * @return BelongsTo<Subject, $this>
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }
}
