<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsTables;
use App\Http\SchemePageData;
use App\Http\SchoolContext;
use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\SyllabusTopic;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use stdClass;
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
        [$schemes, $listed, $filters] = $this->page->list($request, $term, $opening, $week);
        $states = (clone $schemes)->select('state')->selectRaw('COUNT(*) as total')->groupBy('state')->pluck('total', 'state');
        $submitted = (clone $schemes)->whereIn('status', ['submitted', 'approved', 'closed'])->count();
        $perPage = $this->perPage($request);
        $total = $listed->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($lastPage, max(1, (int) $request->query('page', 1)));
        $paged = $listed->paginate($perPage, ['*'], 'page', $page, $total);
        $pickedId = (string) $request->query('scheme', '');
        $pickedRow = Str::isUuid($pickedId) ? (clone $schemes)->where('id', $pickedId)->first(['id', 'state']) : null;
        $picked = $pickedRow ? $this->page->find($school, $pickedRow->id) : null;

        return Inertia::render('schemes/index', [
            'steps' => Scheme::steps($school, $this->schoolContext->term()),
            'week' => $week,
            'dueOn' => $opening->due_on->toDateString(),
            'daysLate' => $opening->due_on->isPast() ? (int) $opening->due_on->diffInDays(today()) : 0,
            'states' => collect(array_keys(SchemePageData::STATES))->mapWithKeys(fn (string $state) => [
                $state => (int) ($states[$state] ?? 0),
            ]),
            'canManage' => $request->user()->can('manage-schemes'),
            'totals' => [
                'all' => (int) $states->sum(),
                'submitted' => $submitted,
                'to_approve' => (int) ($states['to_approve'] ?? 0),
                'behind' => (int) ($states['behind'] ?? 0),
                'not_submitted' => (int) ($states['not_submitted'] ?? 0) + (int) ($states['sent_back'] ?? 0),
                'waiting' => (int) ($states['waiting'] ?? 0),
            ],
            'filters' => $filters,
            'levels' => (clone $schemes)->whereNotNull('level_id')->whereNotNull('level_name')
                ->select(['level_id as id', 'level_name as name', 'level_ordinal'])->distinct()->orderBy('level_ordinal')
                ->get()->map(fn (stdClass $row) => ['id' => $row->id, 'name' => $row->name]),
            'departments' => (clone $schemes)->whereNotNull('department')->where('department', '!=', '')
                ->distinct()->orderBy('department')->pluck('department'),
            'rows' => collect($paged->items())->map(fn (stdClass $row) => [
                'id' => $row->id,
                'subject' => $row->subject,
                'class' => $row->class,
                'teacher' => $row->teacher,
                'status' => $row->status,
                'topics' => (int) $row->topics,
                'state' => $row->state,
                'progress' => ['planned' => (int) $row->planned, 'taught' => (int) $row->taught],
                'taught_total' => (int) $row->taught_total,
                'late' => (int) $row->late,
                'initials' => $row->teacher_initials,
                'subject_id' => $row->subject_id,
            ])->values(),
            'paged' => [
                'page' => $paged->currentPage(),
                'lastPage' => $paged->lastPage(),
                'total' => $paged->total(),
                'perPage' => $paged->perPage(),
                'from' => $paged->firstItem(),
                'to' => $paged->lastItem(),
            ],
            'picked' => $picked ? $this->page->panel($picked, $week, $pickedRow->state) : null,
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
        [, $listed, , $applied] = $this->page->list($request, $term, $opening, $week);
        $ids = $this->exportIds($request);
        $listed->when($ids !== [], fn ($query) => $query->whereIn('id', $ids));
        $count = $listed->count();
        $rows = $listed->cursor()->map(fn (stdClass $row) => [
            'subject' => $row->subject,
            'class' => $row->class,
            'department' => $row->department,
            'teacher' => $row->teacher ?? '',
            'state' => $this->say(SchemePageData::STATES[$row->state]),
            'taught' => (int) $row->taught,
            'planned' => (int) $row->planned,
            'topics' => (int) $row->topics,
            'coverage' => (int) $row->topics > 0 ? (int) floor((int) $row->taught_total / (int) $row->topics * 100) : 0,
        ]);

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
        ], $rows, $count);
    }
}
