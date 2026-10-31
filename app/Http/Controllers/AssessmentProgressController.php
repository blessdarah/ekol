<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Http\Requests\Assessments\ExtendMarksWindowRequest;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AssessmentProgressController extends Controller
{
    public function progress(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $plans = AssessmentPlan::forYear($school, $year)->filter(fn (AssessmentPlan $plan) => $plan->state !== AssessmentState::Draft)->values();
        $plan = $plans->firstWhere('id', (string) $request->query('plan', ''))
            ?? $plans->firstWhere('state', AssessmentState::MarksOpen)
            ?? $plans->last(fn (AssessmentPlan $option) => in_array($option->state, [AssessmentState::MarksClosed, AssessmentState::Published], true))
            ?? $plans->first();

        if ($plan && in_array($plan->state, [AssessmentState::Scheduled, AssessmentState::MarksOpen], true)) {
            $plan->sync();
        }

        $sheets = $plan ? $plan->sheets() : new Collection;
        $unsubmitted = $sheets->whereNull('submitted_at');
        $sizes = Enrolment::whereIn('school_class_id', $sheets->map(fn (AssessmentSubject $sheet) => $sheet->assessment?->school_class_id)->filter()->unique())
            ->where('status', '!=', EnrolmentStatus::Left)
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id');
        $missing = fn (AssessmentSubject $sheet) => [
            'sheet_id' => $sheet->id,
            'subject_id' => $sheet->subject_id,
            'subject' => $sheet->subject?->name,
            'class' => $sheet->assessment?->schoolClass?->name,
            'teacher' => $sheet->examiner?->full_name,
            'initials' => $sheet->examiner?->initials,
            'entered' => (int) $sheet->getAttribute('entered_count'),
            'students' => (int) ($sizes[$sheet->assessment?->school_class_id] ?? 0),
        ];

        return Inertia::render('assessments/progress', [
            'tabs' => AssessmentPlan::tabs($school, $year),
            'plans' => $plans->map(fn (AssessmentPlan $option) => $option->summary()),
            'plan' => $plan ? $plan->summary() : null,
            'acceptsMarks' => (bool) $plan?->acceptsMarks(),
            'termEnds' => $plan?->term()->value('ends_on')?->toDateString(),
            'stats' => [
                'submitted' => $sheets->count() - $unsubmitted->count(),
                'total' => $sheets->count(),
                'teachers' => $unsubmitted->pluck('examiner_id')->filter()->unique()->count(),
                'unstaffed' => $unsubmitted->whereNull('examiner_id')->count(),
            ],
            'classes' => $sheets
                ->groupBy(fn (AssessmentSubject $sheet) => (string) $sheet->assessment?->school_class_id)
                ->map(function (Collection $mine) use ($missing) {
                    $class = $mine->first()?->assessment?->schoolClass;

                    return [
                        'id' => $class?->id,
                        'name' => (string) $class?->name,
                        'form_master' => $class?->formMaster?->full_name,
                        'submitted' => $mine->whereNotNull('submitted_at')->count(),
                        'total' => $mine->count(),
                        'missing' => $mine->whereNull('submitted_at')->map($missing)->sortBy('subject')->values(),
                    ];
                })
                ->sortBy('name')
                ->values(),
            'teachers' => $unsubmitted
                ->groupBy(fn (AssessmentSubject $sheet) => (string) $sheet->examiner_id)
                ->map(function (Collection $mine, string $examiner) use ($missing) {
                    $teacher = $mine->first()?->examiner;

                    return [
                        'id' => $examiner === '' ? null : $examiner,
                        'name' => $teacher?->full_name,
                        'initials' => $teacher?->initials,
                        'phone' => $teacher?->phone,
                        'missing' => $mine->map($missing)->sortBy([['class', 'asc'], ['subject', 'asc']])->values(),
                    ];
                })
                ->sortBy([
                    fn (array $a, array $b) => ($a['id'] === null) <=> ($b['id'] === null),
                    fn (array $a, array $b) => count($b['missing']) <=> count($a['missing']),
                    fn (array $a, array $b) => strcmp((string) $a['name'], (string) $b['name']),
                ])
                ->values(),
        ]);
    }

    /**
     * Close marks entry: teachers can no longer enter marks and the
     * results open for review. Nothing is published yet.
     */
    public function close(Request $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = AssessmentPlan::forSchool($school->id)->whereKey($plan)->with('term')->firstOrFail()->refreshState();

        if ($target->state !== AssessmentState::MarksOpen) {
            throw ValidationException::withMessages(['close' => __('Marks are not open for :name.', ['name' => $target->name])]);
        }

        $target->moveTo(AssessmentState::MarksClosed, ['closed_at' => now()]);
        AuditEvent::record($school, $request->user(), 'assessment_plan', $target->id, 'marks_closed', []);

        $this->notify('Marks entry closed.');

        return redirect()->route('assessments.results', ['plan' => $target->id]);
    }

    /**
     * Move the day the marks window closes. Extending a closed window
     * reopens marks entry, until results are published.
     */
    public function window(ExtendMarksWindowRequest $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = AssessmentPlan::forSchool($school->id)->whereKey($plan)->with('term')->firstOrFail()->refreshState();

        if (! in_array($target->state, [AssessmentState::Scheduled, AssessmentState::MarksOpen, AssessmentState::MarksClosed], true)) {
            throw ValidationException::withMessages([
                'window_ends_on' => $target->state === AssessmentState::Published
                    ? __('Results are published, so the window cannot be reopened. Use Corrections.')
                    : __('Schedule the assessment first.'),
            ]);
        }

        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $target, $data) {
            $before = $target->window_ends_on?->toDateString();
            $target->update(['window_ends_on' => $data['window_ends_on']]);
            $target->assessments()->update(['window_ends_on' => $data['window_ends_on']]);

            if ($target->state === AssessmentState::MarksClosed) {
                $target->moveTo(AssessmentState::MarksOpen, ['closed_at' => null]);
            }

            AuditEvent::record($school, $request->user(), 'assessment_plan', $target->id, 'window_moved', ['from' => $before, 'to' => $data['window_ends_on']]);
        });

        $this->notify('Marks window updated.');

        return back();
    }
}
