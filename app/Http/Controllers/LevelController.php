<?php

namespace App\Http\Controllers;

use App\Http\Requests\Structure\StoreLevelRequest;
use App\Http\Requests\Structure\StoreLevelTemplatesRequest;
use App\Http\Requests\Structure\UpdateLevelRequest;
use App\Models\AuditEvent;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LevelController extends Controller
{
    public function createLevel(Request $request): Response
    {
        $school = $this->schoolContext->school();

        return Inertia::render('structure/level-create', [
            'yearLabel' => $this->schoolContext->year()?->label,
            'hasYear' => $this->schoolContext->year() !== null,
            'defaultSubsystem' => $school->subsystem === 'francophone' ? 'francophone' : 'anglophone',
        ]);
    }

    public function storeLevel(StoreLevelRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();

        $data = $request->validated();

        if ($data['uses_series'] && ! Level::seriesAllowed($data['cycle'], $data['subsystem'])) {
            throw ValidationException::withMessages([
                'uses_series' => __('Series are only for high school levels in the GCE subsystem.'),
            ]);
        }

        if ($data['class_count'] > 0 && ! $year) {
            throw ValidationException::withMessages([
                'class_count' => __('Classes belong to an academic year. Make a year active in School Setup first.'),
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
                    'name' => SchoolClass::nameFor($level->name, $letter),
                    'capacity' => SchoolClass::DEFAULT_SEATS,
                ]);
            }

            AuditEvent::record($school, $request->user(), 'level', $level->id, 'created', [
                'name' => $level->name,
                'classes' => $data['class_count'],
            ]);

            return $level;
        });

        $this->notify('Level added.');

        return redirect()->route('classes', ['level' => $level->id]);
    }

    public function levelTemplates(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $existing = Level::withTrashed()->where('school_id', $school->id)->get(['name', 'code']);

        return Inertia::render('structure/level-templates', [
            'yearLabel' => $year?->label,
            'hasYear' => $year !== null,
            'defaultSeats' => SchoolClass::DEFAULT_SEATS,
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
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $set = $this->levelTemplateSets()[$request->string('set')->toString()] ?? null;

        abort_unless($set !== null, 404);

        $data = $request->validated();

        /** Requested class counts, keyed by level code. */
        $counts = Arr::pluck($data['levels'], 'class_count', 'code');

        if (array_sum($counts) > 0 && ! $year) {
            throw ValidationException::withMessages([
                'levels' => __('Classes belong to an academic year. Make a year active in School Setup first.'),
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
                    'uses_series' => $usesSeries && Level::seriesAllowed($cycle, $set['subsystem']),
                ]);

                foreach (array_slice(range('A', 'Z'), 0, $year ? (int) $counts[$code] : 0) as $letter) {
                    SchoolClass::create([
                        'school_id' => $school->id,
                        'academic_year_id' => $year?->id,
                        'level_id' => $level->id,
                        'name' => SchoolClass::nameFor($name, $letter),
                        'capacity' => SchoolClass::DEFAULT_SEATS,
                    ]);
                }

                AuditEvent::record($school, $request->user(), 'level', $level->id, 'created', [
                    'name' => $name,
                    'classes' => (int) $counts[$code],
                    'template' => true,
                ]);
            }
        });

        $this->notify('Levels created.');

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
        $school = $this->schoolContext->school();
        $target = Level::where('school_id', $school->id)->where('id', $level)->firstOrFail();

        $data = $request->validated();

        if ($data['uses_series'] && ! Level::seriesAllowed($target->cycle, $target->subsystem)) {
            throw ValidationException::withMessages([
                'uses_series' => __('Series are only for high school levels in the GCE subsystem.'),
            ]);
        }

        $target->update($data);
        AuditEvent::record($school, $request->user(), 'level', $target->id, 'series_toggled', $data);

        $this->notify('Level saved.');

        return back();
    }
}
