<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsTables;
use App\Http\FeeEnrolments;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Money;
use App\Models\School;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection as SupportCollection;
use Inertia\Inertia;
use Inertia\Response;
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

    /**
     * Everyone enrolled this year with what they were billed and paid.
     */
    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $rows = $this->ledgerRows($school, $year);
        [$listed, $filters] = $this->ledgerList($request, $rows);
        $perPage = $this->perPage($request);
        $lastPage = max(1, (int) ceil($listed->count() / $perPage));
        $page = min($lastPage, max(1, (int) $request->query('page', 1)));
        $counts = ['all' => $rows->count(), ...$rows->countBy('state')->all()];

        return Inertia::render('fees/index', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'totals' => [
                'billed' => Money::number((int) $rows->sum('due')),
                'collected' => Money::number((int) $rows->sum('paid')),
                'outstanding' => Money::number((int) $rows->sum('balance')),
                'overdue' => Money::number((int) $rows->sum('overdue')),
            ],
            'counts' => [
                'all' => $counts['all'],
                'overdue' => $counts['overdue'] ?? 0,
                'owing' => $counts['owing'] ?? 0,
                'paid' => $counts['paid'] ?? 0,
                'unbilled' => $counts['unbilled'] ?? 0,
            ],
            'filters' => $filters,
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'classes' => $rows->whereNotNull('class_id')->unique('class_id')->sortBy('class')
                ->map(fn (array $row) => ['id' => $row['class_id'], 'name' => $row['class'], 'level_id' => $row['level_id']])
                ->values(),
            'students' => [
                'rows' => $listed->forPage($page, $perPage)->map(fn (array $row) => [...$row, 'due' => Money::number($row['due']), 'paid' => Money::number($row['paid']), 'balance' => Money::number($row['balance']), 'overdue' => Money::number($row['overdue'])])->values(),
                'page' => $page,
                'lastPage' => $lastPage,
                'total' => $listed->count(),
                'perPage' => $perPage,
                'from' => $listed->isEmpty() ? null : ($page - 1) * $perPage + 1,
                'to' => $listed->isEmpty() ? null : min($page * $perPage, $listed->count()),
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
        [$listed, , $applied] = $this->ledgerList($request, $this->ledgerRows($school, $this->schoolContext->year()));
        $ids = $this->exportIds($request);
        $rows = $listed
            ->filter(fn (array $row) => $ids === [] || in_array($row['id'], $ids, true))
            ->map(fn (array $row) => [...$row, 'due' => Money::number($row['due']), 'paid' => Money::number($row['paid']), 'balance' => Money::number($row['balance']), 'overdue' => Money::number($row['overdue'])])
            ->map(fn (array $row) => [...$row, 'state' => $this->say(static::STATES[$row['state']])])
            ->values();

        return $this->sendExport($request, $school, $this->say('Fees'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Name'),
            'matricule' => $this->say('Matricule'),
            'class' => $this->say('Class'),
            'due' => $this->say('Annual fees'),
            'paid' => $this->say('Paid'),
            'balance' => $this->say('Balance'),
            'overdue' => $this->say('Overdue'),
            'state' => $this->say('Status'),
        ], $rows, $rows->count());
    }

    /**
     * One row per enrolled student, with what was billed, paid and owed.
     *
     * @return SupportCollection<int, LedgerRow>
     */
    protected function ledgerRows(School $school, ?AcademicYear $year): SupportCollection
    {
        return collect($year ? (new FeeEnrolments)->handle($school, $year) : [])->map(function (Enrolment $enrolment) {
            $ledgers = ($enrolment->student->invoices ?? new Collection)
                ->map(fn (Invoice $invoice) => $invoice->syncStatus()->ledgerMinor());
            $balance = (int) $ledgers->sum('balance');
            $overdue = (int) $ledgers->sum('overdue');

            return [
                'id' => $enrolment->student_id,
                'name' => (string) $enrolment->student?->full_name,
                'matricule' => (string) $enrolment->student?->admission_no,
                'class' => $enrolment->schoolClass?->name,
                'class_id' => $enrolment->schoolClass?->id,
                'level_id' => $enrolment->level_id ?? $enrolment->schoolClass?->level_id,
                'due' => (int) $ledgers->sum('due'),
                'paid' => (int) $ledgers->sum('paid'),
                'balance' => $balance,
                'overdue' => $overdue,
                'state' => match (true) {
                    $ledgers->isEmpty() => 'unbilled',
                    $balance <= 0 => 'paid',
                    $overdue > 0 => 'overdue',
                    default => 'owing',
                },
            ];
        });
    }

    /**
     * The rows with the filters, search and sort from the page address
     * applied, the filters as the page shows them, and the same in words.
     *
     * @param  SupportCollection<int, LedgerRow>  $rows
     * @return array{0: SupportCollection<int, LedgerRow>, 1: array<string, mixed>, 2: list<string>}
     */
    protected function ledgerList(Request $request, SupportCollection $rows): array
    {
        $search = trim((string) $request->query('q', ''));
        $needle = mb_strtolower($search);
        $states = $this->many($request, 'state', array_keys(static::STATES));
        $levelId = (string) $request->query('level', '');
        $classes = $this->many($request, 'class');
        [$sort, $direction] = $this->sorting($request, ['owed', 'name', 'class', 'balance'], 'owed');
        $descending = $direction === 'desc';

        $listed = $rows
            ->filter(fn (array $row) => ($states === [] || in_array($row['state'], $states, true))
                && ($levelId === '' || $row['level_id'] === $levelId)
                && ($classes === [] || in_array($row['class_id'], $classes, true))
                && ($needle === ''
                    || str_contains(mb_strtolower($row['name']), $needle)
                    || str_contains(mb_strtolower($row['matricule']), $needle)))
            ->sortBy(match ($sort) {
                'name' => [['name', $direction]],
                'class' => [['class', $direction], ['name', 'asc']],
                'balance' => [['balance', $direction], ['name', 'asc']],
                default => [['overdue', $descending ? 'asc' : 'desc'], ['balance', $descending ? 'asc' : 'desc'], ['name', 'asc']],
            })
            ->values();

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $states !== [] ? $this->say('Status: :value', ['value' => implode(', ', array_map(fn (string $state) => $this->say(static::STATES[$state]), $states))]) : null,
            $levelId !== '' ? $this->say('Level: :value', ['value' => Level::whereKey($levelId)->value('name')]) : null,
            $classes !== [] ? $this->say('Class: :value', ['value' => $rows->whereIn('class_id', $classes)->pluck('class')->unique()->sort()->join(', ')]) : null,
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
