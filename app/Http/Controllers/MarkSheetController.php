<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\GradeBand;
use App\Models\Mark;
use App\Models\MarkCorrection;
use App\Models\School;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Marks entry: one sheet is one subject in one class for one
 * assessment. Its teacher fills it while the marks window is open.
 */
class MarkSheetController extends Controller
{
    /**
     * The sheets a teacher has to fill this year.
     */
    public function index(Request $request): Response
    {
        $school = $this->school($request);
        $user = $request->user();
        $year = StructureController::currentYear($school);
        $plans = AssessmentPlan::where('school_id', $school->id)
            ->whereIn('term_id', Term::where('academic_year_id', $year?->id)->select('id'))
            ->where('state', '!=', AssessmentState::Draft)
            ->get()
            ->each(fn (AssessmentPlan $plan) => $plan->refreshState())
            ->keyBy('id');

        $sheets = AssessmentSubject::where('examiner_id', $user?->id)
            ->whereHas('assessment', fn ($query) => $query->whereIn('assessment_plan_id', $plans->keys()))
            ->with(['assessment.schoolClass:id,name', 'subject:id,name'])
            ->withCount(['marks as entered_count' => fn ($query) => $query->where(fn ($inner) => $inner->whereNotNull('score')->orWhere('is_absent', true))])
            ->get();

        return Inertia::render('assessments/sheets', [
            'canManage' => (bool) $user?->role->managesAssessments(),
            'sheets' => $sheets->map(function (AssessmentSubject $sheet) use ($plans) {
                $plan = $plans->get((string) $sheet->assessment?->assessment_plan_id);

                return [
                    'id' => $sheet->id,
                    'subject' => $sheet->subject?->name,
                    'class' => $sheet->assessment?->schoolClass?->name,
                    'plan' => $plan?->name,
                    'state' => $plan?->state->value,
                    'open' => (bool) $plan?->acceptsMarks(),
                    'closes_on' => $plan?->window_ends_on?->toDateString(),
                    'opens_on' => $plan?->window_starts_on?->toDateString(),
                    'entered' => (int) $sheet->getAttribute('entered_count'),
                    'students' => Enrolment::where('school_class_id', $sheet->assessment?->school_class_id)->where('status', '!=', EnrolmentStatus::Left)->count(),
                    'submitted' => $sheet->submitted_at !== null,
                ];
            })->sortBy([['open', 'desc'], ['closes_on', 'asc'], ['class', 'asc']])->values(),
        ]);
    }

    public function show(Request $request, string $sheet): Response
    {
        $school = $this->school($request);
        [$target, $plan] = $this->sheet($request, $school, $sheet);
        $classId = (string) $target->assessment?->school_class_id;

        $siblings = AssessmentSubject::where('subject_id', $target->subject_id)
            ->whereHas('assessment', fn ($query) => $query->where('school_class_id', $classId)->whereNotNull('assessment_plan_id'))
            ->with(['assessment.plan', 'marks'])
            ->get()
            ->filter(fn (AssessmentSubject $option) => $option->assessment?->plan !== null)
            ->sortBy(fn (AssessmentSubject $option) => [
                $option->assessment?->plan?->held_from?->toDateString() ?? '9999',
                $option->assessment?->plan?->name,
            ])
            ->values();
        $position = $siblings->search(fn (AssessmentSubject $option) => $option->id === $target->id);
        $previous = $position !== false && $position > 0 ? $siblings->get($position - 1) : null;
        $marks = $target->marks()->get()->keyBy('student_id');
        $pending = MarkCorrection::whereIn('mark_id', $marks->pluck('id'))->where('status', 'pending')->pluck('new_score', 'mark_id');
        $students = Enrolment::where('school_class_id', $classId)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student')
            ->with('student:id,full_name,admission_no')
            ->get()
            ->map(fn (Enrolment $enrolment) => $enrolment->student)
            ->filter()
            ->sortBy('full_name')
            ->values();

        return Inertia::render('assessments/sheet', [
            'canManage' => (bool) $request->user()?->role->managesAssessments(),
            'passMark' => (float) $school->pass_mark,
            'sheet' => [
                'id' => $target->id,
                'subject' => $target->subject?->name,
                'class' => $target->assessment?->schoolClass?->name,
                'max' => (float) $target->max_score,
                'submitted_on' => $target->submitted_at?->toDateString(),
                'teacher' => $target->examiner?->full_name,
            ],
            'plan' => AssessmentController::summary($plan),
            'open' => $plan->acceptsMarks(),
            'siblings' => $siblings->map(fn (AssessmentSubject $option) => [
                'id' => $option->id,
                'name' => $option->assessment?->plan?->name,
                'state' => $option->assessment?->plan?->state->value,
                'opens_on' => $option->assessment?->plan?->window_starts_on?->toDateString(),
            ]),
            'previous' => $previous?->assessment?->plan?->name,
            'rows' => $students->map(function ($student) use ($marks, $previous, $pending) {
                $mark = $marks->get($student->id);
                $before = $previous?->marks->firstWhere('student_id', $student->id);

                return [
                    'student_id' => $student->id,
                    'name' => $student->full_name,
                    'mark_id' => $mark?->id,
                    'score' => $mark && $mark->score !== null ? (float) $mark->score : null,
                    'absent' => (bool) $mark?->is_absent,
                    'remark' => $mark?->remark,
                    'previous' => $before && $before->score !== null && ! $before->is_absent ? (float) $before->score : null,
                    'correction' => $mark && $pending->has($mark->id) ? (float) $pending->get($mark->id) : null,
                ];
            }),
        ]);
    }

    /**
     * Save a sheet, and hand it in when asked. Marks can only change
     * while the window is open.
     */
    public function update(Request $request, string $sheet): RedirectResponse
    {
        $school = $this->school($request);
        [$target, $plan] = $this->sheet($request, $school, $sheet);

        if (! $plan->acceptsMarks()) {
            throw ValidationException::withMessages([
                'marks' => match ($plan->state) {
                    AssessmentState::Published => 'These results are published. Ask for a correction instead.',
                    AssessmentState::MarksClosed => 'Marks entry is closed for this assessment.',
                    AssessmentState::MarksOpen => 'The marks window ended on '.$plan->window_ends_on?->format('j M').'. Ask the school to extend it.',
                    default => 'Marks are not open for this assessment yet.',
                },
            ]);
        }

        $max = (float) $target->max_score;
        $students = Enrolment::where('school_class_id', $target->assessment?->school_class_id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->pluck('student_id')
            ->all();

        $data = $request->validate([
            'marks' => ['present', 'array'],
            'marks.*.student_id' => ['required', 'distinct', Rule::in($students)],
            'marks.*.score' => ['nullable', 'numeric', 'min:0', "max:{$max}"],
            'marks.*.absent' => ['required', 'boolean'],
            'marks.*.remark' => ['nullable', 'string', 'max:200'],
            'submit' => ['sometimes', 'boolean'],
        ], [
            'marks.*.score.max' => "A mark can't be above {$max}.",
            'marks.*.score.min' => "A mark can't be below 0.",
            'marks.*.score.numeric' => 'Enter the mark as a number.',
        ]);

        $submit = (bool) ($data['submit'] ?? false);
        $filled = collect($this->markRows($data))->filter(fn (array $row) => $row['absent'] || ($row['score'] ?? null) !== null)->pluck('student_id');

        if ($submit && count(array_diff($students, $filled->all())) > 0) {
            $left = count(array_diff($students, $filled->all()));

            throw ValidationException::withMessages([
                'marks' => "Fill {$left} empty ".($left === 1 ? 'mark' : 'marks').' before submitting, or mark the student absent.',
            ]);
        }

        DB::transaction(function () use ($request, $school, $target, $data, $submit, $max) {
            foreach ($this->markRows($data) as $row) {
                $score = $row['absent'] || ($row['score'] ?? null) === null ? null : round((float) $row['score'], 2);
                $band = GradeBand::forScore($school->id, $score !== null ? $score / max(1.0, $max) * AssessmentPlan::OUT_OF : null);

                Mark::updateOrCreate(
                    ['assessment_subject_id' => $target->id, 'student_id' => $row['student_id']],
                    [
                        'score' => $score,
                        'is_absent' => (bool) $row['absent'],
                        'remark' => isset($row['remark']) && trim((string) $row['remark']) !== '' ? trim((string) $row['remark']) : null,
                        'grade_band_id' => $band['id'] ?? null,
                        'entered_by' => $request->user()?->id,
                        'entered_at' => now(),
                    ],
                );
            }

            if ($submit) {
                $target->update(['submitted_at' => now(), 'submitted_by' => $request->user()?->id]);
            }

            AuditEvent::create([
                'school_id' => $school->id,
                'actor_id' => $request->user()?->id,
                'entity' => 'assessment_subject',
                'entity_id' => $target->id,
                'action' => $submit ? 'marks_submitted' : 'marks_saved',
                'diff' => ['marks' => count($data['marks'])],
            ]);
        });

        $this->notify('Marks saved.');

        return back();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{student_id: string, score?: float|int|string|null, absent: bool, remark?: string|null}>
     */
    protected function markRows(array $data): array
    {
        return $data['marks'];
    }

    protected function school(Request $request): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        return $school;
    }

    /**
     * A sheet of this school, for its own teacher or a role that runs
     * assessments.
     *
     * @return array{0: AssessmentSubject, 1: AssessmentPlan}
     */
    protected function sheet(Request $request, School $school, string $id): array
    {
        $sheet = AssessmentSubject::whereKey($id)
            ->whereHas('assessment', fn ($query) => $query->where('school_id', $school->id))
            ->with(['assessment.schoolClass:id,name', 'assessment.plan', 'subject:id,name', 'examiner:id,full_name'])
            ->firstOrFail();
        $plan = $sheet->assessment?->plan;
        $user = $request->user();

        abort_unless($plan !== null, 404);
        abort_unless($user && ($user->role->managesAssessments() || $sheet->examiner_id === $user->id), 403);

        return [$sheet, $plan->refreshState()];
    }
}
