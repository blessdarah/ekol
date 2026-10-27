<?php

namespace App\Http\Controllers;

use App\Enums\SchemeStatus;
use App\Http\Requests\Schemes\CloseSchemesRequest;
use App\Http\Requests\Schemes\OpenSchemesRequest;
use App\Http\Requests\Schemes\ReviewSchemeRequest;
use App\Http\Requests\Schemes\SchemeNoteRequest;
use App\Models\ClassSubject;
use App\Models\Scheme;
use App\Models\SchemeEvent;
use App\Models\SchemeItem;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\SyllabusTopic;
use App\Models\Term;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Schemes of work for the school: open them for a term, review what
 * teachers submit, follow what is taught against the plan, and close
 * the term with its coverage.
 */
class SchemeController extends Controller
{
    protected const array FILTERS = ['all', 'to_approve', 'behind', 'not_submitted'];

    /**
     * The bound school, for a signed-in user who follows schemes, or
     * manages them when asked.
     */
    public static function schoolFor(Request $request, bool $manage = false): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        $role = $request->user()?->role;
        abort_unless($manage ? (bool) $role?->managesSchemes() : (bool) $role?->followsSchemes(), 403);

        return $school;
    }

    /**
     * Where the school is in the five steps, for the step bar.
     *
     * @return array{term: array{id: string, label: string, week: int|null, weeks: int}|null, syllabus: bool, opened: bool, to_approve: int, closed: bool}
     */
    public static function steps(School $school): array
    {
        $term = StudentController::currentTerm($school);
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;

        return [
            'term' => $term ? ['id' => $term->id, 'label' => $term->label, 'week' => Scheme::currentWeek($term), 'weeks' => $term->week_count] : null,
            'syllabus' => SyllabusTopic::where('school_id', $school->id)->exists(),
            'opened' => $opening !== null,
            'to_approve' => $term ? Scheme::where('term_id', $term->id)->where('status', SchemeStatus::Submitted)->count() : 0,
            'closed' => $opening?->closed_at !== null,
        ];
    }

    /**
     * Step 4, and the home of schemes of work: every scheme of the term,
     * how far it has got, and the one picked in the side panel.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        $school = static::schoolFor($request);
        $term = StudentController::currentTerm($school);
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;

        if (! $term || ! $opening) {
            return $request->user()?->role->managesSchemes()
                ? redirect()->route(SyllabusTopic::where('school_id', $school->id)->exists() ? 'schemes.open' : 'schemes.syllabus')
                : redirect()->route('dashboard');
        }

        $week = Scheme::currentWeek($term);
        $schemes = $this->schemesOf($term)->filter(fn (Scheme $scheme) => $scheme->canBeApprovedBy($request->user(), $opening) || $request->user()->role->managesSchemes());
        $states = $schemes->mapWithKeys(fn (Scheme $scheme) => [$scheme->id => $scheme->followState($week)]);
        $filter = in_array($request->query('show'), static::FILTERS, true) ? (string) $request->query('show') : 'all';
        $listed = $schemes->filter(fn (Scheme $scheme) => match ($filter) {
            'to_approve' => $states[$scheme->id] === 'to_approve',
            'behind' => $states[$scheme->id] === 'behind',
            'not_submitted' => in_array($states[$scheme->id], ['not_submitted', 'sent_back'], true),
            default => true,
        })->sortBy(fn (Scheme $scheme) => [array_search($states[$scheme->id], ['to_approve', 'behind', 'sent_back', 'not_submitted', 'waiting', 'on_track', 'closed'], true), $this->title($scheme)])->values();
        $picked = $schemes->firstWhere('id', $request->query('scheme'));

        return Inertia::render('schemes/index', [
            'steps' => static::steps($school),
            'week' => $week,
            'dueOn' => $opening->due_on->toDateString(),
            'canManage' => $request->user()->role->managesSchemes(),
            'totals' => [
                'all' => $schemes->count(),
                'submitted' => $schemes->filter(fn (Scheme $scheme) => $scheme->status->isSubmitted())->count(),
                'to_approve' => $states->filter(fn (string $state) => $state === 'to_approve')->count(),
                'behind' => $states->filter(fn (string $state) => $state === 'behind')->count(),
                'not_submitted' => $states->filter(fn (string $state) => in_array($state, ['not_submitted', 'sent_back'], true))->count(),
            ],
            'filters' => ['show' => $filter],
            'rows' => $listed->map(fn (Scheme $scheme) => [
                ...$this->summary($scheme),
                'state' => $states[$scheme->id],
                'progress' => $scheme->progressTo($week),
            ])->values(),
            'picked' => $picked ? $this->panel($picked, $week, $states[$picked->id]) : null,
        ]);
    }

    /**
     * Step 2: what opening the term's schemes would create.
     */
    public function opening(Request $request): Response|RedirectResponse
    {
        $school = static::schoolFor($request, manage: true);
        $term = StudentController::currentTerm($school);

        if (! $term) {
            return redirect()->route('setup');
        }

        $opening = SchemeOpening::where('term_id', $term->id)->first();
        $existing = Scheme::where('term_id', $term->id)->pluck('class_subject_id');
        $classSubjects = ClassSubject::where('school_id', $school->id)
            ->whereHas('schoolClass', fn ($query) => $query->where('academic_year_id', $term->academic_year_id))
            ->whereNotIn('id', $existing)
            ->with(['schoolClass.level:id,name', 'subject:id,name'])
            ->get();
        $withSyllabus = SyllabusTopic::where('school_id', $school->id)
            ->where('term_sequence', $term->sequence)
            ->get(['level_id', 'subject_id'])
            ->map(fn (SyllabusTopic $topic) => $topic->level_id.'|'.$topic->subject_id)
            ->unique();
        $empty = $classSubjects
            ->reject(fn (ClassSubject $classSubject) => $withSyllabus->contains($classSubject->schoolClass?->level_id.'|'.$classSubject->subject_id))
            ->map(fn (ClassSubject $classSubject) => $classSubject->subject?->name.' · '.$classSubject->schoolClass?->level?->name)
            ->unique()
            ->values();

        return Inertia::render('schemes/open', [
            'steps' => static::steps($school),
            'term' => [
                'id' => $term->id,
                'label' => $term->label,
                'starts_on' => $term->starts_on->toDateString(),
                'ends_on' => $term->ends_on->toDateString(),
                'weeks' => $term->week_count,
            ],
            'opening' => $opening ? [
                'due_on' => $opening->due_on->toDateString(),
                'approval' => $opening->approval,
                'starts_from' => $opening->starts_from,
                'free_changes' => $opening->free_changes,
            ] : null,
            'suggestedDueOn' => $term->starts_on->copy()->addDays(18)->toDateString(),
            'creates' => [
                'schemes' => $classSubjects->count(),
                'classes' => $classSubjects->pluck('school_class_id')->unique()->count(),
                'with_teacher' => $classSubjects->whereNotNull('staff_id')->count(),
                'without_teacher' => $classSubjects->whereNull('staff_id')->map(fn (ClassSubject $classSubject) => $classSubject->subject?->name.' · '.$classSubject->schoolClass?->name)->values(),
                'empty_syllabus' => $empty,
            ],
        ]);
    }

    public function open(OpenSchemesRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request, manage: true);
        $term = StudentController::currentTerm($school);

        if (! $term) {
            return redirect()->route('setup');
        }

        $data = $request->validated();
        $opening = SchemeOpening::updateOrCreate(['term_id' => $term->id], [
            'school_id' => $school->id,
            'due_on' => $data['due_on'],
            'approval' => $data['approval'],
            'starts_from' => $data['starts_from'],
            'free_changes' => (bool) $data['free_changes'],
            'opened_by' => $request->user()?->id,
        ]);

        if ($opening->closed_at !== null) {
            throw ValidationException::withMessages(['due_on' => __(':term schemes are closed.', ['term' => __($term->label)])]);
        }

        $created = Scheme::openFor($opening, $request->user());
        $this->notify(trans_choice('{0} Settings saved. No new schemes to open.|{1} :count scheme opened.|[2,*] :count schemes opened.', $created));

        return redirect()->route('schemes');
    }

    /**
     * Step 3, and the full page of any scheme: the plan week by week,
     * what the reviewer should check, the history, and the decision.
     */
    public function show(Request $request, string $scheme): Response
    {
        $school = static::schoolFor($request);
        $target = $this->find($school, $scheme);
        $term = $target->term;
        $opening = SchemeOpening::where('term_id', $target->term_id)->first();
        $canApprove = $target->canBeApprovedBy($request->user(), $opening);
        abort_unless($canApprove || $request->user()->role->managesSchemes(), 403);

        $next = Scheme::where('term_id', $target->term_id)
            ->where('status', SchemeStatus::Submitted)
            ->whereKeyNot($target->id)
            ->with(['classSubject.subject', 'classSubject.schoolClass'])
            ->orderBy('submitted_at')
            ->get()
            ->first(fn (Scheme $candidate) => $candidate->canBeApprovedBy($request->user(), $opening));

        return Inertia::render('schemes/show', [
            'steps' => static::steps($school),
            'scheme' => [
                ...$this->summary($target),
                'weekly_periods' => (int) $target->classSubject?->weekly_periods,
                'submitted_at' => $target->submitted_at?->toDateString(),
                'approved_at' => $target->approved_at?->toDateString(),
            ],
            'weeks' => $term ? Scheme::weeks($term, $target->classSubject?->schoolClass?->level_id) : [],
            'items' => $target->items->map(fn (SchemeItem $item) => $this->item($item))->values(),
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
        $school = static::schoolFor($request);
        $target = $this->find($school, $scheme);
        $opening = SchemeOpening::where('term_id', $target->term_id)->first();
        abort_unless($target->canBeApprovedBy($request->user(), $opening), 403);

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
            ->first(fn (Scheme $candidate) => $candidate->canBeApprovedBy($request->user(), $opening));

        return $next
            ? redirect()->route('schemes.show', $next->id)
            : redirect()->route('schemes', ['show' => 'to_approve']);
    }

    /**
     * A note from the school to the teacher, kept in the scheme's history.
     */
    public function note(SchemeNoteRequest $request, string $scheme): RedirectResponse
    {
        $school = static::schoolFor($request);
        $target = $this->find($school, $scheme);
        $target->record('note', $request->user(), trim((string) $request->validated('note')));

        $this->notify('Note sent.');

        return back();
    }

    /**
     * Step 5: how much of each plan was taught, before the term closes.
     */
    public function closing(Request $request): Response|RedirectResponse
    {
        $school = static::schoolFor($request, manage: true);
        $term = StudentController::currentTerm($school);
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;

        if (! $term || ! $opening) {
            return redirect()->route('schemes');
        }

        $schemes = $this->schemesOf($term);
        $below = in_array($request->query('show'), ['all', 'below'], true) ? (string) $request->query('show') : 'below';
        $rows = $schemes
            ->map(fn (Scheme $scheme) => [
                ...$this->summary($scheme),
                'taught' => $scheme->items->whereNotNull('taught_on')->count(),
                'total' => $scheme->items->count(),
                'coverage' => $scheme->coverage(),
                'carries' => $scheme->untaughtLabels()->all(),
            ])
            ->sortBy('coverage')
            ->values();
        $items = $schemes->flatMap->items;
        $nextTerm = Term::where('academic_year_id', $term->academic_year_id)->where('sequence', $term->sequence + 1)->first();
        $lastWeek = collect(Scheme::weeks($term))->last();

        return Inertia::render('schemes/close', [
            'steps' => static::steps($school),
            'closed' => $opening->closed_at !== null,
            'canClose' => $lastWeek !== null && today()->gte($lastWeek['starts_on']),
            'lastWeekStarts' => $lastWeek['starts_on'] ?? null,
            'nextTerm' => $nextTerm?->label,
            'totals' => [
                'taught_percent' => $items->isEmpty() ? 0 : (int) floor($items->whereNotNull('taught_on')->count() / $items->count() * 100),
                'fully' => $rows->where('coverage', 100)->count(),
                'schemes' => $rows->count(),
                'below' => $rows->filter(fn (array $row) => $row['coverage'] < Scheme::COVERED_PERCENT)->count(),
                'carry' => $items->whereNull('taught_on')->count(),
            ],
            'filters' => ['show' => $below],
            'rows' => $below === 'below' ? $rows->filter(fn (array $row) => $row['coverage'] < Scheme::COVERED_PERCENT)->values() : $rows,
        ]);
    }

    /**
     * Lock the term's schemes. What was not taught starts the next
     * term's schemes, opened now when asked.
     */
    public function close(CloseSchemesRequest $request): RedirectResponse
    {
        $school = static::schoolFor($request, manage: true);
        $term = StudentController::currentTerm($school);
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;
        $lastWeek = $term ? collect(Scheme::weeks($term))->last() : null;

        if (! $term || ! $opening || $opening->closed_at !== null) {
            return redirect()->route('schemes');
        }

        if ($lastWeek === null || today()->lt($lastWeek['starts_on'])) {
            throw ValidationException::withMessages(['open_next' => __('The term can close only in its last week.')]);
        }

        $opened = 0;

        DB::transaction(function () use ($request, $term, $opening, &$opened) {
            foreach (Scheme::where('term_id', $term->id)->where('status', '!=', SchemeStatus::Closed)->get() as $scheme) {
                $scheme->update(['status' => SchemeStatus::Closed, 'closed_at' => now()]);
                $scheme->record('closed', $request->user());
            }

            $opening->update(['closed_at' => now(), 'closed_by' => $request->user()?->id]);
            $nextTerm = Term::where('academic_year_id', $term->academic_year_id)->where('sequence', $term->sequence + 1)->first();

            if ($request->boolean('open_next') && $nextTerm) {
                $next = SchemeOpening::firstOrCreate(['term_id' => $nextTerm->id], [
                    'school_id' => $term->school_id,
                    'due_on' => $nextTerm->starts_on->copy()->addDays(18),
                    'approval' => $opening->approval,
                    'starts_from' => SchemeOpening::FROM_SYLLABUS,
                    'free_changes' => $opening->free_changes,
                    'opened_by' => $request->user()?->id,
                ]);
                $opened = Scheme::openFor($next, $request->user());
            }
        });

        $this->notify($opened > 0
            ? trans_choice('{1} :term schemes closed. :count scheme opened for the next term.|[2,*] :term schemes closed. :count schemes opened for the next term.', $opened, ['term' => __($term->label)])
            : __(':term schemes closed.', ['term' => __($term->label)]));

        return redirect()->route('schemes.close');
    }

    /**
     * Coverage by subject and class, for the inspectorate and the staff
     * meeting, as a spreadsheet.
     */
    public function report(Request $request): StreamedResponse
    {
        $school = static::schoolFor($request, manage: true);
        $term = StudentController::currentTerm($school);
        abort_unless($term !== null, 404);
        $schemes = $this->schemesOf($term);

        return response()->streamDownload(function () use ($schemes) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                return;
            }

            fputcsv($out, [__('Subject'), __('Class'), __('Teacher'), __('Taught'), __('Sub-topics'), __('Coverage %'), __('Not taught')], escape: '');

            foreach ($schemes as $scheme) {
                fputcsv($out, [
                    $scheme->classSubject?->subject?->name,
                    $scheme->classSubject?->schoolClass?->name,
                    $scheme->classSubject?->staff?->full_name,
                    $scheme->items->whereNotNull('taught_on')->count(),
                    $scheme->items->count(),
                    $scheme->coverage(),
                    $scheme->untaughtLabels()->join('; '),
                ], escape: '');
            }

            fclose($out);
        }, 'coverage-'.str($term->label)->slug().'.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * @return Collection<int, Scheme>
     */
    protected function schemesOf(Term $term): Collection
    {
        return Scheme::where('term_id', $term->id)
            ->with(['items', 'classSubject.subject:id,name,department', 'classSubject.schoolClass:id,name,level_id', 'classSubject.staff:id,full_name'])
            ->get()
            ->sortBy(fn (Scheme $scheme) => $this->title($scheme))
            ->values();
    }

    protected function find(School $school, string $id): Scheme
    {
        return Scheme::where('school_id', $school->id)
            ->whereKey($id)
            ->with(['items', 'term', 'events.user:id,full_name', 'classSubject.subject:id,name,department', 'classSubject.schoolClass:id,name,level_id', 'classSubject.staff:id,full_name'])
            ->firstOrFail();
    }

    protected function title(Scheme $scheme): string
    {
        return $scheme->classSubject?->subject?->name.' · '.$scheme->classSubject?->schoolClass?->name;
    }

    /**
     * @return array{id: string, subject: string|null, class: string|null, teacher: string|null, status: string, topics: int}
     */
    protected function summary(Scheme $scheme): array
    {
        return [
            'id' => $scheme->id,
            'subject' => $scheme->classSubject?->subject?->name,
            'class' => $scheme->classSubject?->schoolClass?->name,
            'teacher' => $scheme->classSubject?->staff?->full_name,
            'status' => $scheme->status->value,
            'topics' => $scheme->items->count(),
        ];
    }

    /**
     * @return array{id: string, topic: string, name: string|null, week: int|null, periods: int, from_syllabus: bool, added: bool, carried: bool, taught_on: string|null}
     */
    public static function item(SchemeItem $item): array
    {
        return [
            'id' => $item->id,
            'topic' => $item->topic,
            'name' => $item->name,
            'week' => $item->week,
            'periods' => $item->periods,
            'from_syllabus' => $item->syllabus_topic_id !== null,
            'added' => $item->added_by_teacher,
            'carried' => $item->carried_over,
            'taught_on' => $item->taught_on?->toDateString(),
        ];
    }

    /**
     * The side panel of the progress page: the plan week by week, each
     * sub-topic taught, not yet, this week or planned.
     *
     * @return array<string, mixed>
     */
    protected function panel(Scheme $scheme, ?int $week, string $state): array
    {
        $approver = $scheme->approved_by ? User::whereKey($scheme->approved_by)->value('full_name') : null;
        $late = $week === null ? collect() : $scheme->items->filter(fn (SchemeItem $item) => $item->week !== null && $item->week < $week && $item->taught_on === null);

        return [
            ...$this->summary($scheme),
            'state' => $state,
            'approved_on' => $scheme->approved_at?->toDateString(),
            'approved_by' => $approver,
            'late' => $late->count(),
            'late_weeks' => $late->pluck('week')->unique()->sort()->values(),
            'items' => $scheme->items->whereNotNull('week')->map(fn (SchemeItem $item) => [
                'id' => $item->id,
                'week' => $item->week,
                'label' => $item->label(),
                'state' => match (true) {
                    $item->taught_on !== null => 'taught',
                    $week !== null && $item->week < $week => 'late',
                    $week !== null && $item->week === $week => 'this_week',
                    default => 'planned',
                },
            ])->values(),
        ];
    }
}
