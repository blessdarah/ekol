<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Classes belong to one academic year; next year's classes are new rows.
 *
 * @property string $id
 * @property string $school_id
 * @property string $academic_year_id
 * @property string $level_id
 * @property string $name
 * @property string|null $form_master_id
 * @property int $capacity
 * @property string|null $stream
 * @property string|null $home_room_id
 */
class SchoolClass extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $table = 'school_classes';

    protected $fillable = [
        'school_id',
        'academic_year_id',
        'level_id',
        'name',
        'form_master_id',
        'capacity',
        'stream',
        'home_room_id',
    ];

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
     * @return BelongsTo<User, $this>
     */
    public function formMaster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'form_master_id');
    }

    /**
     * @return BelongsTo<Room, $this>
     */
    public function homeRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'home_room_id');
    }

    /**
     * @return HasMany<Enrolment, $this>
     */
    public function enrolments(): HasMany
    {
        return $this->hasMany(Enrolment::class, 'school_class_id');
    }

    /**
     * @return HasMany<Assessment, $this>
     */
    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class);
    }

    /**
     * @return HasMany<TimetableSlot, $this>
     */
    public function timetableSlots(): HasMany
    {
        return $this->hasMany(TimetableSlot::class);
    }
}
