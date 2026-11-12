<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One recurring weekly lesson.
 *
 * @property string $id
 * @property string $school_id
 * @property string $term_id
 * @property string $school_class_id
 * @property string $period_id
 * @property string|null $subject_id
 * @property string|null $staff_id
 * @property string|null $room_id
 * @property int $weekday
 * @property string|null $timetable_version_id
 * @property bool $is_locked
 */
class TimetableSlot extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'term_id',
        'school_class_id',
        'period_id',
        'subject_id',
        'staff_id',
        'room_id',
        'weekday',
        'timetable_version_id',
        'is_locked',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_locked' => 'boolean',
        ];
    }

    /**
     * The lessons a teacher takes on a day of the live timetable: her
     * own and those she covers that day, in the order they are taught.
     *
     * @return Collection<int, TimetableSlot>
     */
    public static function lessonsOn(User $teacher, School $school, TimetableVersion $live, CarbonInterface $day): Collection
    {
        $periods = Period::where('school_id', $school->id)->pluck('starts_at', 'id');

        return static::query()
            ->taughtBy($teacher, $live, $day)
            ->with(['schoolClass:id,name', 'subject:id,name', 'room:id,code', 'period'])
            ->get()
            ->sortBy(fn (TimetableSlot $slot) => $periods->get($slot->period_id))
            ->values();
    }

    /**
     * Lessons of the live timetable a teacher takes on a day: her own,
     * and those a cover assigns her for that day.
     *
     * @param  Builder<TimetableSlot>  $query
     */
    public function scopeTaughtBy(Builder $query, User $teacher, TimetableVersion $live, CarbonInterface $day): void
    {
        $covering = TimetableChange::where('timetable_version_id', $live->id)
            ->where('kind', 'cover')
            ->where('staff_id', $teacher->id)
            ->whereDate('starts_on', '<=', $day->toDateString())
            ->whereDate('ends_on', '>=', $day->toDateString())
            ->pluck('timetable_slot_id');

        $query->where('timetable_version_id', $live->id)
            ->where('weekday', $day->dayOfWeekIso - 1)
            ->where(fn (Builder $query) => $query->where('staff_id', $teacher->id)->orWhereIn('id', $covering));
    }

    /**
     * @return BelongsTo<TimetableVersion, $this>
     */
    public function version(): BelongsTo
    {
        return $this->belongsTo(TimetableVersion::class, 'timetable_version_id');
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

    /**
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
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
     * @return BelongsTo<Period, $this>
     */
    public function period(): BelongsTo
    {
        return $this->belongsTo(Period::class);
    }

    /**
     * @return HasMany<Attendance, $this>
     */
    public function attendance(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    /**
     * @return HasMany<TeachingLog, $this>
     */
    public function teachingLogs(): HasMany
    {
        return $this->hasMany(TeachingLog::class);
    }
}
