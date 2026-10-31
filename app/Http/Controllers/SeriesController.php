<?php

namespace App\Http\Controllers;

use App\Http\Requests\Series\SaveSeriesRequest;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\StudentSeries;
use App\Models\Subject;
use App\Models\Term;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SeriesController extends Controller
{
    /**
     * Levels that may carry series, in school order.
     *
     * @return Collection<int, Level>
     */
    protected function seriesLevels(School $school): Collection
    {
        return Level::where('school_id', $school->id)
            ->where('uses_series', true)
            ->orderBy('ordinal')
            ->get();
    }

    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $levels = $this->seriesLevels($school);
        $level = $levels->firstWhere('id', $request->query('level')) ?? $levels->first();
        $term = Term::where('school_id', $school->id)->where('is_current', true)->first();

        $series = $level
            ? Series::where('level_id', $level->id)->with('subjects:id,name')->orderBy('code')->get()
            : new Collection;

        $registered = $term
            ? StudentSeries::whereIn('series_id', $series->modelKeys())
                ->where('term_id', $term->id)
                ->selectRaw('series_id, COUNT(*) as total')
                ->groupBy('series_id')
                ->pluck('total', 'series_id')
            : collect();

        $enrolled = $level && $year
            ? Enrolment::whereIn('school_class_id', SchoolClass::where('level_id', $level->id)
                ->where('academic_year_id', $year->id)
                ->select('id'))->count()
            : 0;

        return Inertia::render('structure/series', [
            'yearLabel' => $year?->label,
            'levels' => $levels->map(fn (Level $option) => $option->only(['id', 'name'])),
            'level' => $level?->only(['id', 'name']),
            'enrolled' => $enrolled,
            'registered' => (int) $registered->sum(),
            'series' => $series->map(function (Series $item) use ($registered) {
                $core = $item->subjects->where('pivot.kind', 'core');

                return [
                    'id' => $item->id,
                    'code' => $item->code,
                    'name' => $item->name,
                    'stream' => $item->stream ?? 'science',
                    'core' => $core->pluck('name')->values(),
                    'electives' => $item->subjects->count() - $core->count(),
                    'students' => (int) ($registered[$item->id] ?? 0),
                ];
            }),
        ]);
    }

    public function create(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $levels = $this->seriesLevels($school);
        $level = $levels->firstWhere('id', $request->query('level')) ?? $levels->first();

        abort_unless($level !== null, 404);

        return $this->form($school, $level, null);
    }

    public function edit(Request $request, string $series): Response
    {
        $school = $this->schoolContext->school();
        $target = Series::where('school_id', $school->id)->where('id', $series)->firstOrFail();
        $level = Level::where('school_id', $school->id)->where('id', $target->level_id)->firstOrFail();

        return $this->form($school, $level, $target);
    }

    public function store(SaveSeriesRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $level = $this->seriesLevels($school)->firstWhere('id', $request->input('level_id'));

        abort_unless($level !== null, 404);

        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $level, $data) {
            $series = Series::create([
                'school_id' => $school->id,
                'level_id' => $level->id,
                ...$this->attributes($data),
            ]);

            $this->saveSubjects($series, $data);
            $this->spread($school, $series, $data);
            AuditEvent::record($school, $request->user(), 'series', $series->id, 'created', $data);
        });

        $this->notify('Series added.');

        return redirect()->route('classes.series', ['level' => $level->id]);
    }

    public function update(SaveSeriesRequest $request, string $series): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = Series::where('school_id', $school->id)->where('id', $series)->firstOrFail();
        $level = Level::where('school_id', $school->id)->where('id', $target->level_id)->firstOrFail();
        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $target, $data) {
            $target->update($this->attributes($data));
            $this->saveSubjects($target, $data);
            $this->spread($school, $target, $data);
            AuditEvent::record($school, $request->user(), 'series', $target->id, 'configured', $data);
        });

        $this->notify('Series saved.');

        return redirect()->route('classes.series', ['level' => $level->id]);
    }

    protected function form(School $school, Level $level, ?Series $series): Response
    {
        $series?->load('subjects:id');
        $levels = $this->seriesLevels($school);

        $teachers = ClassSubject::where('school_id', $school->id)
            ->whereNotNull('staff_id')
            ->selectRaw('subject_id, COUNT(DISTINCT staff_id) as total')
            ->groupBy('subject_id')
            ->pluck('total', 'subject_id');

        $siblings = $series
            ? Series::where('school_id', $school->id)->where('code', $series->code)->pluck('level_id')->all()
            : [$level->id];

        return Inertia::render('structure/series-edit', [
            'yearLabel' => $this->schoolContext->year()?->label,
            'level' => $level->only(['id', 'name']),
            'levels' => $levels->map(fn (Level $option) => $option->only(['id', 'name'])),
            'series' => $series ? [
                'id' => $series->id,
                'code' => $series->code,
                'name' => $series->name,
                'stream' => $series->stream ?? 'science',
                'min_subjects' => $series->min_subjects,
                'max_subjects' => $series->max_subjects,
                'core' => $this->subjectIds($series, 'core'),
                'electives' => $this->subjectIds($series, 'elective'),
                'level_ids' => $siblings,
            ] : null,
            'subjects' => Subject::where('school_id', $school->id)
                ->orderBy('name')
                ->get()
                ->map(fn (Subject $subject) => [
                    'id' => $subject->id,
                    'code' => $subject->code,
                    'name' => $subject->name,
                    'teachers' => (int) ($teachers[$subject->id] ?? 0),
                ]),
            'others' => Series::where('school_id', $school->id)
                ->when($series, fn ($query) => $query->where('id', '!=', $series->id))
                ->with(['subjects:id', 'level:id,name'])
                ->orderBy('code')
                ->get()
                ->filter(fn (Series $other) => $other->subjects->isNotEmpty())
                ->map(fn (Series $other) => [
                    'id' => $other->id,
                    'label' => "{$other->code} · {$other->name} · {$other->level?->name}",
                    'core' => $this->subjectIds($other, 'core'),
                    'electives' => $this->subjectIds($other, 'elective'),
                ])
                ->values(),
        ]);
    }

    /**
     * Subject ids of one kind, as a plain list. Filtering keeps the
     * original positions, which would otherwise serialize as an object.
     *
     * @return list<string>
     */
    protected function subjectIds(Series $series, string $kind): array
    {
        return array_values($series->subjects->where('pivot.kind', $kind)->modelKeys());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function attributes(array $data): array
    {
        return [
            'code' => mb_strtoupper(trim((string) $data['code'])),
            'name' => trim((string) $data['name']),
            'stream' => $data['stream'],
            'min_subjects' => $data['min_subjects'],
            'max_subjects' => $data['max_subjects'],
        ];
    }

    /**
     * Core wins when a subject is sent in both lists.
     *
     * @param  array<string, mixed>  $data
     */
    protected function saveSubjects(Series $series, array $data): void
    {
        $pivot = [];

        foreach ($data['electives'] as $subjectId) {
            $pivot[$subjectId] = ['kind' => 'elective'];
        }

        foreach ($data['core'] as $subjectId) {
            $pivot[$subjectId] = ['kind' => 'core'];
        }

        $series->subjects()->sync($pivot);
    }

    /**
     * "Applies to levels": the same series, by code, on each other chosen
     * level. Unticking a level leaves its copy alone, because students
     * may already be registered in it.
     *
     * @param  array<string, mixed>  $data
     */
    protected function spread(School $school, Series $series, array $data): void
    {
        foreach (array_diff($data['level_ids'], [$series->level_id]) as $levelId) {
            $copy = Series::where('level_id', $levelId)->where('code', $series->code)->first()
                ?? Series::where('level_id', $levelId)->where('name', $series->name)->first()
                ?? new Series(['school_id' => $school->id, 'level_id' => $levelId]);

            $copy->fill($this->attributes($data))->save();
            $this->saveSubjects($copy, $data);
        }
    }
}
