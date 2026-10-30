<?php

namespace App\Http\Controllers;

use App\Enums\RoomKind;
use App\Http\Requests\Timetable\SaveRoomRequest;
use App\Models\AuditEvent;
use App\Models\Period;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The rooms lessons are placed in: their kind, seats, the subjects
 * that need that kind of room, and the periods a room is closed.
 */
class TimetableRoomController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();

        if (! $term) {
            return redirect()->route('timetable');
        }

        $world = TimetableVersion::worldFor($school, $term);
        $version = TimetableVersion::draftFor($term) ?? TimetableVersion::liveFor($term);
        $booked = $version
            ? TimetableSlot::where('timetable_version_id', $version->id)->whereNotNull('room_id')->get(['room_id'])->countBy('room_id')
            : collect();
        $homes = $world['classes']->filter(fn (SchoolClass $class) => $class->home_room_id !== null)->keyBy('home_room_id');
        $subjects = Subject::where('school_id', $school->id)->orderBy('name')->get(['id', 'name', 'room_kind']);

        return Inertia::render('timetable/rooms', [
            'phase' => TimetableVersion::phase($school, $term),
            'slotsAWeek' => count($world['days']) * $world['periods']->count(),
            'schoolDays' => $school->school_days,
            'periods' => $world['periods']->map(fn (Period $period) => ['id' => $period->id, 'label' => $period->label])->values(),
            'kinds' => collect(RoomKind::cases())->map(fn (RoomKind $kind) => [
                'value' => $kind->value,
                'label' => $kind->label(),
                'special' => in_array($kind, RoomKind::special(), true),
            ]),
            'subjects' => $subjects->map(fn (Subject $subject) => [
                'id' => $subject->id,
                'name' => $subject->name,
                'room_kind' => $subject->room_kind?->value,
            ]),
            'rooms' => $world['rooms']->map(fn (Room $room) => [
                'id' => $room->id,
                'code' => $room->code,
                'kind' => $room->kind->value,
                'capacity' => $room->capacity,
                'home' => $homes->get($room->id)?->name,
                'booked' => (int) $booked->get($room->id, 0),
                'unavailable' => $room->unavailable ?? [],
            ])->values(),
        ]);
    }

    public function store(SaveRoomRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $data = $this->validated($request);

        $room = Room::create([
            'school_id' => $school->id,
            'code' => trim($data['code']),
            'name' => trim($data['code']),
            'capacity' => $data['capacity'],
            'kind' => $data['kind'],
            'unavailable' => $data['unavailable'],
        ]);

        $this->audit($request, $school, $room, 'created', $room->only(['code', 'kind', 'capacity']));

        $this->notify('Room added.');

        return redirect()->route('timetable.rooms', ['room' => $room->id]);
    }

    public function update(SaveRoomRequest $request, string $room): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = Room::where('school_id', $school->id)->where('id', $room)->firstOrFail();
        $data = $this->validated($request);

        DB::transaction(function () use ($request, $school, $target, $data) {
            $before = $target->only(['code', 'kind', 'capacity', 'unavailable']);

            $target->update([
                'code' => trim($data['code']),
                'name' => trim($data['code']),
                'capacity' => $data['capacity'],
                'kind' => $data['kind'],
                'unavailable' => $data['unavailable'],
            ]);

            $kind = RoomKind::from($data['kind']);

            if (in_array($kind, RoomKind::special(), true) && array_key_exists('subject_ids', $data)) {
                Subject::where('school_id', $school->id)->where('room_kind', $kind)
                    ->whereNotIn('id', $data['subject_ids'])
                    ->update(['room_kind' => null]);
                Subject::where('school_id', $school->id)->whereIn('id', $data['subject_ids'])
                    ->update(['room_kind' => $kind]);
            }

            $this->audit($request, $school, $target, 'updated', [
                'before' => $before,
                'after' => $target->only(['code', 'kind', 'capacity', 'unavailable']),
            ]);
        });

        $this->notify('Room saved.');

        return back();
    }

    /**
     * Retire a room. Draft lessons that were in it keep their time and
     * lose the room, so they can be given another in Review.
     */
    public function destroy(Request $request, string $room): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $target = Room::where('school_id', $school->id)->where('id', $room)->firstOrFail();

        DB::transaction(function () use ($request, $school, $term, $target) {
            $draft = $term ? TimetableVersion::draftFor($term) : null;
            $moved = $draft
                ? TimetableSlot::where('timetable_version_id', $draft->id)->where('room_id', $target->id)->update(['room_id' => null])
                : 0;

            SchoolClass::where('school_id', $school->id)->where('home_room_id', $target->id)->update(['home_room_id' => null]);
            $target->delete();

            $this->audit($request, $school, $target, 'retired', ['code' => $target->code, 'lessons_without_room' => $moved]);
        });

        $this->notify('Room removed.');

        return redirect()->route('timetable.rooms');
    }

    /**
     * @return array{code: string, kind: string, capacity: int, unavailable: list<array{weekday: int, period_id: string, reason: string|null}>, subject_ids?: list<string>}
     */
    protected function validated(SaveRoomRequest $request): array
    {
        $data = $request->validated();
        $room = [
            'code' => (string) $data['code'],
            'kind' => (string) $data['kind'],
            'capacity' => (int) $data['capacity'],
            'unavailable' => array_values(array_map(fn (array $block) => [
                'weekday' => (int) $block['weekday'],
                'period_id' => (string) $block['period_id'],
                'reason' => isset($block['reason']) ? trim((string) $block['reason']) : null,
            ], $data['unavailable'])),
        ];

        if (isset($data['subject_ids'])) {
            $room['subject_ids'] = array_values(array_map(strval(...), $data['subject_ids']));
        }

        return $room;
    }

    protected function audit(Request $request, School $school, Room $room, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'room',
            'entity_id' => $room->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
