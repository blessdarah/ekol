<?php

namespace App\Http\Controllers;

use App\Actions\RegisterStudentsForSeries;
use App\Http\Requests\Series\BulkRegisterSeriesRequest;
use App\Http\SchoolContext;
use App\Http\SeriesRegistrationPageData;
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

class SeriesBulkRegistrationController extends Controller
{
    public function __construct(SchoolContext $schoolContext, protected SeriesRegistrationPageData $page)
    {
        parent::__construct($schoolContext);
    }

    public function bulk(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $level = $this->page->levels($school)->firstWhere('id', $request->query('level')) ?? $this->page->levels($school)->first();

        if (! $level) {
            return redirect()->route('series');
        }

        $registered = $this->page->registrations($term, $level)->pluck('student_id');
        $students = $this->page->students($school, $year, $level)
            ->whereNotIn('students.id', $registered)
            ->orderBy('students.full_name')
            ->get();
        $classIds = SchoolClass::where('level_id', $level->id)
            ->where('academic_year_id', $year?->id)
            ->pluck('id')
            ->all();

        return Inertia::render('series/bulk', [
            'yearLabel' => $year?->label,
            'hasTerm' => $term !== null,
            'level' => $level->only(['id', 'name']),
            'students' => $students->map(fn (Student $student) => [
                'id' => $student->id,
                'name' => $student->full_name,
                'matricule' => $student->admission_no,
                'class_id' => $student->getAttribute('class_id'),
                'class' => $student->getAttribute('class_name'),
            ]),
            'series' => $this->page->seriesOptions($level),
            'staffed' => array_keys($this->page->teachers($classIds)),
        ]);
    }

    public function bulkStore(BulkRegisterSeriesRequest $request, RegisterStudentsForSeries $registerStudents): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->term($school);

        $data = $request->validated();

        $series = Series::whereKey($data['series_id'])->with('subjects:id')->firstOrFail();
        $level = Level::whereKey($series->level_id)->firstOrFail();
        $electives = $registerStudents->electives($series, $data['electives']);
        $students = $this->page->students($school, $year, $level)->whereIn('students.id', $data['student_ids'])->get();

        if ($students->count() !== count($data['student_ids'])) {
            throw ValidationException::withMessages([
                'student_ids' => __('Some of those students are not in :name this year.', ['name' => $level->name]),
            ]);
        }

        $registerStudents->handle($school, $request->user(), $term, $series, $students, $electives, true);

        $this->notify('Students registered.');

        return redirect()->route('series', ['level' => $level->id]);
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
