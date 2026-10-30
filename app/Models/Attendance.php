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

    /**
     * A student's term, day by day: each school day with a register is
     * present, late (late or away for some lessons), absent or excused.
     *
     * @return array{days: array<string, string>, stats: array{present: int, late: int, absent: int, days: int, rate: int|null}, events: array<int, array{id: string, on: string, status: string, lesson: string, note: string|null, by: string|null}>, unexcused: int}
     */
    public static function summary(Student $student, ?Term $term): array
    {
        $records = $term
            ? Attendance::where('student_id', $student->id)
                ->whereDate('date', '>=', $term->starts_on)
                ->whereDate('date', '<=', $term->ends_on)
                ->with(['timetableSlot.subject:id,name', 'timetableSlot.period:id,label,starts_at', 'marker:id,full_name'])
                ->get()
            : collect();

        $days = $records
            ->groupBy(fn (Attendance $record) => $record->date->toDateString())
            ->map(function ($day) {
                $away = $day->whereIn('status', [AttendanceStatus::Absent, AttendanceStatus::Excused])->count();

                return match (true) {
                    $away === $day->count() => $day->contains('status', AttendanceStatus::Absent) ? 'absent' : 'excused',
                    $away > 0 || $day->contains('status', AttendanceStatus::Late) => 'late',
                    default => 'present',
                };
            });
        $counted = $days->count();

        return [
            'days' => $days->all(),
            'stats' => [
                'present' => $days->filter(fn (string $state) => $state === 'present')->count(),
                'late' => $days->filter(fn (string $state) => $state === 'late')->count(),
                'absent' => $days->filter(fn (string $state) => in_array($state, ['absent', 'excused'], true))->count(),
                'days' => $counted,
                'rate' => $counted > 0 ? (int) round($days->filter(fn (string $state) => in_array($state, ['present', 'late'], true))->count() / $counted * 100) : null,
            ],
            'events' => $records
                ->where('status', '!=', AttendanceStatus::Present)
                ->sortByDesc(fn (Attendance $record) => $record->date->toDateString().$record->timetableSlot?->period?->starts_at)
                ->values()
                ->map(fn (Attendance $record) => [
                    'id' => $record->id,
                    'on' => $record->date->toDateString(),
                    'status' => $record->status->value,
                    'lesson' => collect([$record->timetableSlot?->period?->label, $record->timetableSlot?->subject?->name])->filter()->join(' · '),
                    'note' => $record->note,
                    'by' => $record->marker?->full_name,
                ])
                ->all(),
            'unexcused' => $records->where('status', AttendanceStatus::Absent)->count(),
        ];
    }
}
