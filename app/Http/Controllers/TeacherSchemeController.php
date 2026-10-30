<?php

namespace App\Http\Controllers;

use App\Enums\SchemeStatus;
use App\Http\Requests\Schemes\AddSchemeItemRequest;
use App\Http\Requests\Schemes\PlaceSchemeItemRequest;
use App\Http\Requests\Schemes\TickSchemeItemRequest;
use App\Models\Scheme;
use App\Models\SchemeEvent;
use App\Models\SchemeItem;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A teacher's own schemes of work for the term: place each sub-topic
 * in the week it will be taught, submit for approval, then tick what
 * has been taught.
 */
class TeacherSchemeController extends Controller
{
    public function show(Request $request): Response
    {
        $school = $this->school();
        $user = $this->user($request);
        $term = StudentController::currentTerm($school);
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;
        $schemes = $term
            ? Scheme::where('term_id', $term->id)
                ->whereHas('classSubject', fn ($query) => $query->where('staff_id', $user->id))
                ->with(['items', 'events.user:id,full_name', 'classSubject.subject:id,name,department', 'classSubject.schoolClass:id,name,level_id'])
                ->get()
                ->sortBy(fn (Scheme $scheme) => $scheme->classSubject?->subject?->name.' '.$scheme->classSubject?->schoolClass?->name)
                ->values()
            : collect();
        $picked = $schemes->firstWhere('id', $request->query('scheme')) ?? $schemes->first();
        $toApprove = $term && $user->can('follow-schemes')
            ? Scheme::where('term_id', $term->id)->where('status', SchemeStatus::Submitted)
                ->with(['classSubject.subject:id,name,department'])
                ->get()
                ->filter(fn (Scheme $scheme) => $user->can('approve', [$scheme, $opening]))
                ->count()
            : 0;

        return Inertia::render('schemes/mine', [
            'term' => $term ? ['label' => $term->label, 'week' => Scheme::currentWeek($term), 'weeks' => $term->week_count] : null,
            'opening' => $opening ? ['due_on' => $opening->due_on->toDateString(), 'approval' => $opening->approval, 'closed' => $opening->closed_at !== null, 'free_changes' => $opening->free_changes] : null,
            'schemes' => $schemes->map(fn (Scheme $scheme) => [
                'id' => $scheme->id,
                'subject' => $scheme->classSubject?->subject?->name,
                'class' => $scheme->classSubject?->schoolClass?->name,
                'status' => $scheme->status->value,
            ])->values(),
            'scheme' => $picked && $term ? [
                'id' => $picked->id,
                'subject' => $picked->classSubject?->subject?->name,
                'class' => $picked->classSubject?->schoolClass?->name,
                'status' => $picked->status->value,
                'weekly_periods' => (int) $picked->classSubject?->weekly_periods,
                'weeks' => Scheme::weeks($term, $picked->classSubject?->schoolClass?->level_id),
                'items' => $picked->items->map(fn (SchemeItem $item) => SchemeController::item($item))->values(),
                'last_note' => $picked->events->whereIn('action', ['changes_requested', 'note', 'approved'])->whereNotNull('note')->sortByDesc('created_at')->map(fn (SchemeEvent $event) => [
                    'action' => $event->action,
                    'by' => $event->user?->full_name,
                    'on' => $event->created_at->toDateString(),
                    'note' => $event->note,
                ])->first(),
            ] : null,
            'toApprove' => $toApprove,
        ]);
    }

    /**
     * Put a sub-topic in a week, or take it back out of the plan.
     */
    public function place(PlaceSchemeItemRequest $request, string $scheme, string $item): RedirectResponse
    {
        [$target, $opening] = $this->editable($request, $scheme);
        $row = $target->items()->whereKey($item)->firstOrFail();
        $week = $request->validated('week');
        $this->guardWeek($target, $week === null ? null : (int) $week);

        $row->update(['week' => $week]);
        $target->touchPlan($this->user($request), $opening);

        return back();
    }

    /**
     * A sub-topic of the teacher's own, not in the syllabus.
     */
    public function add(AddSchemeItemRequest $request, string $scheme): RedirectResponse
    {
        [$target, $opening] = $this->editable($request, $scheme);
        $data = $request->validated();
        $week = isset($data['week']) ? (int) $data['week'] : null;
        $this->guardWeek($target, $week);

        $target->items()->create([
            'position' => (int) $target->items()->max('position') + 1,
            'topic' => trim($data['topic']),
            'name' => isset($data['name']) && trim($data['name']) !== '' ? trim($data['name']) : null,
            'periods' => (int) $data['periods'],
            'week' => $week,
            'added_by_teacher' => true,
        ]);
        $target->touchPlan($this->user($request), $opening);

        $this->notify('Sub-topic added.');

        return back();
    }

    /**
     * Remove a sub-topic the teacher added. One from the syllabus can only
     * be taken out of the plan, so the reviewer still sees it missing.
     */
    public function remove(Request $request, string $scheme, string $item): RedirectResponse
    {
        [$target, $opening] = $this->editable($request, $scheme);
        $row = $target->items()->whereKey($item)->firstOrFail();

        if (! $row->added_by_teacher) {
            throw ValidationException::withMessages(['item' => __('A sub-topic from the syllabus cannot be removed. Leave it unplaced instead.')]);
        }

        $row->delete();
        $target->touchPlan($this->user($request), $opening);

        return back();
    }

    /**
     * Hand the scheme in for approval.
     */
    public function submit(Request $request, string $scheme): RedirectResponse
    {
        [$target, $opening] = $this->editable($request, $scheme);

        if ($target->items()->whereNotNull('week')->doesntExist()) {
            throw ValidationException::withMessages(['scheme' => __('Place at least one sub-topic in a week before you submit.')]);
        }

        $target->submit($this->user($request), $opening);
        $this->notify($target->status === SchemeStatus::Approved ? 'Scheme submitted. No approval is needed this term.' : 'Scheme submitted for approval.');

        return back();
    }

    /**
     * Tick a sub-topic as taught, or untick it.
     */
    public function tick(TickSchemeItemRequest $request, string $scheme, string $item): RedirectResponse
    {
        $target = $this->owned($request, $scheme);

        if ($target->status !== SchemeStatus::Approved) {
            throw ValidationException::withMessages(['item' => __('Topics can be ticked once the scheme is approved.')]);
        }

        $target->items()->whereKey($item)->firstOrFail()->update(['taught_on' => $request->boolean('taught') ? today() : null]);

        return back();
    }

    protected function school(): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        return $school;
    }

    protected function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return $user;
    }

    /**
     * One of the teacher's own schemes.
     */
    protected function owned(Request $request, string $scheme): Scheme
    {
        $user = $this->user($request);

        return Scheme::where('school_id', $this->school()->id)
            ->whereKey($scheme)
            ->whereHas('classSubject', fn ($query) => $query->where('staff_id', $user->id))
            ->firstOrFail();
    }

    /**
     * One of the teacher's own schemes that can still be changed.
     *
     * @return array{0: Scheme, 1: SchemeOpening|null}
     */
    protected function editable(Request $request, string $scheme): array
    {
        $target = $this->owned($request, $scheme);
        $opening = SchemeOpening::where('term_id', $target->term_id)->first();

        if ($target->status === SchemeStatus::Closed || $opening?->closed_at !== null) {
            throw ValidationException::withMessages(['scheme' => __('This term’s schemes are closed.')]);
        }

        return [$target, $opening];
    }

    protected function guardWeek(Scheme $scheme, ?int $week): void
    {
        $weeks = (int) $scheme->term()->value('week_count');

        if ($week !== null && $week > max(1, $weeks)) {
            throw ValidationException::withMessages(['week' => __('The term has :count weeks.', ['count' => $weeks])]);
        }
    }
}
