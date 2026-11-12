<?php

namespace App\Http\Controllers;

use App\Actions\ChangeStudentSeries;
use App\Http\SchoolContext;
use App\Http\SeriesRegistrationPageData;
use App\Models\Level;
use App\Models\School;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Subject;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SeriesChangeController extends Controller
{
    public function __construct(SchoolContext $schoolContext, protected SeriesRegistrationPageData $page)
    {
        parent::__construct($schoolContext);
    }

    public function change(Request $request, string $student): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $target = Student::where('school_id', $school->id)->where('id', $student)->firstOrFail();
        $registration = $term
            ? StudentSeries::where('student_id', $target->id)
                ->where('term_id', $term->id)
                ->with(['series.subjects:id,name', 'electives:id'])
                ->first()
            : null;
        $current = $registration?->series;
        $level = $current ? Level::whereKey($current->level_id)->first() : null;

        // Nothing to change yet: a first registration happens one by one.
        if (! $registration || ! $current || ! $level) {
            return redirect()->route('series.one', ['student' => $target->id]);
        }

        $chosen = $registration->electives->modelKeys();

        return Inertia::render('series/change', [
            'yearLabel' => $year?->label,
            'student' => [
                'id' => $target->id,
                'name' => $target->full_name,
                'matricule' => $target->admission_no,
                'class' => $this->page->students($school, $year, $level)->where('students.id', $target->id)->first()?->getAttribute('class_name'),
            ],
            'current' => [
                'id' => $current->id,
                'code' => $current->code,
                'stream' => $current->stream ?? 'science',
                'taken' => $current->subjects
                    ->filter(fn (Subject $subject) => $this->page->kind($subject) === 'core' || in_array($subject->id, $chosen, true))
                    ->map(fn (Subject $subject) => [
                        'id' => $subject->id,
                        'name' => $subject->name,
                        'kind' => $this->page->kind($subject),
                    ])
                    ->values(),
            ],
            'series' => $this->page->seriesOptions($level),
            'reasons' => ChangeStudentSeries::REASONS,
        ]);
    }

    public function changeStore(Request $request, string $student, ChangeStudentSeries $changeSeries): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->term($school);
        $target = Student::where('school_id', $school->id)->where('id', $student)->firstOrFail();
        $registration = StudentSeries::where('student_id', $target->id)
            ->where('term_id', $term->id)
            ->with(['series.subjects:id', 'electives:id'])
            ->firstOrFail();

        $data = $request->validate([
            'series_id' => [
                'required',
                Rule::exists('series', 'id')
                    ->where('school_id', $school->id)
                    ->where('level_id', $registration->series?->level_id),
                Rule::notIn([$registration->series_id]),
            ],
            'reason' => ['required', Rule::in(ChangeStudentSeries::REASONS)],
            'note' => ['nullable', 'string', 'max:255'],
            'parent_agreed' => ['accepted'],
        ], [
            'parent_agreed.accepted' => __('A parent or guardian must agree before the series changes.'),
            'series_id.not_in' => __('The student is already in that series.'),
        ]);

        $changeSeries->handle(
            $school,
            $request->user(),
            $term,
            $registration,
            Series::forSchool($school->id)->whereKey($data['series_id'])->firstOrFail(),
            [
                'reason' => $data['reason'],
                'note' => $data['note'] ?? null,
                'parent_agreed' => $request->boolean('parent_agreed'),
            ],
        );

        $this->notify('Series changed.');

        return redirect()->route('students.show', $target->id);
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
