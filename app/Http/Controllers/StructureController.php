<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
use App\Enums\RoomKind;
use App\Enums\SchoolCycle;
use App\Http\Requests\Structure\StoreLevelRequest;
use App\Http\Requests\Structure\StoreLevelTemplatesRequest;
use App\Http\Requests\Structure\StoreRoomRequest;
use App\Http\Requests\Structure\UpdateClassRequest;
use App\Http\Requests\Structure\UpdateLevelRequest;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\TimetableSlot;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StructureController extends Controller
{
    public const int DEFAULT_SEATS = 45;

    public const array SUBSYSTEMS = ['anglophone', 'francophone'];

    /**
     * The bound school, for a signed-in user allowed to change structure.
     */
    public static function schoolFor(Request $request): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        abort_unless((bool) $request->user()?->role->managesStructure(), 403);

        return $school;
    }

    public static function currentYear(School $school): ?AcademicYear
    {
        return AcademicYear::where('school_id', $school->id)
            ->where('status', AcademicYearStatus::Current)
            ->first();
    }

    /**
     * Series are a GCE high school idea; nothing else may turn them on.
     */
    public static function seriesAllowed(SchoolCycle|string $cycle, ?string $subsystem): bool
    {
        $cycle = $cycle instanceof SchoolCycle ? $cycle : SchoolCycle::from($cycle);

        return $cycle === SchoolCycle::HighSchool && $subsystem === 'anglophone';
    }

    public function index(Request $request): Response
    {
        $school = static::schoolFor($request);
        $year = static::currentYear($school);

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
                    'series_allowed' => static::seriesAllowed($level->cycle, $level->subsystem),
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

    public function createLevel(Request $request): Response
    {
        $school = static::schoolFor($request);

        return Inertia::render('structure/level-create', [
            'yearLabel' => static::currentYear($school)?->label,
            'hasYear' => static::currentYear($school) !== null,
            'defaultSubsystem' => $school->subsystem === 'francophone' ? 'francophone' : 'anglophone',
        ]);
    }

    public function storeLevel(StoreLevelRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request);
        $year = static::currentYear($school);

        $data = $request->validated();

        if ($data['uses_series'] && ! static::seriesAllowed($data['cycle'], $data['subsystem'])) {
            throw ValidationException::withMessages([
                'uses_series' => 'Series are only for high school levels in the GCE subsystem.',
            ]);
        }

        if ($data['class_count'] > 0 && ! $year) {
            throw ValidationException::withMessages([
                'class_count' => 'Classes belong to an academic year. Make a year active in School Setup first.',
            ]);
        }

        $level = DB::transaction(function () use ($request, $school, $year, $data) {
            $level = Level::create([
                'school_id' => $school->id,
                'name' => trim($data['name']),
                'code' => mb_strtoupper(trim($data['code'])),
                'ordinal' => (int) Level::withTrashed()->where('school_id', $school->id)->max('ordinal') + 1,
                'cycle' => $data['cycle'],
                'subsystem' => $data['subsystem'],
                'uses_series' => $data['uses_series'],
            ]);

            $letters = $year ? array_slice(range('A', 'Z'), 0, $data['class_count']) : [];

            foreach ($letters as $letter) {
                SchoolClass::create([
                    'school_id' => $school->id,
                    'academic_year_id' => $year->id,
                    'level_id' => $level->id,
                    'name' => "{$level->name} {$letter}",
                    'capacity' => static::DEFAULT_SEATS,
                ]);
            }

            $this->audit($request, $school, 'level', $level->id, 'created', [
                'name' => $level->name,
                'classes' => $data['class_count'],
            ]);

            return $level;
        });

        return redirect()->route('classes', ['level' => $level->id]);
    }

    public function levelTemplates(Request $request): Response
    {
        $school = static::schoolFor($request);
        $year = static::currentYear($school);
        $existing = Level::withTrashed()->where('school_id', $school->id)->get(['name', 'code']);

        return Inertia::render('structure/level-templates', [
            'yearLabel' => $year?->label,
            'hasYear' => $year !== null,
            'defaultSeats' => static::DEFAULT_SEATS,
            'sets' => collect($this->levelTemplateSets())->map(fn (array $set, string $key) => [
                'key' => $key,
                'name' => $set['name'],
                'description' => $set['description'],
                'levels' => array_map(fn (array $level) => [
                    'name' => $level[0],
                    'code' => $level[1],
                    'cycle' => $level[2],
                    'uses_series' => $level[3],
                    'exists' => $existing->contains(fn (Level $own) => $own->name === $level[0] || $own->code === $level[1]),
                ], $set['levels']),
            ])->values(),
        ]);
    }

    public function storeLevelTemplates(StoreLevelTemplatesRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request);
        $year = static::currentYear($school);
        $set = $this->levelTemplateSets()[$request->string('set')->toString()] ?? null;

        abort_unless($set !== null, 404);

        $data = $request->validated();

        /** Requested class counts, keyed by level code. */
        $counts = Arr::pluck($data['levels'], 'class_count', 'code');

        if (array_sum($counts) > 0 && ! $year) {
            throw ValidationException::withMessages([
                'levels' => 'Classes belong to an academic year. Make a year active in School Setup first.',
            ]);
        }

        $existing = Level::withTrashed()->where('school_id', $school->id)->get(['name', 'code']);

        DB::transaction(function () use ($request, $school, $year, $set, $counts, $existing) {
            $ordinal = (int) Level::withTrashed()->where('school_id', $school->id)->max('ordinal');

            foreach ($set['levels'] as [$name, $code, $cycle, $usesSeries]) {
                $taken = $existing->contains(fn (Level $own) => $own->name === $name || $own->code === $code);

                // Levels the school already has are left alone.
                if (! array_key_exists($code, $counts) || $taken) {
                    continue;
                }

                $level = Level::create([
                    'school_id' => $school->id,
                    'name' => $name,
                    'code' => $code,
                    'ordinal' => ++$ordinal,
                    'cycle' => $cycle,
                    'subsystem' => $set['subsystem'],
                    'uses_series' => $usesSeries && static::seriesAllowed($cycle, $set['subsystem']),
                ]);

                foreach (array_slice(range('A', 'Z'), 0, $year ? (int) $counts[$code] : 0) as $letter) {
                    SchoolClass::create([
                        'school_id' => $school->id,
                        'academic_year_id' => $year?->id,
                        'level_id' => $level->id,
                        'name' => "{$name} {$letter}",
                        'capacity' => static::DEFAULT_SEATS,
                    ]);
                }

                $this->audit($request, $school, 'level', $level->id, 'created', [
                    'name' => $name,
                    'classes' => (int) $counts[$code],
                    'template' => true,
                ]);
            }
        });

        return redirect()->route('classes');
    }

    /**
     * @return array<string, array{name: string, description: string, subsystem: string, levels: list<array{0: string, 1: string, 2: string, 3: bool}>}>
     */
    protected function levelTemplateSets(): array
    {
        return config('level_templates');
    }

    public function updateLevel(UpdateLevelRequest $request, string $level): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = Level::where('school_id', $school->id)->where('id', $level)->firstOrFail();

        $data = $request->validated();

        if ($data['uses_series'] && ! static::seriesAllowed($target->cycle, $target->subsystem)) {
            throw ValidationException::withMessages([
                'uses_series' => 'Series are only for high school levels in the GCE subsystem.',
            ]);
        }

        $target->update($data);
        $this->audit($request, $school, 'level', $target->id, 'series_toggled', $data);

        return back();
    }

    public function storeClass(Request $request, string $level): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = Level::where('school_id', $school->id)->where('id', $level)->firstOrFail();
        $year = static::currentYear($school);

        if (! $year) {
            throw ValidationException::withMessages([
                'class' => 'Classes belong to an academic year. Make a year active in School Setup first.',
            ]);
        }

        $taken = SchoolClass::withTrashed()
            ->where('academic_year_id', $year->id)
            ->where('level_id', $target->id)
            ->pluck('name')
            ->all();

        $name = collect(range('A', 'Z'))
            ->map(fn (string $letter) => "{$target->name} {$letter}")
            ->first(fn (string $candidate) => ! in_array($candidate, $taken, true));

        if (! $name) {
            throw ValidationException::withMessages([
                'class' => 'This level already has every class from A to Z.',
            ]);
        }

        $class = SchoolClass::create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'level_id' => $target->id,
            'name' => $name,
            'capacity' => static::DEFAULT_SEATS,
        ]);

        $this->audit($request, $school, 'school_class', $class->id, 'created', ['name' => $name]);

        return back();
    }

    public function updateClass(UpdateClassRequest $request, string $class): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = SchoolClass::where('school_id', $school->id)->where('id', $class)->firstOrFail();

        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $target, $data) {
            $before = $target->only(array_keys($data));
            $previousMaster = $target->form_master_id;
            $target->update($data);

            $this->syncFormMasterFlags([$previousMaster, $target->form_master_id]);
            $this->audit($request, $school, 'school_class', $target->id, 'updated', [
                'before' => $before,
                'after' => $target->only(array_keys($data)),
            ]);
        });

        return back();
    }

    public function destroyClass(Request $request, string $class): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = SchoolClass::where('school_id', $school->id)->where('id', $class)->firstOrFail();

        $inUse = Enrolment::where('school_class_id', $target->id)->exists()
            || TimetableSlot::where('school_class_id', $target->id)->exists()
            || Assessment::where('school_class_id', $target->id)->exists();

        if ($inUse) {
            throw ValidationException::withMessages([
                'class' => "{$target->name} has students, lessons or assessments. Move them before removing the class.",
            ]);
        }

        DB::transaction(function () use ($request, $school, $target) {
            $master = $target->form_master_id;
            $this->audit($request, $school, 'school_class', $target->id, 'removed', ['name' => $target->name]);

            // Nothing references it, so the name is freed for reuse.
            $target->forceDelete();
            $this->syncFormMasterFlags([$master]);
        });

        return back();
    }

    /**
     * A classroom added from the class panel, so a home room can be
     * chosen before the timetable's room list exists.
     */
    public function storeRoom(StoreRoomRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request);

        $data = $request->validated();

        $room = Room::create([
            'school_id' => $school->id,
            'code' => trim($data['code']),
            'name' => trim($data['code']),
            'capacity' => $data['capacity'],
            'kind' => RoomKind::Classroom,
        ]);

        $this->audit($request, $school, 'room', $room->id, 'created', $data);

        return back();
    }

    /**
     * The form-master flag on a person follows whether any class names them.
     *
     * @param  array<int, string|null>  $userIds
     */
    protected function syncFormMasterFlags(array $userIds): void
    {
        foreach (array_unique(array_filter($userIds)) as $userId) {
            User::whereKey($userId)->update([
                'is_form_master' => SchoolClass::where('form_master_id', $userId)->exists(),
            ]);
        }
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

    protected function audit(Request $request, School $school, string $entity, string $entityId, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => $entity,
            'entity_id' => $entityId,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
