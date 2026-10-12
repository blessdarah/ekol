<?php

namespace App\Http\Controllers;

use App\Models\AcademicYear;
use App\Models\Period;
use App\Models\Room;
use App\Models\School;
use App\Models\TimetableChange;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A teacher's own week on the published timetable, with the covers,
 * swaps and room changes the office logged for that week.
 */
class TeacherTimetableController extends Controller
{
    public function show(Request $request): Response
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;
        $teacher = $request->user();

        if (! $school instanceof School || ! $teacher) {
            abort(404);
        }

        $term = StudentController::currentTerm($school);
        $live = $term ? TimetableVersion::liveFor($term) : null;

        if (! $term || ! $live) {
            return Inertia::render('teacher/timetable', ['week' => null, 'termLabel' => $term?->label]);
        }

        // The school's calendar day, held as a plain date so it compares with term dates.
        $today = Carbon::parse(now($school->timezone)->toDateString());
        $first = $term->starts_on->copy()->startOfWeek();
        $last = $term->ends_on->copy()->startOfWeek();
        $asked = rescue(fn () => Carbon::parse((string) $request->query('week', $today->toDateString())), $today, false);
        $start = $asked->copy()->startOfWeek();
        $start = $start->lt($first) ? $first->copy() : ($start->gt($last) ? $last->copy() : $start);
        $thisWeek = $today->copy()->startOfWeek();

        $days = array_values(array_filter(range(0, 6), fn (int $day) => ($school->school_days & (1 << $day)) !== 0));
        $periods = Period::where('school_id', $school->id)->orderBy('ordinal')->get();
        $teaching = $periods->where('is_break', false);
        $slots = TimetableSlot::where('timetable_version_id', $live->id)
            ->with(['schoolClass:id,name', 'subject:id,name', 'room:id,code', 'staff:id,full_name'])
            ->get()
            ->keyBy('id');
        $mine = $slots->where('staff_id', $teacher->id);
        $cells = $this->cells($school, $live, $teacher, $slots, $start);
        $lessons = $mine->count();

        return Inertia::render('teacher/timetable', [
            'termLabel' => $term->label,
            'yearLabel' => AcademicYear::whereKey($term->academic_year_id)->value('label'),
            'week' => [
                'number' => (int) floor($first->diffInDays($start) / 7) + 1,
                'of' => $term->week_count,
                'start' => $start->toDateString(),
                'label' => $this->span($start, $start->copy()->addDays(max($days ?: [0]))),
                'previous' => $start->gt($first) ? $start->copy()->subWeek()->toDateString() : null,
                'next' => $start->lt($last) ? $start->copy()->addWeek()->toDateString() : null,
                'isCurrent' => $start->equalTo($thisWeek),
            ],
            'version' => ['number' => $live->number, 'published' => $live->published_at?->toDateString()],
            'summary' => [
                'subjects' => $mine->pluck('subject_id')->filter()->unique()->count(),
                'classes' => $mine->pluck('school_class_id')->unique()->count(),
                'rooms' => $mine->pluck('room_id')->filter()->unique()->count(),
                'periods' => $lessons,
                'free' => max(0, count($days) * $teaching->count() - $lessons),
            ],
            'days' => array_map(fn (int $day) => [
                'index' => $day,
                'short' => substr(TimetableVersion::WEEKDAYS[$day], 0, 3),
                'date' => $start->copy()->addDays($day)->toDateString(),
                'today' => $start->copy()->addDays($day)->equalTo($today),
            ], $days),
            'periods' => $periods->map(fn (Period $period) => [
                'id' => $period->id,
                'label' => $period->label,
                'time' => substr($period->starts_at, 0, 5).' – '.substr($period->ends_at, 0, 5),
                'is_break' => $period->is_break,
            ])->values(),
            'cells' => $cells === [] ? new \stdClass : $cells,
        ]);
    }

    /**
     * What the teacher has in each slot of one week, keyed by
     * "weekday|period": her own lessons, moved or re-roomed where the
     * office logged a change, and the lessons she covers for others.
     *
     * @param  Collection<string, TimetableSlot>  $slots
     * @return array<string, list<array{id: string, class: string, subject: string, room: string|null, note: string|null, tone: string}>>
     */
    protected function cells(School $school, TimetableVersion $live, User $teacher, $slots, CarbonInterface $start): array
    {
        $end = $start->copy()->addDays(6);
        $changes = TimetableChange::where('school_id', $school->id)
            ->where('timetable_version_id', $live->id)
            ->whereDate('starts_on', '<=', $end)
            ->whereDate('ends_on', '>=', $start)
            ->with('author:id,full_name')
            ->oldest()
            ->get();
        $rooms = Room::whereIn('id', $changes->pluck('room_id')->filter()->unique())->pluck('code', 'id');
        $covers = User::whereIn('id', $changes->pluck('staff_id')->filter()->unique())->pluck('full_name', 'id');
        $dateOf = fn (TimetableSlot $slot) => $start->copy()->addDays($slot->weekday);
        $covers_ = fn (TimetableChange $change, TimetableSlot $slot) => $dateOf($slot)->betweenIncluded($change->starts_on, $change->ends_on);

        $place = [];
        $room = [];
        $note = [];
        $tone = [];
        $extra = [];

        foreach ($changes as $change) {
            $slot = $slots->get($change->timetable_slot_id);

            if (! $slot) {
                continue;
            }

            if ($change->kind === 'swap' && ($other = $slots->get((string) $change->other_slot_id))) {
                $place[$slot->id] = [$other->weekday, $other->period_id];
                $place[$other->id] = [$slot->weekday, $slot->period_id];
                $note[$slot->id] = $note[$other->id] = 'Swapped this week';
                $tone[$slot->id] = $tone[$other->id] = 'changed';
            } elseif ($change->kind === 'room' && $covers_($change, $slot)) {
                $room[$slot->id] = $rooms->get((string) $change->room_id);
                $note[$slot->id] = 'Room changed';
                $tone[$slot->id] = 'changed';
            } elseif ($change->kind === 'cover' && $covers_($change, $slot)) {
                if ($slot->staff_id === $teacher->id) {
                    $note[$slot->id] = 'Covered by '.$covers->get((string) $change->staff_id);
                    $tone[$slot->id] = 'away';
                } elseif ($change->staff_id === $teacher->id) {
                    $extra[$slot->id] = 'Cover for '.$slot->staff?->full_name;
                }
            }
        }

        $cells = [];

        foreach ($slots as $slot) {
            $own = $slot->staff_id === $teacher->id;

            if (! $own && ! isset($extra[$slot->id])) {
                continue;
            }

            [$weekday, $periodId] = $place[$slot->id] ?? [$slot->weekday, $slot->period_id];

            $cells[TimetableVersion::key($weekday, $periodId)][] = [
                'id' => $slot->id,
                'class' => (string) $slot->schoolClass?->name,
                'subject' => (string) $slot->subject?->name,
                'room' => $room[$slot->id] ?? $slot->room?->code,
                'note' => $own ? ($note[$slot->id] ?? null) : $extra[$slot->id],
                'tone' => $own ? ($tone[$slot->id] ?? 'lesson') : 'cover',
            ];
        }

        return $cells;
    }

    /**
     * "Mon 6 – Fri 10 October", or across two months.
     */
    protected function span(CarbonInterface $from, CarbonInterface $to): string
    {
        return $from->month === $to->month
            ? $from->translatedFormat('D j').' – '.$to->translatedFormat('D j F')
            : $from->translatedFormat('D j M').' – '.$to->translatedFormat('D j M');
    }
}
