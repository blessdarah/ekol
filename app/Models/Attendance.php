<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $timetable_slot_id
 * @property string $student_id
 * @property Carbon $date
 * @property AttendanceStatus $status
 * @property string|null $marked_by
 * @property string|null $note
 */
class Attendance extends Model
{
    use HasUuids;

    protected $table = 'attendance';

    protected $fillable = [
        'timetable_slot_id',
        'student_id',
        'date',
        'status',
        'marked_by',
        'marked_at',
        'note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'status' => AttendanceStatus::class,
            'marked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<TimetableSlot, $this>
     */
    public function timetableSlot(): BelongsTo
    {
        return $this->belongsTo(TimetableSlot::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function marker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by');
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
