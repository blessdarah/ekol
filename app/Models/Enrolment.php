<?php

namespace App\Models;

use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per student per year. Lifecycle: Admitted creates the row,
 * Class placement sets school_class_id, Re-enrolment sets decision,
 * Confirm enrolment moves every placed row to enrolled. A row for a
 * coming year carries level_id: the level the student is headed for
 * before a class is chosen.
 *
 * @property string $id
 * @property string $student_id
 * @property string $academic_year_id
 * @property string|null $school_class_id
 * @property string|null $level_id
 * @property EnrolmentStatus $status
 * @property EnrolmentDecision|null $decision
 */
class Enrolment extends Model
{
    use HasUuids;

    protected $table = 'enrolments';

    protected $fillable = [
        'student_id',
        'academic_year_id',
        'school_class_id',
        'level_id',
        'status',
        'decision',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => EnrolmentStatus::class,
            'decision' => EnrolmentDecision::class,
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
     * @return BelongsTo<AcademicYear, $this>
     */
    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /**
     * @return BelongsTo<Level, $this>
     */
    public function level(): BelongsTo
    {
        return $this->belongsTo(Level::class);
    }

    /**
     * @return BelongsTo<SchoolClass, $this>
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'school_class_id');
    }

    /**
     * This year's students who sit in a class, with that class.
     *
     * @return Collection<int, Enrolment>
     */
    public static function continuingFor(School $school, ?AcademicYear $current): Collection
    {

        if (! $current) {
            return new Collection;
        }

        return Enrolment::where('academic_year_id', $current->id)
            ->whereNotNull('school_class_id')
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with('schoolClass:id,name,level_id')
            ->get();
    }
}
