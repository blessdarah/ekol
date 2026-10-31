<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsTables;
use App\Http\SchemePageData;
use App\Http\SchoolContext;
use App\Models\Level;
use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\SyllabusTopic;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SchemeController extends Controller
{
    use ListsTables;

    public function __construct(SchoolContext $schoolContext, protected SchemePageData $page)
    {
        parent::__construct($schoolContext);
    }

    /**
     * Step 4, and the home of schemes of work: every scheme of the term,
     * how far it has got, and the one picked in the side panel.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;

        if (! $term || ! $opening) {
            return $request->user()?->can('manage-schemes')
                ? redirect()->route(SyllabusTopic::where('school_id', $school->id)->exists() ? 'schemes.open' : 'schemes.syllabus')
                : redirect()->route('dashboard');
        }

        $week = Scheme::currentWeek($term);
        [$schemes, $states, $listed, $filters] = $this->page->list($request, $term, $opening, $week);
        $perPage = $this->perPage($request);
        $lastPage = max(1, (int) ceil($listed->count() / $perPage));
        $page = min($lastPage, max(1, (int) $request->query('page', 1)));
        $picked = $schemes->firstWhere('id', $request->query('scheme'));

        return Inertia::render('schemes/index', [
            'steps' => Scheme::steps($school, $this->schoolContext->term()),
            'week' => $week,
            'dueOn' => $opening->due_on->toDateString(),
            'daysLate' => $opening->due_on->isPast() ? (int) $opening->due_on->diffInDays(today()) : 0,
            'states' => collect(array_keys(SchemePageData::STATES))->mapWithKeys(fn (string $state) => [
                $state => $states->filter(fn (string $value) => $value === $state)->count(),
            ]),
            'canManage' => $request->user()->can('manage-schemes'),
            'totals' => [
                'all' => $schemes->count(),
                'submitted' => $schemes->filter(fn (Scheme $scheme) => $scheme->status->isSubmitted())->count(),
                'to_approve' => $states->filter(fn (string $state) => $state === 'to_approve')->count(),
                'behind' => $states->filter(fn (string $state) => $state === 'behind')->count(),
                'not_submitted' => $states->filter(fn (string $state) => in_array($state, ['not_submitted', 'sent_back'], true))->count(),
                'waiting' => $states->filter(fn (string $state) => $state === 'waiting')->count(),
            ],
            'filters' => $filters,
            'levels' => $schemes->map(fn (Scheme $scheme) => $scheme->classSubject?->schoolClass?->level)
                ->filter()->unique('id')->sortBy('ordinal')
                ->map(fn (Level $level) => ['id' => $level->id, 'name' => $level->name])->values(),
            'departments' => $schemes->map(fn (Scheme $scheme) => $scheme->classSubject?->subject?->department)
                ->filter()->unique()->sort()->values(),
            'rows' => $listed->forPage($page, $perPage)->map(fn (Scheme $scheme) => [
                ...$this->page->summary($scheme),
                'state' => $states[$scheme->id],
                'progress' => $scheme->progressTo($week),
                'taught_total' => $scheme->items->whereNotNull('taught_on')->count(),
                'late' => $this->page->lateItems($scheme, $week)->count(),
                'initials' => $scheme->classSubject?->staff?->initials,
                'subject_id' => $scheme->classSubject?->subject_id,
            ])->values(),
            'paged' => [
                'page' => $page,
                'lastPage' => $lastPage,
                'total' => $listed->count(),
                'perPage' => $perPage,
                'from' => $listed->isEmpty() ? null : ($page - 1) * $perPage + 1,
                'to' => $listed->isEmpty() ? null : min($page * $perPage, $listed->count()),
            ],
            'picked' => $picked ? $this->page->panel($picked, $week, $states[$picked->id]) : null,
        ]);
    }

    /**
     * The schemes as they are filtered on screen, as a CSV file or a
     * list to print. Selected rows narrow it to those schemes only.
     */
    public function export(Request $request): StreamedResponse|Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;

        if (! $term || ! $opening) {
            return redirect()->route('schemes');
        }

        $week = Scheme::currentWeek($term);
        [, $states, $listed, , $applied] = $this->page->list($request, $term, $opening, $week);
        $ids = $this->exportIds($request);
        $rows = $listed
            ->filter(fn (Scheme $scheme) => $ids === [] || in_array($scheme->id, $ids, true))
            ->map(function (Scheme $scheme) use ($week) {
                $progress = $scheme->progressTo($week);

                return [
                    'subject' => $scheme->classSubject?->subject?->name,
                    'class' => $scheme->classSubject?->schoolClass?->name,
                    'department' => $scheme->classSubject?->subject?->department,
                    'teacher' => $scheme->classSubject->staff->full_name ?? '',
                    'state' => $this->say(SchemePageData::STATES[$scheme->followState($week)]),
                    'taught' => $progress['taught'],
                    'planned' => $progress['planned'],
                    'topics' => $scheme->items->count(),
                    'coverage' => $scheme->coverage(),
                ];
            })
            ->values();

        return $this->sendExport($request, $school, $this->say('Schemes of work').' · '.$this->say($term->label), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'subject' => $this->say('Subject'),
            'class' => $this->say('Class'),
            'department' => $this->say('Department'),
            'teacher' => $this->say('Teacher'),
            'state' => $this->say('Status'),
            'taught' => $this->say('Taught so far'),
            'planned' => $this->say('Planned so far'),
            'topics' => $this->say('Sub-topics'),
            'coverage' => $this->say('Coverage %'),
        ], $rows, $rows->count());
    }
}
