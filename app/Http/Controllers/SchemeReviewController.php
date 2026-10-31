<?php

namespace App\Http\Controllers;

use App\Enums\SchemeStatus;
use App\Http\Requests\Schemes\ReviewSchemeRequest;
use App\Http\Requests\Schemes\SchemeNoteRequest;
use App\Http\SchemePageData;
use App\Http\SchoolContext;
use App\Models\Scheme;
use App\Models\SchemeEvent;
use App\Models\SchemeItem;
use App\Models\SchemeOpening;
use App\Models\School;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SchemeReviewController extends Controller
{
    public function __construct(SchoolContext $schoolContext, protected SchemePageData $page)
    {
        parent::__construct($schoolContext);
    }

    /**
     * Step 3, and the full page of any scheme: the plan week by week,
     * what the reviewer should check, the history, and the decision.
     */
    public function show(Request $request, string $scheme): Response
    {
        $school = $this->schoolContext->school();
        $target = $this->page->find($school, $scheme);
        $term = $target->term;
        $opening = SchemeOpening::where('term_id', $target->term_id)->first();
        Gate::authorize('view', [$target, $opening]);
        $canApprove = $request->user()->can('approve', [$target, $opening]);

        $next = Scheme::where('term_id', $target->term_id)
            ->where('status', SchemeStatus::Submitted)
            ->whereKeyNot($target->id)
            ->with(['classSubject.subject', 'classSubject.schoolClass'])
            ->orderBy('submitted_at')
            ->get()
            ->first(fn (Scheme $candidate) => $request->user()->can('approve', [$candidate, $opening]));

        return Inertia::render('schemes/show', [
            'steps' => Scheme::steps($school, $this->schoolContext->term()),
            'scheme' => [
                ...$this->page->summary($target),
                'weekly_periods' => (int) $target->classSubject?->weekly_periods,
                'submitted_at' => $target->submitted_at?->toDateString(),
                'approved_at' => $target->approved_at?->toDateString(),
            ],
            'weeks' => $term ? Scheme::weeks($term, $target->classSubject?->schoolClass?->level_id) : [],
            'items' => $target->items->map(fn (SchemeItem $item) => $item->summary())->values(),
            'checks' => $target->checks(),
            'history' => $target->events->map(fn (SchemeEvent $event) => [
                'on' => $event->created_at->toDateString(),
                'action' => $event->action,
                'by' => $event->user?->full_name,
                'note' => $event->note,
            ])->values(),
            'canReview' => $canApprove && $target->status === SchemeStatus::Submitted,
            'nextId' => $next?->id,
        ]);
    }

    public function review(ReviewSchemeRequest $request, string $scheme): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->page->find($school, $scheme);
        $opening = SchemeOpening::where('term_id', $target->term_id)->first();
        Gate::authorize('approve', [$target, $opening]);

        if ($target->status !== SchemeStatus::Submitted) {
            throw ValidationException::withMessages(['decision' => __('This scheme is not waiting for approval.')]);
        }

        $data = $request->validated();
        $note = isset($data['note']) ? trim((string) $data['note']) : null;

        if ($data['decision'] === 'approve') {
            $target->approve($request->user(), $note ?: null);
            $this->notify('Scheme approved.');
        } else {
            $target->sendBack($request->user(), (string) $note);
            $this->notify('Sent back to the teacher with your note.');
        }

        $next = Scheme::where('term_id', $target->term_id)
            ->where('status', SchemeStatus::Submitted)
            ->with(['classSubject.subject', 'classSubject.schoolClass'])
            ->orderBy('submitted_at')
            ->get()
            ->first(fn (Scheme $candidate) => $request->user()->can('approve', [$candidate, $opening]));

        return $next
            ? redirect()->route('schemes.show', $next->id)
            : redirect()->route('schemes', ['state' => 'to_approve']);
    }

    /**
     * A note from the school to the teacher, kept in the scheme's history.
     */
    public function note(SchemeNoteRequest $request, string $scheme): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->page->find($school, $scheme);
        $target->record('note', $request->user(), trim((string) $request->validated('note')));

        $this->notify('Note sent.');

        return back();
    }
}
