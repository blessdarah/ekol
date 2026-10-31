<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsTables;
use App\Http\SchoolContext;
use App\Http\SubjectPageData;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\SchoolClass;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SubjectController extends Controller
{
    use ListsTables;

    public function __construct(SchoolContext $schoolContext, protected SubjectPageData $page)
    {
        parent::__construct($schoolContext);
    }

    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $gaps = $this->page->seriesGaps($school, $year);
        [$query, $filters] = $this->page->list($request, $school, $gaps);

        $subjects = $query
            ->with(['classSubjects.schoolClass.level:id,code,name,ordinal', 'series:id,stream'])
            ->paginate($this->perPage($request))
            ->withQueryString();

        $all = Subject::where('school_id', $school->id);
        $departments = $all->clone()
            ->selectRaw('department, COUNT(*) as total')
            ->groupBy('department')
            ->orderByDesc('total')
            ->orderBy('department')
            ->pluck('total', 'department');

        return Inertia::render('subjects/roster', [
            'yearLabel' => $year?->label,
            'counts' => [
                'total' => $all->clone()->count(),
                'departments' => $departments->count(),
                'needs_teacher' => $all->clone()->where($this->page->unstaffed($gaps))->count(),
            ],
            'departments' => $departments->map(fn (int $total, string $name) => ['name' => $name, 'count' => $total])->values(),
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'filters' => $filters,
            'subjects' => [
                'rows' => collect($subjects->items())->map(fn (Subject $subject) => [
                    ...$this->page->summary($subject),
                    'not_taught' => $gaps[$subject->id] ?? [],
                ]),
                'page' => $subjects->currentPage(),
                'lastPage' => $subjects->lastPage(),
                'total' => $subjects->total(),
                'perPage' => $subjects->perPage(),
                'from' => $subjects->firstItem(),
                'to' => $subjects->lastItem(),
            ],
        ]);
    }

    /**
     * The subject roster as it is filtered on screen, as a CSV file or a
     * list to print. Selected rows narrow it to those subjects only.
     */
    public function export(Request $request): StreamedResponse|Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $gaps = $this->page->seriesGaps($school, $year);
        [$query, , $applied] = $this->page->list($request, $school, $gaps);
        $ids = $this->exportIds($request);

        $subjects = $query
            ->with(['classSubjects.schoolClass.level:id,code,name,ordinal', 'classSubjects.staff:id,full_name', 'series:id,stream'])
            ->when($ids !== [], fn (Builder $query) => $query->whereIn('id', $ids))
            ->get();

        $rows = $subjects->map(function (Subject $subject) {
            $summary = $this->page->summary($subject);

            return [
                'name' => $summary['name'],
                'code' => $summary['code'],
                'department' => $summary['department'],
                'kind' => $this->say($summary['kind']),
                'levels' => implode(', ', $summary['levels']),
                'coefficient' => $summary['coefficient'] ?? '',
                'classes' => $summary['classes'],
                'teachers' => $subject->classSubjects->map(fn (ClassSubject $row) => $row->staff?->full_name)->filter()->unique()->sort()->join(', '),
                'unstaffed' => $summary['unstaffed'],
                'periods' => $summary['periods'],
            ];
        });

        return $this->sendExport($request, $school, $this->say('Subjects'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Subject'),
            'code' => $this->say('Code'),
            'department' => $this->say('Department'),
            'kind' => $this->say('Kind'),
            'levels' => $this->say('Levels'),
            'coefficient' => $this->say('Coeff.'),
            'classes' => $this->say('Classes'),
            'teachers' => $this->say('Teachers'),
            'unstaffed' => $this->say('Classes without a teacher'),
            'periods' => $this->say('Periods a week'),
        ], $rows, $rows->count());
    }

    public function show(Request $request, string $subject): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $target = Subject::where('school_id', $school->id)->whereKey($subject)->firstOrFail()
            ->load(['classSubjects.schoolClass.level:id,code,name,ordinal', 'classSubjects.staff:id,full_name', 'series:id,stream']);

        $rows = $target->classSubjects->sortBy(fn (ClassSubject $row) => $row->schoolClass?->name)->values();
        $students = $this->page->studentCounts($rows->pluck('school_class_id')->all());
        $levelIds = $rows->map(fn (ClassSubject $row) => $row->schoolClass?->level_id)->filter()->unique();

        $notOffered = $year
            ? SchoolClass::where('academic_year_id', $year->id)
                ->whereIn('level_id', $levelIds)
                ->whereNotIn('id', $rows->pluck('school_class_id'))
                ->orderBy('name')
                ->pluck('name')
            : collect();

        $lastEdit = AuditEvent::where('entity', 'subject')
            ->where('entity_id', $target->id)
            ->with('actor:id,role')
            ->orderByDesc('occurred_at')
            ->first();

        return Inertia::render('subjects/record', [
            'yearLabel' => $year?->label,
            'subject' => [
                ...$this->page->summary($target),
                'note' => $target->note,
                'level_names' => $rows
                    ->map(fn (ClassSubject $row) => $row->schoolClass?->level)
                    ->filter()
                    ->unique('id')
                    ->sortBy('ordinal')
                    ->pluck('name')
                    ->values(),
                'rows' => $rows->map(fn (ClassSubject $row) => [
                    'class' => $row->schoolClass?->name,
                    'students' => (int) ($students[$row->school_class_id] ?? 0),
                    'teacher' => $row->staff?->full_name,
                    'weekly_periods' => $row->weekly_periods,
                ]),
                'not_offered' => $notOffered,
            ],
            'lastEdit' => $lastEdit ? [
                'by' => $lastEdit->actor ? Str::lower($lastEdit->actor->role->label()) : null,
                'on' => $lastEdit->occurred_at->toDateString(),
            ] : null,
        ]);
    }
}
