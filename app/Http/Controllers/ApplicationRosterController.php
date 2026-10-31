<?php

namespace App\Http\Controllers;

use App\Enums\ApplicationStage;
use App\Http\Controllers\Concerns\ListsTables;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\Level;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApplicationRosterController extends Controller
{
    use ListsTables;

    protected const array STAGES = ['to_review' => 'To review', 'admitted' => 'Admitted', 'waitlist' => 'Waitlist', 'declined' => 'Declined'];

    public function index(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->nextYear();

        if (! $year) {
            return redirect()->route('enrolment');
        }

        [$query, $filters] = $this->list($request, $year);
        $stages = Application::where('academic_year_id', $year->id)->pluck('stage');

        $applications = $query->with('level:id,name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('enrolment/applications', [
            'enrolment' => $year->enrolmentProgress($school, $this->schoolContext->year()),
            'counts' => [
                'all' => $stages->count(),
                ...collect(ApplicationStage::cases())->mapWithKeys(fn (ApplicationStage $case) => [
                    $case->value => $stages->filter(fn (ApplicationStage $value) => $value === $case)->count(),
                ])->all(),
            ],
            'filters' => $filters,
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'applications' => [
                'rows' => collect($applications->items())
                    ->map(fn (Application $application) => [
                        'id' => $application->id,
                        'name' => $application->full_name,
                        'reference' => $application->reference,
                        'level' => $application->level?->name,
                        'from' => $application->previous_school,
                        'transfer' => $application->transferred,
                        'applied' => $application->created_at->toDateString(),
                        'stage' => $application->stage->value,
                        'missing' => count($application->missingDocuments()),
                    ])
                    ->values(),
                'page' => $applications->currentPage(),
                'lastPage' => $applications->lastPage(),
                'total' => $applications->total(),
                'perPage' => $applications->perPage(),
                'from' => $applications->firstItem(),
                'to' => $applications->lastItem(),
            ],
        ]);
    }

    /**
     * The applications as they are filtered on screen, as a CSV file or
     * a list to print. Selected rows narrow it to those applications.
     */
    public function export(Request $request): StreamedResponse|Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->nextYear();

        if (! $year) {
            return redirect()->route('enrolment');
        }

        [$query, , $applied] = $this->list($request, $year);
        $ids = $this->exportIds($request);

        $applications = $query->with('level:id,name')
            ->when($ids !== [], fn (Builder $query) => $query->whereIn('id', $ids))
            ->get();

        $rows = $applications->map(function (Application $application) {
            $main = collect($application->guardians)->firstWhere('is_main', true);

            return [
                'name' => $application->full_name,
                'reference' => $application->reference,
                'level' => $application->level?->name,
                'gender' => $this->say(Str::headline($application->gender->value)),
                'date_of_birth' => $application->date_of_birth->toDateString(),
                'from' => $application->previous_school ?? '',
                'transfer' => $application->transferred ? $this->say('Yes') : $this->say('No'),
                'guardian' => $main['name'] ?? '',
                'phone' => $main['phone'] ?? '',
                'applied' => $application->created_at->toDateString(),
                'stage' => $this->say(static::STAGES[$application->stage->value]),
                'missing' => count($application->missingDocuments()),
            ];
        });

        return $this->sendExport($request, $school, $this->say('Admissions'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Applicant'),
            'reference' => $this->say('Reference'),
            'level' => $this->say('Applying to'),
            'gender' => $this->say('Gender'),
            'date_of_birth' => $this->say('Date of birth'),
            'from' => $this->say('Coming from'),
            'transfer' => $this->say('Transfer'),
            'guardian' => $this->say('Main contact'),
            'phone' => $this->say('Phone'),
            'applied' => $this->say('Applied'),
            'stage' => $this->say('Stage'),
            'missing' => $this->say('Documents missing'),
        ], $rows, $rows->count());
    }

    /**
     * A year's applications with the filters, search and sort from the
     * page address applied, the filters as the page shows them, and the
     * same in words for an export.
     *
     * @return array{0: Builder<Application>, 1: array<string, mixed>, 2: list<string>}
     */
    protected function list(Request $request, AcademicYear $year): array
    {
        $search = trim((string) $request->query('q', ''));
        $stages = $this->many($request, 'stage', array_column(ApplicationStage::cases(), 'value'));
        $levels = $this->many($request, 'level');
        $transfer = in_array($request->query('transfer'), ['yes', 'no'], true) ? (string) $request->query('transfer') : '';
        $from = $this->day($request->query('from'));
        $to = $this->day($request->query('to'));
        [$sort, $direction] = $this->sorting($request, ['applied', 'name', 'reference'], '-applied');

        $query = Application::where('academic_year_id', $year->id)
            ->when($stages !== [], fn (Builder $query) => $query->whereIn('stage', $stages))
            ->when($levels !== [], fn (Builder $query) => $query->whereIn('level_id', $levels))
            ->when($transfer !== '', fn (Builder $query) => $query->where('transferred', $transfer === 'yes'))
            ->when($from, fn (Builder $query) => $query->whereDate('created_at', '>=', $from))
            ->when($to, fn (Builder $query) => $query->whereDate('created_at', '<=', $to))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('full_name', "%{$search}%")
                ->orWhereLike('reference', "%{$search}%")));

        match ($sort) {
            'name' => $query->orderBy('full_name', $direction),
            'reference' => $query->orderBy('reference', $direction),
            default => $query->orderBy('created_at', $direction)->orderBy('reference', $direction),
        };

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $stages !== [] ? $this->say('Stage: :value', ['value' => implode(', ', array_map(fn (string $stage) => $this->say(static::STAGES[$stage]), $stages))]) : null,
            $levels !== [] ? $this->say('Applying to: :value', ['value' => Level::whereIn('id', $levels)->orderBy('ordinal')->pluck('name')->join(', ')]) : null,
            $transfer !== '' ? $this->say('Transfer: :value', ['value' => $transfer === 'yes' ? $this->say('Yes') : $this->say('No')]) : null,
            $from || $to ? $this->say('Applied: :from – :to', ['from' => $from ?? '…', 'to' => $to ?? '…']) : null,
        ]));

        return [$query, [
            'q' => $search,
            'stage' => $stages,
            'level' => $levels,
            'transfer' => $transfer,
            'from' => $from ?? '',
            'to' => $to ?? '',
            'sort' => ($direction === 'desc' ? '-' : '').$sort,
        ], $applied];
    }
}
