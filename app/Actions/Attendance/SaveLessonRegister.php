<?php

namespace App\Actions\Attendance;

use App\Enums\AttendanceStatus;
use App\Enums\EnrolmentStatus;
use App\Models\Attendance;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Save a lesson's register: one mark for every student of the class,
 * on the day of the lesson, once it has started. Saving again replaces
 * the earlier marks, except an absence the office has excused.
 */
class SaveLessonRegister
{
    /** @var list<AttendanceStatus> */
    public const array MARKS = [AttendanceStatus::Present, AttendanceStatus::Absent, AttendanceStatus::Late];

    /**
     * @param  list<array{student_id: string, status: string, note?: string|null}>  $marks
     * @return Collection<int, Attendance>
     */
    public function handle(School $school, User $teacher, TimetableSlot $lesson, CarbonInterface $date, array $marks): Collection
    {
        if ($lesson->school_id !== $school->id) {
            throw new InvalidArgumentException('The lesson must belong to the school.');
        }

        $now = now($school->timezone);
        $day = $date->toDateString();

        if ($day !== $now->toDateString()) {
            throw ValidationException::withMessages(['marks' => __('A register can only be saved on the day of the lesson.')]);
        }

        if (! $this->teaches($school, $teacher, $lesson, $now)) {
            throw static::notYourLesson();
        }

        $lesson->loadMissing('period');

        if ($lesson->period === null || $now->format('H:i:s') < $lesson->period->starts_at) {
            throw ValidationException::withMessages([
                'marks' => __('This lesson has not started. Its register opens at :starts_at.', ['starts_at' => substr((string) $lesson->period?->starts_at, 0, 5)]),
            ]);
        }

        $rows = $this->rows($lesson, $marks);

        return DB::transaction(function () use ($school, $teacher, $lesson, $rows, $day) {
            $existing = Attendance::where('timetable_slot_id', $lesson->id)->whereDate('date', $day)->get()->keyBy('student_id');

            foreach ($rows as $row) {
                $record = $existing->get($row['student_id']);

                // An absence the office has already excused stays excused.
                if ($record && $record->status === AttendanceStatus::Excused && $row['status'] === AttendanceStatus::Absent) {
                    continue;
                }

                $fields = ['status' => $row['status'], 'note' => $row['note'], 'marked_by' => $teacher->id, 'marked_at' => now()];

                if ($record) {
                    $record->update($fields);
                } else {
                    Attendance::create([...$fields, 'timetable_slot_id' => $lesson->id, 'student_id' => $row['student_id'], 'date' => $day]);
                }
            }

            AuditEvent::record($school, $teacher, 'timetable_slot', $lesson->id, $existing->isEmpty() ? 'register_saved' : 'register_changed', [
                'date' => $day,
                'counts' => array_count_values(array_map(fn (array $row) => $row['status']->value, $rows)),
            ]);

            return Attendance::where('timetable_slot_id', $lesson->id)->whereDate('date', $day)->get();
        });
    }

    public static function notYourLesson(): ValidationException
    {
        return ValidationException::withMessages(['marks' => __('That is not one of your lessons today.')]);
    }

    /**
     * Whether the lesson is on the school's live timetable for the day
     * and is the teacher's own or one she covers that day.
     */
    protected function teaches(School $school, User $teacher, TimetableSlot $lesson, CarbonInterface $day): bool
    {
        if ($teacher->school_id !== $school->id) {
            return false;
        }

        $term = Term::where('school_id', $school->id)->current()->first();
        $live = $term ? TimetableVersion::liveFor($term) : null;

        return $live !== null && TimetableSlot::whereKey($lesson->id)->taughtBy($teacher, $live, $day)->exists();
    }

    /**
     * One mark per student of the class, every student marked.
     *
     * @param  list<array{student_id: string, status: string, note?: string|null}>  $marks
     * @return list<array{student_id: string, status: AttendanceStatus, note: string|null}>
     */
    protected function rows(TimetableSlot $lesson, array $marks): array
    {
        $students = Enrolment::where('school_class_id', $lesson->school_class_id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->pluck('student_id')
            ->all();
        $rows = [];

        foreach (array_values($marks) as $index => $mark) {
            $student = (string) ($mark['student_id'] ?? '');
            $status = AttendanceStatus::tryFrom((string) ($mark['status'] ?? ''));
            $field = "marks.{$index}";

            if (isset($rows[$student])) {
                throw ValidationException::withMessages(["{$field}.student_id" => trans('validation.distinct', ['attribute' => "{$field}.student id"])]);
            }

            if (! in_array($student, $students, true)) {
                throw ValidationException::withMessages(["{$field}.student_id" => trans('validation.in', ['attribute' => "{$field}.student id"])]);
            }

            if (! in_array($status, static::MARKS, true)) {
                throw ValidationException::withMessages(["{$field}.status" => trans('validation.in', ['attribute' => "{$field}.status"])]);
            }

            $note = trim((string) ($mark['note'] ?? ''));
            $rows[$student] = ['student_id' => $student, 'status' => $status, 'note' => $note !== '' ? $note : null];
        }

        $left = count(array_diff($students, array_keys($rows)));

        if ($left > 0) {
            throw ValidationException::withMessages([
                'marks' => trans_choice('{1} Mark the last student before saving.|[2,*] Mark the last :count students before saving.', $left, ['count' => $left]),
            ]);
        }

        return array_values($rows);
    }
}
