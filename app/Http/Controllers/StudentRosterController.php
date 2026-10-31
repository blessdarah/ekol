<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Concerns\ListsTables;
use App\Http\StudentFeeSummary;
use App\Http\StudentRegistrationForm;
use App\Models\AcademicYear;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StudentRosterController extends Controller
{
    use ListsTables;

    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $seriesLevels = Level::where('school_id', $school->id)->where('uses_series', true)->pluck('id');
        [$query, $filters] = $this->roster($request, $school, $year, $term, $seriesLevels->all());

        $students = $query
            ->with([
                'studentSeries' => fn ($query) => $query->where('term_id', $term?->id)->with('series:id,code,stream'),
                'invoices.payments',
                'invoices.exemption',
            ])
            ->paginate($this->perPage($request))
            ->withQueryString();

        $classes = StudentRegistrationForm::classes($school, $year);
        $base = fn () => Student::rosterQuery($school, $year);

        return Inertia::render('students/roster', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'counts' => [
                'total' => Student::where('school_id', $school->id)->count(),
                'classes' => $classes->count(),
                'overdue' => $base()->where(fn (Builder $query) => $this->feeState($query, ['overdue']))->count(),
                'no_series' => $base()->where(fn (Builder $query) => $this->noSeries($query, $seriesLevels->all(), $term))->count(),
                'new' => $base()->where(fn (Builder $query) => $query->whereDate('students.admitted_on', '>=', $term ? $term->starts_on : today()->addDay()))->count(),
            ],
            'termStartsOn' => $term?->starts_on?->toDateString(),
            'filters' => $filters,
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get(['id', 'name']),
            'classes' => $classes->map(fn (SchoolClass $class) => $class->only(['id', 'name', 'level_id'])),
            'series' => Series::where('school_id', $school->id)->whereIn('level_id', $seriesLevels)->orderBy('code')->get(['id', 'code', 'stream'])->unique('code')->values(),
            'students' => [
                'rows' => collect($students->items())
                    ->map(fn (Student $student) => $this->row($student, $seriesLevels->all()))
                    ->values(),
                'page' => $students->currentPage(),
                'lastPage' => $students->lastPage(),
                'total' => $students->total(),
                'perPage' => $students->perPage(),
                'from' => $students->firstItem(),
                'to' => $students->lastItem(),
            ],
        ]);
    }

    /**
     * The roster as it is filtered on screen, as a CSV file or a list
     * to print. Selected rows narrow it to those students only.
     */
    public function export(Request $request): StreamedResponse|Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $seriesLevels = Level::where('school_id', $school->id)->where('uses_series', true)->pluck('id')->all();
        [$query, , $applied] = $this->roster($request, $school, $year, $term, $seriesLevels);
        $ids = $this->exportIds($request);

        $students = $query
            ->when($ids !== [], fn (Builder $query) => $query->whereIn('students.id', $ids))
            ->with([
                'studentSeries' => fn ($query) => $query->where('term_id', $term?->id)->with('series:id,code,stream'),
                'invoices.payments',
                'invoices.exemption',
            ])
            ->get();

        $rows = $students->map(function (Student $student) use ($seriesLevels) {
            $row = $this->row($student, $seriesLevels);

            return [
                'name' => $row['name'],
                'matricule' => $row['matricule'],
                'class' => $row['class'],
                'series' => $row['series']['code'] ?? '',
                'gender' => $student->gender->value,
                'date_of_birth' => $student->date_of_birth->toDateString(),
                'guardian' => $row['guardian'],
                'phone' => $row['phone'],
                'fees' => $row['fees'] ? $this->say(Str::headline($row['fees'])) : '',
                'balance' => $row['balance'],
            ];
        });

        return $this->sendExport($request, $school, $this->say('Students'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => __('Name'),
            'matricule' => __('Matricule'),
            'class' => __('Class'),
            'series' => __('Series'),
            'gender' => __('Gender'),
            'date_of_birth' => __('Date of birth'),
            'guardian' => __('Guardian'),
            'phone' => __('Guardian phone'),
            'fees' => __('Fees'),
            'balance' => __('Balance'),
        ], $rows, $rows->count());
    }

    /**
     * The roster query with the filters, search and sort from the page
     * address applied, the filters as the page shows them, and the same
     * in words for an export.
     *
     * @param  array<int, string>  $seriesLevels
     * @return array{0: Builder<Student>, 1: array<string, mixed>, 2: list<string>}
     */
    protected function roster(Request $request, School $school, ?AcademicYear $year, ?Term $term, array $seriesLevels): array
    {
        $search = trim((string) $request->query('q', ''));
        $fees = $this->many($request, 'fees', ['paid', 'partial', 'due', 'overdue', 'none']);
        $series = $this->many($request, 'series');
        $levelId = (string) $request->query('level', '');
        $classes = $this->many($request, 'class');
        $gender = in_array($request->query('gender'), ['male', 'female'], true) ? (string) $request->query('gender') : '';
        $from = $this->day($request->query('from'));
        $to = $this->day($request->query('to'));
        [$sort, $direction] = $this->sorting($request, ['class', 'name', 'matricule', 'admitted'], 'class');

        $query = Student::rosterQuery($school, $year)
            ->select('students.*', 'school_classes.name as class_name', 'school_classes.level_id as class_level_id')
            ->when($fees !== [], fn (Builder $query) => $query->where(fn (Builder $inner) => $this->feeState($inner, $fees)))
            ->when($series !== [], fn (Builder $query) => $query->where(function (Builder $inner) use ($series, $seriesLevels, $term) {
                $codes = array_values(array_diff($series, ['none']));

                if (in_array('none', $series, true)) {
                    $inner->orWhere(fn (Builder $none) => $this->noSeries($none, $seriesLevels, $term));
                }

                if ($codes !== []) {
                    $inner->orWhereHas('studentSeries', fn (Builder $chosen) => $chosen
                        ->where('term_id', $term?->id)
                        ->whereHas('series', fn (Builder $one) => $one->whereIn('code', $codes)));
                }
            }))
            ->when($levelId !== '', fn (Builder $query) => $query->where('school_classes.level_id', $levelId))
            ->when($classes !== [], fn (Builder $query) => $query->whereIn('school_classes.id', $classes))
            ->when($gender !== '', fn (Builder $query) => $query->where('students.gender', $gender))
            ->when($from, fn (Builder $query) => $query->whereDate('students.admitted_on', '>=', $from))
            ->when($to, fn (Builder $query) => $query->whereDate('students.admitted_on', '<=', $to))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('students.full_name', "%{$search}%")
                ->orWhereLike('students.admission_no', "%{$search}%")
                ->orWhereLike('students.guardian_phone', "%{$search}%")));

        match ($sort) {
            'name' => $query->orderBy('students.full_name', $direction),
            'matricule' => $query->orderBy('students.admission_no', $direction),
            'admitted' => $query->orderBy('students.admitted_on', $direction)->orderBy('students.full_name'),
            default => $query->orderByRaw('school_classes.name IS NULL')->orderBy('school_classes.name', $direction)->orderBy('students.full_name'),
        };

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $fees !== [] ? $this->say('Fees: :value', ['value' => implode(', ', array_map(fn (string $state) => $this->say(Str::headline($state)), $fees))]) : null,
            $series !== [] ? $this->say('Series: :value', ['value' => implode(', ', array_map(fn (string $code) => $code === 'none' ? $this->say('No series') : $code, $series))]) : null,
            $levelId !== '' ? $this->say('Level: :value', ['value' => Level::whereKey($levelId)->value('name')]) : null,
            $classes !== [] ? $this->say('Class: :value', ['value' => SchoolClass::whereIn('id', $classes)->orderBy('name')->pluck('name')->join(', ')]) : null,
            $gender !== '' ? $this->say('Gender: :value', ['value' => $gender === 'female' ? $this->say('Girls') : $this->say('Boys')]) : null,
            $from || $to ? $this->say('Admitted: :from – :to', ['from' => $from ?? '…', 'to' => $to ?? '…']) : null,
        ]));

        return [$query, [
            'q' => $search,
            'fees' => $fees,
            'series' => $series,
            'level' => $levelId,
            'class' => $classes,
            'gender' => $gender,
            'from' => $from ?? '',
            'to' => $to ?? '',
            'sort' => ($direction === 'desc' ? '-' : '').$sort,
        ], $applied];
    }

    /**
     * Students whose fees are in any of the given states.
     *
     * @param  Builder<Student>  $query
     * @param  list<string>  $states
     */
    protected function feeState(Builder $query, array $states): void
    {
        $has = fn (InvoiceStatus ...$statuses) => fn (Builder $invoices) => $invoices->whereIn('status', $statuses);

        foreach ($states as $state) {
            match ($state) {
                'overdue' => $query->orWhereHas('invoices', $has(InvoiceStatus::Overdue)),
                'partial' => $query->orWhere(fn (Builder $one) => $one->whereHas('invoices', $has(InvoiceStatus::Partial))->whereDoesntHave('invoices', $has(InvoiceStatus::Overdue))),
                'due' => $query->orWhere(fn (Builder $one) => $one->whereHas('invoices', $has(InvoiceStatus::Pending))->whereDoesntHave('invoices', $has(InvoiceStatus::Overdue, InvoiceStatus::Partial))),
                'paid' => $query->orWhere(fn (Builder $one) => $one->whereHas('invoices')->whereDoesntHave('invoices', $has(InvoiceStatus::Pending, InvoiceStatus::Partial, InvoiceStatus::Overdue))),
                default => $query->orWhereDoesntHave('invoices'),
            };
        }
    }

    /**
     * Students in a series level who have not chosen a series this term.
     *
     * @param  Builder<Student>  $query
     * @param  array<int, string>  $seriesLevels
     */
    protected function noSeries(Builder $query, array $seriesLevels, ?Term $term): void
    {
        $query->whereIn('school_classes.level_id', $seriesLevels)
            ->whereDoesntHave('studentSeries', fn (Builder $chosen) => $chosen->where('term_id', $term?->id));
    }

    /**
     * One roster line.
     *
     * @param  array<int, string>  $seriesLevels
     * @return array<string, mixed>
     */
    protected function row(Student $student, array $seriesLevels): array
    {
        $series = $student->studentSeries->first()?->series;
        $fees = StudentFeeSummary::summarize($student->invoices);

        return [
            'id' => $student->id,
            'name' => $student->full_name,
            'initials' => $this->initials($student),
            'matricule' => $student->admission_no,
            'class' => $student->getAttribute('class_name'),
            'series' => $series ? ['code' => $series->code, 'stream' => $series->stream ?? 'science'] : null,
            'needs_series' => ! $series && in_array($student->getAttribute('class_level_id'), $seriesLevels, true),
            'guardian' => $student->guardian_name,
            'phone' => $student->guardian_phone,
            'fees' => $fees['status'],
            'balance' => $fees['balance'],
        ];
    }

    protected function initials(Student $student): string
    {
        $parts = preg_split('/\s+/', trim($student->full_name)) ?: [];

        return mb_strtoupper(mb_substr($parts[0] ?? '', 0, 1).mb_substr($parts[1] ?? '', 0, 1));
    }
}
