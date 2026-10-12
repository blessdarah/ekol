<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Http\Requests\Assessments\SaveExamPaperRequest;
use App\Models\AssessmentPlan;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\ExamPaper;
use App\Models\Level;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * An exam's timetable: one paper per subject and level, with its day,
 * time, room and invigilators.
 */
class ExamScheduleController extends Controller
{
    /**
     * Rooms and invigilators booked for two papers at the same time.
     *
     * @return list<array{paper_ids: list<string>, text: string}>
     */
    public static function clashes(AssessmentPlan $plan): array
    {
        $papers = $plan->papers()->with(['subject:id,name', 'level:id,name', 'room:id,code'])->get()->values();
        $names = User::whereIn('id', $papers->flatMap(fn (ExamPaper $paper) => $paper->invigilator_ids)->unique()->values())->pluck('full_name', 'id');
        $clashes = [];

        foreach ($papers as $position => $paper) {
            foreach ($papers->slice($position + 1) as $other) {
                if (! $paper->overlaps($other)) {
                    continue;
                }

                $when = $paper->held_on->translatedFormat('D j M').' at '.substr($paper->starts_at, 0, 5);
                $pair = "{$paper->level?->name} {$paper->subject?->name} and {$other->level?->name} {$other->subject?->name}";

                if ($paper->room_id && $paper->room_id === $other->room_id) {
                    $clashes[] = ['paper_ids' => [$paper->id, $other->id], 'text' => "{$paper->room?->code} is used by {$pair} on {$when}"];
                }

                foreach (array_intersect($paper->invigilator_ids, $other->invigilator_ids) as $staffId) {
                    $clashes[] = ['paper_ids' => [$paper->id, $other->id], 'text' => "{$names->get($staffId)} invigilates {$pair} on {$when}"];
                }
            }
        }

        return $clashes;
    }

    public function show(Request $request): Response
    {
        [$school, $year] = AssessmentController::context($request);
        $exams = AssessmentController::plans($school, $year)
            ->filter(fn (AssessmentPlan $plan) => $plan->kind === AssessmentKind::Exam && $plan->state !== AssessmentState::Draft)
            ->values();
        $plan = $exams->firstWhere('id', (string) $request->query('plan', ''))
            ?? $exams->first(fn (AssessmentPlan $option) => $option->schedule_published_at === null)
            ?? $exams->first();

        if (! $plan) {
            return Inertia::render('assessments/schedule', [
                'tabs' => AssessmentController::tabs($school, $year),
                'plans' => [],
                'plan' => null,
            ]);
        }

        $levels = Level::whereIn('id', $plan->level_ids)->orderBy('ordinal')->get();
        $needed = $this->needed($school, $plan);
        $papers = $plan->papers()->with('room:id,code')->get();
        $clashes = static::clashes($plan);
        $clashing = collect($clashes)->flatMap(fn (array $clash) => $clash['paper_ids'])->all();
        $level = $levels->firstWhere('id', (string) $request->query('level', ''))
            ?? $levels->first(fn (Level $option) => $papers->where('level_id', $option->id)->whereIn('id', $clashing)->isNotEmpty())
            ?? $levels->first();
        $staff = User::where('school_id', $school->id)->orderBy('full_name')->get(['id', 'full_name']);
        $missing = $needed->map(fn (Collection $subjects, string $levelId) => $subjects->reject(fn (Subject $subject) => $papers->where('level_id', $levelId)->contains('subject_id', $subject->id))->count());

        return Inertia::render('assessments/schedule', [
            'tabs' => AssessmentController::tabs($school, $year),
            'plans' => $exams->map(fn (AssessmentPlan $option) => AssessmentController::summary($option)),
            'plan' => AssessmentController::summary($plan),
            'levels' => $levels->map(fn (Level $option) => [
                'id' => $option->id,
                'name' => $option->name,
                'missing' => (int) $missing->get($option->id, 0),
                'clash' => $papers->where('level_id', $option->id)->whereIn('id', $clashing)->isNotEmpty(),
            ]),
            'level' => $level ? ['id' => $level->id, 'name' => $level->name] : null,
            'rows' => $level
                ? $needed->get($level->id, new Collection)->map(function (Subject $subject) use ($papers, $level, $clashing, $staff) {
                    $paper = $papers->first(fn (ExamPaper $candidate) => $candidate->level_id === $level->id && $candidate->subject_id === $subject->id);

                    return [
                        'subject_id' => $subject->id,
                        'subject' => $subject->name,
                        'paper' => $paper ? [
                            'id' => $paper->id,
                            'held_on' => $paper->held_on->toDateString(),
                            'starts_at' => substr($paper->starts_at, 0, 5),
                            'hours' => (float) $paper->hours,
                            'room_id' => $paper->room_id,
                            'room' => $paper->room?->code,
                            'invigilator_ids' => $paper->invigilator_ids,
                            'invigilators' => $staff->whereIn('id', $paper->invigilator_ids)->pluck('full_name')->values(),
                            'clash' => in_array($paper->id, $clashing, true),
                        ] : null,
                    ];
                })->sortBy(fn (array $row) => [$row['paper']['held_on'] ?? '9999', $row['paper']['starts_at'] ?? '', $row['subject']])->values()
                : [],
            'rooms' => Room::where('school_id', $school->id)->orderBy('code')->get(['id', 'code', 'capacity']),
            'staff' => $staff->map(fn (User $member) => ['id' => $member->id, 'name' => $member->full_name]),
            'clashes' => array_column($clashes, 'text'),
            'unset' => (int) $missing->sum(),
        ]);
    }

    public function save(SaveExamPaperRequest $request, string $plan): RedirectResponse
    {
        [$school] = AssessmentController::context($request);
        $target = $this->exam($school, $plan);

        if ($target->state === AssessmentState::Published) {
            throw ValidationException::withMessages(['held_on' => __('This exam is published. Its schedule can no longer change.')]);
        }

        $data = $request->validated();

        $paper = ExamPaper::updateOrCreate(
            ['assessment_plan_id' => $target->id, 'level_id' => $data['level_id'], 'subject_id' => $data['subject_id']],
            [
                'held_on' => $data['held_on'],
                'starts_at' => $data['starts_at'],
                'hours' => $data['hours'],
                'room_id' => $data['room_id'] ?? null,
                'invigilator_ids' => array_values($data['invigilator_ids']),
            ],
        );

        $this->audit($request, $school, $target, 'paper_saved', $paper->only(['level_id', 'subject_id', 'held_on', 'starts_at', 'room_id']));

        $this->notify('Paper saved.');

        return back();
    }

    public function destroy(Request $request, string $plan, string $paper): RedirectResponse
    {
        [$school] = AssessmentController::context($request);
        $target = $this->exam($school, $plan);

        $target->papers()->whereKey($paper)->delete();
        $this->audit($request, $school, $target, 'paper_removed', ['paper' => $paper]);

        $this->notify('Paper removed.');

        return back();
    }

    /**
     * Publish the exam timetable: every subject needs a paper and
     * nothing may clash.
     */
    public function publish(Request $request, string $plan): RedirectResponse
    {
        [$school] = AssessmentController::context($request);
        $target = $this->exam($school, $plan);
        $papers = $target->papers()->get();
        $unset = $this->needed($school, $target)
            ->map(fn (Collection $subjects, string $levelId) => $subjects->reject(fn (Subject $subject) => $papers->where('level_id', $levelId)->contains('subject_id', $subject->id))->count())
            ->sum();

        if ($papers->isEmpty() || $unset > 0) {
            throw ValidationException::withMessages(['publish' => $unset > 0
                ? trans_choice('{1} :count subject still has no paper.|[2,*] :count subjects still have no paper.', $unset, ['count' => $unset])
                : __('Add the papers first.')]);
        }

        if (static::clashes($target) !== []) {
            throw ValidationException::withMessages(['publish' => __('Clear the clashes before publishing the schedule.')]);
        }

        $target->update(['schedule_published_at' => now()]);
        $this->audit($request, $school, $target, 'schedule_published', ['papers' => $papers->count()]);

        $this->notify('Exam schedule published.');

        return redirect()->route('assessments');
    }

    /**
     * The subjects each of the plan's levels takes, which each need a paper.
     *
     * @return \Illuminate\Support\Collection<string, Collection<int, Subject>>
     */
    protected function needed(School $school, AssessmentPlan $plan): \Illuminate\Support\Collection
    {
        $yearId = Term::whereKey($plan->term_id)->value('academic_year_id');
        $classes = SchoolClass::where('school_id', $school->id)->where('academic_year_id', $yearId)->whereIn('level_id', $plan->level_ids)->get(['id', 'level_id']);
        $lessons = ClassSubject::whereIn('school_class_id', $classes->modelKeys())->whereHas('subject')->with('subject:id,name')->get();
        $needed = collect();

        foreach ($plan->level_ids as $levelId) {
            $needed->put($levelId, new Collection(
                $lessons->whereIn('school_class_id', $classes->where('level_id', $levelId)->modelKeys())
                    ->map(fn (ClassSubject $lesson) => $lesson->subject)
                    ->filter()
                    ->unique('id')
                    ->sortBy('name')
                    ->values()
                    ->all(),
            ));
        }

        return $needed;
    }

    protected function exam(School $school, string $id): AssessmentPlan
    {
        return AssessmentPlan::where('school_id', $school->id)->where('kind', AssessmentKind::Exam)->where('id', $id)->firstOrFail();
    }

    protected function audit(Request $request, School $school, AssessmentPlan $plan, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'assessment_plan',
            'entity_id' => $plan->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
