<?php

namespace App\Http\Controllers;

use App\Enums\RoomKind;
use App\Http\Requests\Structure\StoreRoomRequest;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\Room;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class StructureController extends Controller
{
    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();

        $levels = Level::where('school_id', $school->id)
            ->with(['series' => fn ($query) => $query->orderBy('code')])
            ->orderBy('ordinal')
            ->get();

        $classes = $year
            ? SchoolClass::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->with(['formMaster:id,full_name', 'homeRoom:id,code'])
                ->orderBy('name')
                ->get()
            : new EloquentCollection;

        $students = Enrolment::whereIn('school_class_id', $classes->modelKeys())
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id');

        return Inertia::render('structure/levels', [
            'yearLabel' => $year?->label,
            'selected' => $request->query('level'),
            'levels' => $levels->map(function (Level $level) use ($classes, $students) {
                $own = $classes->where('level_id', $level->id)->values();

                return [
                    'id' => $level->id,
                    'name' => $level->name,
                    'code' => $level->code,
                    'cycle' => $level->cycle->value,
                    'subsystem' => $level->subsystem,
                    'uses_series' => $level->uses_series,
                    'series_allowed' => Level::seriesAllowed($level->cycle, $level->subsystem),
                    'series' => $this->seriesRanges($level->series),
                    'students' => (int) $own->sum(fn (SchoolClass $class) => $students[$class->id] ?? 0),
                    'classes' => $own->map(fn (SchoolClass $class) => [
                        'id' => $class->id,
                        'name' => $class->name,
                        'capacity' => $class->capacity,
                        'students' => (int) ($students[$class->id] ?? 0),
                        'form_master_id' => $class->form_master_id,
                        'form_master' => $class->formMaster?->full_name,
                        'home_room_id' => $class->home_room_id,
                        'home_room' => $class->homeRoom?->code,
                    ]),
                ];
            }),
            'staff' => User::where('school_id', $school->id)
                ->orderBy('full_name')
                ->get(['id', 'full_name'])
                ->map(fn (User $member) => ['id' => $member->id, 'name' => $member->full_name]),
            'rooms' => Room::where('school_id', $school->id)
                ->orderBy('code')
                ->get()
                ->map(fn (Room $room) => [
                    'id' => $room->id,
                    'code' => $room->code,
                    'kind' => $room->kind->value,
                    'capacity' => $room->capacity,
                    'home_of' => $classes->firstWhere('home_room_id', $room->id)?->id,
                ]),
        ]);
    }

    /**
     * A classroom added from the class panel, so a home room can be
     * chosen before the timetable's room list exists.
     */
    public function storeRoom(StoreRoomRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();

        $data = $request->validated();

        $room = Room::create([
            'school_id' => $school->id,
            'code' => trim($data['code']),
            'name' => trim($data['code']),
            'capacity' => $data['capacity'],
            'kind' => RoomKind::Classroom,
        ]);

        AuditEvent::record($school, $request->user(), 'room', $room->id, 'created', $data);

        $this->notify('Room added.');

        return back();
    }

    /**
     * "S1–S4" style chips: first and last code per stream.
     *
     * @param  Collection<int, Series>  $series
     * @return array<int, array{stream: string, label: string}>
     */
    protected function seriesRanges(Collection $series): array
    {
        return $series
            ->groupBy(fn (Series $item) => $item->stream ?? 'science')
            ->map(function (Collection $group, string $stream) {
                $codes = $group->pluck('code')->sort()->values();

                return [
                    'stream' => $stream,
                    'label' => $codes->count() > 1
                        ? $codes->first().'–'.$codes->last()
                        : (string) $codes->first(),
                ];
            })
            ->sortByDesc('stream')
            ->values()
            ->all();
    }
}
