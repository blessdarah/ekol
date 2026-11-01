<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsTables;
use App\Http\FeeLedgerRows;
use App\Http\SchoolContext;
use App\Models\FeePlan;
use App\Models\Level;
use App\Models\Money;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use stdClass;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Fees: what each level costs in a year, who has been billed, what
 * each student has paid, and the receipts for it.
 *
 * @phpstan-type LedgerRow array{id: string, name: string, matricule: string, class: string|null, class_id: string|null, level_id: string|null, due: int, paid: int, balance: int, overdue: int, state: string}
 */
class FeeController extends Controller
{
    use ListsTables;

    protected const array STATES = [
        'overdue' => 'Overdue',
        'owing' => 'Owing, not late',
        'paid' => 'Paid',
        'unbilled' => 'Not billed',
    ];

    public function __construct(SchoolContext $schoolContext, protected FeeLedgerRows $ledger)
    {
        parent::__construct($schoolContext);
    }

    /**
     * Everyone enrolled this year with what they were billed and paid.
     */
    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $rows = $this->ledger->query($school, $year);
        [$listed, $filters] = $this->ledgerList($request, $rows->clone());
        $perPage = $this->perPage($request);
        $total = $listed->clone()->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($lastPage, max(1, (int) $request->query('page', 1)));
        $students = $listed->paginate($perPage, page: $page, total: $total);
        $totals = $rows->clone()->selectRaw("COUNT(*) as all_count, SUM(due) as billed, SUM(paid) as collected, SUM(balance) as outstanding, SUM(overdue) as overdue_amount,
            COUNT(CASE WHEN state = 'overdue' THEN 1 END) as overdue_count,
            COUNT(CASE WHEN state = 'owing' THEN 1 END) as owing_count,
            COUNT(CASE WHEN state = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN state = 'unbilled' THEN 1 END) as unbilled_count")->first();

        return Inertia::render('fees/index', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'totals' => [
                'billed' => Money::number((int) $totals->billed),
                'collected' => Money::number((int) $totals->collected),
                'outstanding' => Money::number((int) $totals->outstanding),
                'overdue' => Money::number((int) $totals->overdue_amount),
            ],
            'counts' => [
                'all' => (int) $totals->all_count,
                'overdue' => (int) $totals->overdue_count,
                'owing' => (int) $totals->owing_count,
                'paid' => (int) $totals->paid_count,
                'unbilled' => (int) $totals->unbilled_count,
            ],
            'filters' => $filters,
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'classes' => $rows->clone()->whereNotNull('class_id')->select('class_id as id', 'class as name', 'level_id')->distinct()->orderBy('class')->get(),
            'students' => [
                'rows' => $students->getCollection()->map(fn (stdClass $row) => $this->ledger->row($row)),
                'page' => $page,
                'lastPage' => $lastPage,
                'total' => $total,
                'perPage' => $perPage,
                'from' => $students->firstItem(),
                'to' => $students->lastItem(),
            ],
            'hasPlans' => $year !== null && FeePlan::where('school_id', $school->id)->where('academic_year_id', $year->id)->exists(),
        ]);
    }

    /**
     * The fee list as it is filtered on screen, as a CSV file or a list
     * to print. Selected rows narrow it to those students only.
     */
    public function export(Request $request): StreamedResponse|Response
    {
        $school = $this->schoolContext->school();
        [$listed, , $applied] = $this->ledgerList($request, $this->ledger->query($school, $this->schoolContext->year()));
        $ids = $this->exportIds($request);
        $listed->when($ids !== [], fn (Builder $query) => $query->whereIn('id', $ids));
        $count = $listed->clone()->count();
        $rows = $listed->cursor()->map(fn (stdClass $row) => [
            ...$this->ledger->row($row),
            'state' => $this->say(static::STATES[$row->state]),
        ]);

        return $this->sendExport($request, $school, $this->say('Fees'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Name'),
            'matricule' => $this->say('Matricule'),
            'class' => $this->say('Class'),
            'due' => $this->say('Annual fees'),
            'paid' => $this->say('Paid'),
            'balance' => $this->say('Balance'),
            'overdue' => $this->say('Overdue'),
            'state' => $this->say('Status'),
        ], $rows, $count);
    }

    /**
     * The rows with the filters, search and sort from the page address
     * applied, the filters as the page shows them, and the same in words.
     *
     * @return array{0: Builder, 1: array<string, mixed>, 2: list<string>}
     */
    protected function ledgerList(Request $request, Builder $rows): array
    {
        $search = trim((string) $request->query('q', ''));
        $needle = '%'.Str::replace(['!', '%', '_'], ['!!', '!%', '!_'], Str::lower($search)).'%';
        $states = $this->many($request, 'state', array_keys(static::STATES));
        $levelId = (string) $request->query('level', '');
        $classes = $this->many($request, 'class');
        [$sort, $direction] = $this->sorting($request, ['owed', 'name', 'class', 'balance'], 'owed');
        $descending = $direction === 'desc';

        $listed = $rows->clone()
            ->when($states !== [], fn (Builder $query) => $query->whereIn('state', $states))
            ->when($levelId !== '', fn (Builder $query) => $query->where('level_id', $levelId))
            ->when($classes !== [], fn (Builder $query) => $query->whereIn('class_id', $classes))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $names) => $names
                ->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$needle])
                ->orWhereRaw("LOWER(matricule) LIKE ? ESCAPE '!'", [$needle])));
        match ($sort) {
            'name' => $listed->orderBy('name', $direction),
            'class' => $listed->orderBy('class', $direction)->orderBy('name'),
            'balance' => $listed->orderBy('balance', $direction)->orderBy('name'),
            default => $listed->orderBy('overdue', $descending ? 'asc' : 'desc')->orderBy('balance', $descending ? 'asc' : 'desc')->orderBy('name'),
        };
        $listed->orderBy('id');

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $states !== [] ? $this->say('Status: :value', ['value' => implode(', ', array_map(fn (string $state) => $this->say(static::STATES[$state]), $states))]) : null,
            $levelId !== '' ? $this->say('Level: :value', ['value' => Level::whereKey($levelId)->value('name')]) : null,
            $classes !== [] ? $this->say('Class: :value', ['value' => $rows->clone()->whereIn('class_id', $classes)->distinct()->orderBy('class')->pluck('class')->join(', ')]) : null,
        ]));

        return [$listed, [
            'q' => $search,
            'state' => $states,
            'level' => $levelId,
            'class' => $classes,
            'sort' => ($descending ? '-' : '').$sort,
        ], $applied];
    }
}
