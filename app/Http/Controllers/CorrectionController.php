<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Http\Requests\Assessments\DecideCorrectionRequest;
use App\Http\Requests\Assessments\RequestCorrectionRequest;
use App\Models\AssessmentPlan;
use App\Models\AuditEvent;
use App\Models\Mark;
use App\Models\MarkCorrection;
use App\Models\School;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Corrections to published marks: a teacher asks, the principal
 * approves or declines, and every step is kept.
 */
class CorrectionController extends Controller
{
    public function index(Request $request): Response
    {
        [$school, $year] = AssessmentController::context($request);
        $show = $request->query('show') === 'decided' ? 'decided' : 'pending';
        $all = MarkCorrection::where('school_id', $school->id)
            ->with(['mark.student:id,full_name', 'mark.assessmentSubject.subject:id,name', 'mark.assessmentSubject.assessment.plan', 'mark.assessmentSubject.assessment.schoolClass:id,name', 'mark.assessmentSubject.coefficient', 'requester:id,full_name', 'decider:id,full_name'])
            ->latest()
            ->get();
        $listed = $all->filter(fn (MarkCorrection $correction) => ($correction->status === 'pending') === ($show === 'pending'))->values();
        $current = $listed->firstWhere('id', (string) $request->query('id', '')) ?? $listed->first();

        return Inertia::render('assessments/corrections', [
            'tabs' => AssessmentController::tabs($school, $year),
            'show' => $show,
            'counts' => ['pending' => $all->where('status', 'pending')->count(), 'decided' => $all->where('status', '!=', 'pending')->count()],
            'canDecide' => (bool) $request->user()?->role->managesStaff(),
            'list' => $listed->map(fn (MarkCorrection $correction) => [
                'id' => $correction->id,
                'reference' => $correction->reference,
                'student' => $correction->mark?->student?->full_name,
                'subject' => $correction->mark?->assessmentSubject?->subject?->name,
                'plan' => $correction->mark?->assessmentSubject?->assessment?->plan?->name,
                'old' => $correction->old_score !== null ? (float) $correction->old_score : null,
                'new' => (float) $correction->new_score,
                'status' => $correction->status,
            ]),
            'current' => $current ? $this->detail($current) : null,
        ]);
    }

    /**
     * Ask for a published mark to be changed.
     */
    public function store(RequestCorrectionRequest $request): RedirectResponse
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;
        $user = $request->user();

        if (! $school instanceof School) {
            abort(404);
        }

        $data = $request->validated();

        $mark = Mark::whereKey($data['mark_id'])
            ->whereHas('assessmentSubject.assessment', fn ($query) => $query->where('school_id', $school->id))
            ->with('assessmentSubject.assessment.plan')
            ->firstOrFail();
        $sheet = $mark->assessmentSubject;
        $plan = $sheet?->assessment?->plan;

        abort_unless($user && $sheet && ($user->role->managesAssessments() || $sheet->examiner_id === $user->id), 403);

        if ($plan?->state !== AssessmentState::Published) {
            throw ValidationException::withMessages(['new_score' => __('A correction is for a published mark. This one can still be edited on its sheet.')]);
        }

        if ((float) $data['new_score'] > (float) $sheet->max_score) {
            throw ValidationException::withMessages(['new_score' => __('A mark can\'t be above :max_score.', ['max_score' => (float) $sheet->max_score])]);
        }

        if ($mark->score !== null && abs((float) $mark->score - (float) $data['new_score']) < 0.001) {
            throw ValidationException::withMessages(['new_score' => __('That is the mark already published.')]);
        }

        if (MarkCorrection::where('mark_id', $mark->id)->where('status', 'pending')->exists()) {
            throw ValidationException::withMessages(['new_score' => __('A correction for this mark is already waiting for the principal.')]);
        }

        $correction = MarkCorrection::create([
            'school_id' => $school->id,
            'mark_id' => $mark->id,
            'reference' => MarkCorrection::nextReference($school->id),
            'old_score' => $mark->score,
            'new_score' => round((float) $data['new_score'], 2),
            'reason' => trim($data['reason']),
            'status' => 'pending',
            'requested_by' => $user->id,
        ]);

        $this->audit($request, $school, $correction, 'requested');

        $this->notify('Correction requested.');

        return back();
    }

    public function decide(DecideCorrectionRequest $request, string $correction): RedirectResponse
    {
        [$school] = AssessmentController::context($request);
        $user = $request->user();
        abort_unless($user !== null && $user->role->managesStaff(), 403);

        $target = MarkCorrection::where('school_id', $school->id)->where('id', $correction)->with('mark')->firstOrFail();
        $data = $request->validated();

        if ($target->status !== 'pending') {
            throw ValidationException::withMessages(['decision' => __('This correction has already been decided.')]);
        }

        DB::transaction(function () use ($request, $school, $target, $data, $user) {
            $approved = $data['decision'] === 'approve';

            $target->update([
                'status' => $approved ? 'approved' : 'declined',
                'decided_by' => $user->id,
                'decided_at' => now(),
                'note' => isset($data['note']) ? trim($data['note']) : null,
            ]);

            if ($approved) {
                $target->mark?->update(['score' => $target->new_score, 'is_absent' => false]);
            }

            $this->audit($request, $school, $target, $approved ? 'approved' : 'declined');
        });

        $this->notify('Decision recorded.');

        return redirect()->route('assessments.corrections');
    }

    /**
     * One correction in full, with what approving it would change.
     *
     * @return array<string, mixed>
     */
    protected function detail(MarkCorrection $correction): array
    {
        $mark = $correction->mark;
        $sheet = $mark?->assessmentSubject;
        $assessment = $sheet?->assessment;
        $plan = $assessment?->plan;
        $class = $assessment?->schoolClass;
        $impact = null;

        if ($mark && $plan && $class && $correction->status === 'pending') {
            $standings = $plan->standings($class);
            $average = fn (array $row) => (float) $row['average'];
            $complete = fn (array $rows) => array_map($average, array_filter($rows, fn (array $row) => $row['complete']));
            $before = AssessmentPlan::rank($complete($standings));
            $mine = $standings[$mark->student_id] ?? null;

            if ($mine) {
                $weights = 0.0;
                $weighted = 0.0;

                foreach ($mine['subjects'] as $subject) {
                    $score = $subject['mark_id'] === $mark->id ? (float) $correction->new_score : $subject['score'];

                    if ($score !== null && ! ($subject['absent'] && $subject['mark_id'] !== $mark->id)) {
                        $weighted += $score * $subject['coefficient'];
                        $weights += $subject['coefficient'];
                    }
                }

                $after = $standings;
                $after[$mark->student_id]['average'] = $weights > 0 ? round($weighted / $weights, 2) : null;
                $ranks = AssessmentPlan::rank($complete($after));

                $impact = [
                    'average_from' => $mine['average'],
                    'average_to' => $after[$mark->student_id]['average'],
                    'position_from' => $before[$mark->student_id] ?? null,
                    'position_to' => $ranks[$mark->student_id] ?? null,
                ];
            }
        }

        return [
            'id' => $correction->id,
            'reference' => $correction->reference,
            'status' => $correction->status,
            'student' => $mark?->student?->full_name,
            'subject' => $sheet?->subject?->name,
            'class' => $class?->name,
            'plan' => $plan?->name,
            'coefficient' => (float) $sheet?->coefficient?->sequence_coeff,
            'old' => $correction->old_score !== null ? (float) $correction->old_score : null,
            'new' => (float) $correction->new_score,
            'reason' => $correction->reason,
            'asked_by' => $correction->requester?->full_name,
            'asked_on' => $correction->created_at->toDateString(),
            'decided_by' => $correction->decider?->full_name,
            'decided_on' => $correction->decided_at?->toDateString(),
            'note' => $correction->note,
            'published_on' => $plan?->published_at?->toDateString(),
            'impact' => $impact,
        ];
    }

    protected function audit(Request $request, School $school, MarkCorrection $correction, string $action): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'mark_correction',
            'entity_id' => $correction->id,
            'action' => $action,
            'diff' => $correction->only(['reference', 'old_score', 'new_score', 'status', 'note']),
        ]);
    }
}
