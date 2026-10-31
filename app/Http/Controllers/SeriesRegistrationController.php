<?php

namespace App\Http\Controllers;

use App\Actions\RegisterStudentsForSeries;
use App\Http\Requests\Series\RegisterSeriesRequest;
use App\Http\SchoolContext;
use App\Http\SeriesRegistrationPageData;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SeriesRegistrationController extends Controller
{
    protected const int QUEUE_PREVIEW = 4;

    public function __construct(SchoolContext $schoolContext, protected SeriesRegistrationPageData $page)
    {
        parent::__construct($schoolContext);
    }

    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $levels = $this->page->levels($school);
        $level = $levels->firstWhere('id', $request->query('level')) ?? $levels->first();

        $cards = $levels->map(function (Level $option) use ($school, $year, $term) {
            $students = $this->page->students($school, $year, $option)->pluck('students.id');

            return [
                'id' => $option->id,
                'name' => $option->name,
                'total' => $students->count(),
                'registered' => $this->page->registrations($term, $option)->whereIn('student_id', $students)->count(),
            ];
        });

        if (! $level) {
            return Inertia::render('series/overview', [
                'yearLabel' => $year?->label,
                'hasTerm' => $term !== null,
                'levels' => [],
                'level' => null,
            ]);
        }

        $students = $this->page->students($school, $year, $level)->orderBy('students.full_name')->get();
        $registrations = $this->page->registrations($term, $level)
            ->with('electives:id')
            ->get()
            ->keyBy('student_id');
        $series = Series::where('level_id', $level->id)->with('subjects:id,name')->orderBy('code')->get();
        $unassigned = $students->reject(fn (Student $student) => $registrations->has($student->id))->values();

        return Inertia::render('series/overview', [
            'yearLabel' => $year?->label,
            'hasTerm' => $term !== null,
            'levels' => $cards,
            'level' => $level->only(['id', 'name']),
            'series' => $series->map(fn (Series $item) => [
                'id' => $item->id,
                'code' => $item->code,
                'name' => $item->name,
                'stream' => $item->stream ?? 'science',
                'core' => $item->subjects->where('pivot.kind', 'core')->pluck('name')->values(),
                'students' => $registrations->where('series_id', $item->id)->count(),
            ]),
            'unassigned' => [
                'total' => $unassigned->count(),
                'preview' => $unassigned->take(static::QUEUE_PREVIEW)->map(fn (Student $student) => [
                    'id' => $student->id,
                    'name' => $student->full_name,
                    'class' => $student->getAttribute('class_name'),
                ])->values(),
            ],
            'unstaffed' => $this->page->unstaffed($school, $students, $registrations, $series),
        ]);
    }

    public function one(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $levels = $this->page->levels($school);

        // A link from a student's record names the student, not the level.
        $levelId = $request->query('level') ?? SchoolClass::query()
            ->where('academic_year_id', $year?->id)
            ->whereIn('id', Enrolment::where('student_id', $request->query('student'))->select('school_class_id'))
            ->value('level_id');
        $level = $levels->firstWhere('id', $levelId) ?? $levels->first();

        if (! $level) {
            return redirect()->route('series');
        }

        $tab = $request->query('tab') === 'registered' ? 'registered' : 'unassigned';
        $search = trim((string) $request->query('q', ''));
        $everyone = $this->page->students($school, $year, $level)->orderBy('students.full_name')->get();
        $registrations = $this->page->registrations($term, $level)->with('electives:id')->get()->keyBy('student_id');
        $unassigned = $everyone->reject(fn (Student $student) => $registrations->has($student->id))->values();

        $selected = $everyone->firstWhere('id', $request->query('student'))
            ?? ($tab === 'unassigned' ? $unassigned->first() : $everyone->first(fn (Student $student) => $registrations->has($student->id)));

        // Opening a student from elsewhere shows the list that student is in.
        if ($request->query('student') && $selected && ! $request->has('tab')) {
            $tab = $registrations->has($selected->id) ? 'registered' : 'unassigned';
        }

        $list = ($tab === 'unassigned' ? $unassigned : $everyone->filter(fn (Student $student) => $registrations->has($student->id)))
            ->filter(fn (Student $student) => $search === ''
                || str_contains(mb_strtolower($student->full_name), mb_strtolower($search))
                || str_contains(mb_strtolower($student->admission_no), mb_strtolower($search)))
            ->values();

        $registration = $selected ? $registrations->get($selected->id) : null;
        $position = $selected ? $unassigned->search(fn (Student $student) => $student->id === $selected->id) : false;
        $next = $unassigned->filter(fn (Student $student) => $student->id !== $selected?->id)->values();

        return Inertia::render('series/register', [
            'yearLabel' => $year?->label,
            'hasTerm' => $term !== null,
            'level' => $level->only(['id', 'name']),
            'counts' => ['total' => $everyone->count(), 'unassigned' => $unassigned->count()],
            'tab' => $tab,
            'q' => $search,
            'students' => $list->map(fn (Student $student) => [
                'id' => $student->id,
                'name' => $student->full_name,
                'matricule' => $student->admission_no,
            ]),
            'student' => $selected ? [
                'id' => $selected->id,
                'name' => $selected->full_name,
                'matricule' => $selected->admission_no,
                'class' => $selected->getAttribute('class_name'),
                'series_id' => $registration?->series_id,
                'electives' => $registration ? $registration->electives->modelKeys() : [],
            ] : null,
            'nextId' => ($position !== false ? $unassigned->get((int) $position + 1) : null)?->id
                ?: $next->first()?->id,
            'series' => $this->page->seriesOptions($level),
            'teachers' => $selected ? $this->page->teachers([(string) $selected->getAttribute('class_id')]) : [],
        ]);
    }

    public function register(RegisterSeriesRequest $request, RegisterStudentsForSeries $registerStudents): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->term($school);

        $data = $request->validated();

        $series = Series::whereKey($data['series_id'])->with('subjects:id')->firstOrFail();
        $level = Level::whereKey($series->level_id)->firstOrFail();
        $electives = $registerStudents->electives($series, $data['electives']);
        $student = $this->page->students($school, $year, $level)->where('students.id', $data['student_id'])->first();

        if (! $student) {
            throw ValidationException::withMessages([
                'series_id' => __('That student is not in :name this year.', ['name' => $level->name]),
            ]);
        }

        $registerStudents->handle($school, $request->user(), $term, $series, collect([$student]), $electives, false);

        $next = $data['next_id'] ?? null;

        $this->notify('Series registered.');

        return $next
            ? redirect()->route('series.one', ['level' => $level->id, 'student' => $next])
            : redirect()->route('series', ['level' => $level->id]);
    }

    /**
     * Series are registered per term, so one must be active.
     */
    protected function term(School $school): Term
    {
        $term = $this->schoolContext->term();

        if (! $term) {
            throw ValidationException::withMessages([
                'series_id' => __('Series are registered for a term. Make a term active in School Setup first.'),
            ]);
        }

        return $term;
    }
}
