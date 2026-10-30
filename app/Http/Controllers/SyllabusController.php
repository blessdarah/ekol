<?php

namespace App\Http\Controllers;

use App\Http\Requests\Schemes\SaveSyllabusTopicRequest;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\Scheme;
use App\Models\School;
use App\Models\Subject;
use App\Models\SyllabusTopic;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Step 1 of schemes of work: the topics each subject must cover at
 * each level, with their sub-topics, the term and the weeks they are
 * suggested for. Every teacher's scheme starts from this list, and it
 * is kept from one year to the next.
 */
class SyllabusController extends Controller
{
    public function show(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $levels = Level::where('school_id', $school->id)
            ->when($year, fn ($query) => $query->whereHas('schoolClasses', fn ($inner) => $inner->where('academic_year_id', $year->id)))
            ->orderBy('ordinal')
            ->get(['id', 'name']);
        $level = $levels->firstWhere('id', $request->query('level')) ?? $levels->first();
        $subjects = $level ? $this->subjectsAt($school, $level, $year?->id) : collect();
        $counts = $level
            ? SyllabusTopic::where('level_id', $level->id)->selectRaw('subject_id, count(*) as topics')->groupBy('subject_id')->pluck('topics', 'subject_id')
            : collect();
        $subject = $subjects->firstWhere('id', $request->query('subject')) ?? $subjects->first();
        $topics = $level && $subject
            ? SyllabusTopic::where('level_id', $level->id)->where('subject_id', $subject->id)->with('subtopics')->orderBy('position')->get()
            : collect();

        return Inertia::render('schemes/syllabus', [
            'steps' => Scheme::steps($school, $this->schoolContext->term()),
            'levels' => $levels->map(fn (Level $option) => ['id' => $option->id, 'name' => $option->name])->values(),
            'level' => $level ? ['id' => $level->id, 'name' => $level->name] : null,
            'subjects' => $subjects->map(fn (Subject $option) => [
                'id' => $option->id,
                'name' => $option->name,
                'topics' => (int) ($counts[$option->id] ?? 0),
            ])->values(),
            'subject' => $subject ? ['id' => $subject->id, 'name' => $subject->name] : null,
            'topics' => $topics->map(fn (SyllabusTopic $topic) => [
                'id' => $topic->id,
                'name' => $topic->name,
                'term_sequence' => $topic->term_sequence,
                'week_from' => $topic->week_from,
                'week_to' => $topic->week_to,
                'periods' => $topic->periods,
                'subtopics' => $topic->subtopics->map(fn ($subtopic) => [
                    'id' => $subtopic->id,
                    'name' => $subtopic->name,
                    'periods' => $subtopic->periods,
                ])->values(),
            ])->values(),
        ]);
    }

    public function store(SaveSyllabusTopicRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $data = $request->validated();

        DB::transaction(function () use ($school, $data) {
            $position = (int) SyllabusTopic::where('level_id', $data['level_id'])->where('subject_id', $data['subject_id'])->max('position');
            $topic = SyllabusTopic::create([
                'school_id' => $school->id,
                'level_id' => $data['level_id'],
                'subject_id' => $data['subject_id'],
                'position' => $position + 1,
                ...$this->fields($data),
            ]);
            $this->syncSubtopics($topic, $data['subtopics'] ?? []);
        });

        $this->notify('Topic added.');

        return back();
    }

    public function update(SaveSyllabusTopicRequest $request, string $topic): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = SyllabusTopic::where('school_id', $school->id)->whereKey($topic)->firstOrFail();
        $data = $request->validated();

        DB::transaction(function () use ($target, $data) {
            $target->update($this->fields($data));
            $this->syncSubtopics($target, $data['subtopics'] ?? []);
        });

        $this->notify('Topic saved.');

        return back();
    }

    public function destroy(Request $request, string $topic): RedirectResponse
    {
        $school = $this->schoolContext->school();
        SyllabusTopic::where('school_id', $school->id)->whereKey($topic)->firstOrFail()->delete();

        $this->notify('Topic removed. Schemes already opened keep it.');

        return back();
    }

    /**
     * Swap a topic with the one before or after it.
     */
    public function move(Request $request, string $topic): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = SyllabusTopic::where('school_id', $school->id)->whereKey($topic)->firstOrFail();
        $earlier = $request->input('direction') === 'up';
        $neighbour = SyllabusTopic::where('level_id', $target->level_id)
            ->where('subject_id', $target->subject_id)
            ->where('position', $earlier ? '<' : '>', $target->position)
            ->orderBy('position', $earlier ? 'desc' : 'asc')
            ->first();

        if ($neighbour) {
            DB::transaction(function () use ($target, $neighbour) {
                [$from, $to] = [$target->position, $neighbour->position];
                $target->update(['position' => $to]);
                $neighbour->update(['position' => $from]);
            });
        }

        return back();
    }

    /**
     * The subjects taught at a level this year, in name order.
     *
     * @return Collection<int, Subject>
     */
    protected function subjectsAt(School $school, Level $level, ?string $yearId): Collection
    {
        $subjectIds = ClassSubject::where('school_id', $school->id)
            ->whereHas('schoolClass', fn ($query) => $query
                ->where('level_id', $level->id)
                ->when($yearId, fn ($inner) => $inner->where('academic_year_id', $yearId)))
            ->distinct()
            ->pluck('subject_id');

        return Subject::whereIn('id', $subjectIds)->orderBy('name')->get();
    }

    /**
     * A topic with sub-topics takes as many periods as they add up to.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function fields(array $data): array
    {
        $subtopics = $data['subtopics'] ?? [];

        return [
            'name' => trim($data['name']),
            'term_sequence' => (int) $data['term_sequence'],
            'week_from' => $data['week_from'] ?? null,
            'week_to' => $data['week_to'] ?? $data['week_from'] ?? null,
            'periods' => $subtopics === [] ? (int) $data['periods'] : (int) array_sum(array_column($subtopics, 'periods')),
        ];
    }

    /**
     * Keep the sub-topics as given, in order. Those kept keep their id,
     * so schemes already opened still point at them.
     *
     * @param  array<int, array{id?: string|null, name: string, periods: int}>  $rows
     */
    protected function syncSubtopics(SyllabusTopic $topic, array $rows): void
    {
        $kept = [];

        foreach (array_values($rows) as $index => $row) {
            $fields = ['name' => trim($row['name']), 'periods' => (int) $row['periods'], 'position' => $index + 1];
            $existing = empty($row['id']) ? null : $topic->subtopics()->whereKey($row['id'])->first();

            $kept[] = $existing
                ? tap($existing)->update($fields)->id
                : $topic->subtopics()->create($fields)->id;
        }

        $topic->subtopics()->whereNotIn('id', $kept)->delete();
    }
}
