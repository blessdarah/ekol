<?php

namespace App\Http\Controllers;

use App\Enums\AttendanceStatus;
use App\Enums\EnrolmentStatus;
use App\Models\Attendance;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Period;
use App\Models\School;
use App\Models\Term;
use App\Models\TimetableChange;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A teacher's registers: one per lesson she teaches today, each kept
 * apart from the others, even for the same class.
 */
class AttendanceController extends Controller
{
    /**
     * The lessons a teacher takes on a day of the live timetable: her
     * own and those she covers that day, in the order they are taught.
     *
     * @return Collection<int, TimetableSlot>
     */
    public static function lessonsOn(User $teacher, School $school, TimetableVersion $live, CarbonInterface $day): Collection
    {
        $covering = TimetableChange::where('timetable_version_id', $live->id)
            ->where('kind', 'cover')
            ->where('staff_id', $teacher->id)
            ->whereDate('starts_on', '<=', $day->toDateString())
            ->whereDate('ends_on', '>=', $day->toDateString())
            ->pluck('timetable_slot_id');
        $periods = Period::where('school_id', $school->id)->pluck('starts_at', 'id');

        return TimetableSlot::where('timetable_version_id', $live->id)
            ->where('weekday', $day->dayOfWeekIso - 1)
            ->where(fn ($query) => $query->where('staff_id', $teacher->id)->orWhereIn('id', $covering))
            ->with(['schoolClass:id,name', 'subject:id,name', 'room:id,code', 'period'])
            ->get()
            ->sortBy(fn (TimetableSlot $slot) => $periods->get($slot->period_id))
            ->values();
    }

    public function show(Request $request): Response
    {
        [$school, $teacher] = $this->context($request);
        $now = now($school->timezone);
        $term = StudentController::currentTerm($school);
        $live = $term ? TimetableVersion::liveFor($term) : null;
        $slots = $live ? static::lessonsOn($teacher, $school, $live, $now) : new Collection;
        $date = $now->toDateString();
        $clock = $now->format('H:i:s');
        $marked = Attendance::whereIn('timetable_slot_id', $slots->modelKeys())->whereDate('date', $date)->get()->groupBy('timetable_slot_id');
        $sizes = Enrolment::whereIn('school_class_id', $slots->pluck('school_class_id')->unique())
            ->where('status', '!=', EnrolmentStatus::Left)
            ->get(['school_class_id'])
            ->countBy('school_class_id');
        $started = fn (TimetableSlot $slot) => $slot->period !== null && $clock >= $slot->period->starts_at;

        $current = $slots->firstWhere('id', (string) $request->query('lesson', ''))
            ?? $slots->first(fn (TimetableSlot $slot) => $started($slot) && ! $marked->has($slot->id) && $clock < (string) $slot->period?->ends_at)
            ?? $slots->last(fn (TimetableSlot $slot) => $started($slot) && ! $marked->has($slot->id))
            ?? $slots->first(fn (TimetableSlot $slot) => ! $started($slot))
            ?? $slots->last();

        $roll = [];

        if ($current) {
            $mine = ($marked->get($current->id) ?? new Collection)->keyBy('student_id');
            $roll = Enrolment::where('school_class_id', $current->school_class_id)
                ->where('status', '!=', EnrolmentStatus::Left)
                ->whereHas('student')
                ->with('student:id,full_name')
                ->get()
                ->map(fn (Enrolment $enrolment) => $enrolment->student)
                ->filter()
                ->sortBy('full_name')
                ->values()
                ->map(fn ($student) => [
                    'student_id' => $student->id,
                    'name' => $student->full_name,
                    'status' => $mine->get($student->id)?->status->value,
                    'note' => $mine->get($student->id)?->note,
                ])
                ->all();
        }

        return Inertia::render('teacher/attendance', [
            'dateLabel' => $now->format('l j M'),
            'date' => $date,
            'weekLabel' => $term ? $this->week($term, $now) : null,
            'hasTimetable' => $live !== null,
            'lessons' => $slots->map(fn (TimetableSlot $slot) => [
                'id' => $slot->id,
                'period' => (string) $slot->period?->label,
                'time' => substr((string) $slot->period?->starts_at, 0, 5).' – '.substr((string) $slot->period?->ends_at, 0, 5),
                'class' => (string) $slot->schoolClass?->name,
                'subject' => (string) $slot->subject?->name,
                'room' => $slot->room?->code,
                'students' => (int) $sizes->get($slot->school_class_id, 0),
                'present' => ($marked->get($slot->id) ?? new Collection)->whereIn('status', [AttendanceStatus::Present, AttendanceStatus::Late])->count(),
                'saved' => $marked->has($slot->id),
                'started' => $started($slot),
                'cover' => $slot->staff_id !== $teacher->id,
            ]),
            'lesson' => $current?->id,
            'roll' => $roll,
        ]);
    }

    /**
     * Save a lesson's register for today. Every student gets a mark;
     * saving again replaces the earlier marks, the same day only.
     */
    public function store(Request $request, string $slot): RedirectResponse
    {
        [$school, $teacher] = $this->context($request);
        $now = now($school->timezone);
        $term = StudentController::currentTerm($school);
        $live = $term ? TimetableVersion::liveFor($term) : null;
        $target = $live ? static::lessonsOn($teacher, $school, $live, $now)->firstWhere('id', $slot) : null;

        if (! $target) {
            throw ValidationException::withMessages(['marks' => 'That is not one of your lessons today.']);
        }

        if ($target->period === null || $now->format('H:i:s') < $target->period->starts_at) {
            throw ValidationException::withMessages([
                'marks' => 'This lesson has not started. Its register opens at '.substr((string) $target->period?->starts_at, 0, 5).'.',
            ]);
        }

        $students = Enrolment::where('school_class_id', $target->school_class_id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->pluck('student_id')
            ->all();

        $data = $request->validate([
            'marks' => ['required', 'array'],
            'marks.*.student_id' => ['required', 'distinct', Rule::in($students)],
            'marks.*.status' => ['required', Rule::in([AttendanceStatus::Present->value, AttendanceStatus::Absent->value, AttendanceStatus::Late->value])],
            'marks.*.note' => ['nullable', 'string', 'max:160'],
        ]);

        $rows = $this->markRows($data);
        $left = count(array_diff($students, array_column($rows, 'student_id')));

        if ($left > 0) {
            throw ValidationException::withMessages([
                'marks' => "Mark the last {$left} ".($left === 1 ? 'student' : 'students').' before saving.',
            ]);
        }

        $date = $now->toDateString();

        DB::transaction(function () use ($request, $school, $teacher, $target, $rows, $date) {
            $existing = Attendance::where('timetable_slot_id', $target->id)->whereDate('date', $date)->get()->keyBy('student_id');

            foreach ($rows as $row) {
                $record = $existing->get($row['student_id']);
                $status = AttendanceStatus::from($row['status']);
                $note = isset($row['note']) && trim((string) $row['note']) !== '' ? trim((string) $row['note']) : null;

                // An absence the office has already excused stays excused.
                if ($record && $record->status === AttendanceStatus::Excused && $status === AttendanceStatus::Absent) {
                    continue;
                }

                $fields = ['status' => $status, 'note' => $note, 'marked_by' => $teacher->id, 'marked_at' => now()];

                if ($record) {
                    $record->update($fields);
                } else {
                    Attendance::create([...$fields, 'timetable_slot_id' => $target->id, 'student_id' => $row['student_id'], 'date' => $date]);
                }
            }

            AuditEvent::create([
                'school_id' => $school->id,
                'actor_id' => $request->user()?->id,
                'entity' => 'timetable_slot',
                'entity_id' => $target->id,
                'action' => $existing->isEmpty() ? 'register_saved' : 'register_changed',
                'diff' => ['date' => $date, 'counts' => array_count_values(array_column($rows, 'status'))],
            ]);
        });

        return back();
    }

    /**
     * @return array{0: School, 1: User}
     */
    protected function context(Request $request): array
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;
        $user = $request->user();

        if (! $school instanceof School || ! $user) {
            abort(404);
        }

        return [$school, $user];
    }

    protected function week(Term $term, CarbonInterface $now): string
    {
        $week = (int) floor($term->starts_on->copy()->startOfWeek()->diffInDays($now->toDateString()) / 7) + 1;

        return 'Week '.max(1, min($week, $term->week_count))." of {$term->week_count}";
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{student_id: string, status: string, note?: string|null}>
     */
    protected function markRows(array $data): array
    {
        return $data['marks'];
    }
}
