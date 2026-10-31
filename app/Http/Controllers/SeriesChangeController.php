<?php

namespace App\Http\Controllers;

use App\Http\SchoolContext;
use App\Http\SeriesRegistrationPageData;
use App\Models\AuditEvent;
use App\Models\Level;
use App\Models\School;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Subject;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SeriesChangeController extends Controller
{
    private const array REASONS = ["Student's request", "Parent's request", 'Teacher advice', 'Placed in the wrong series', 'Other'];

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
            'reasons' => self::REASONS,
        ]);
    }

    public function changeStore(Request $request, string $student): RedirectResponse
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
            'reason' => ['required', Rule::in(self::REASONS)],
            'note' => ['nullable', 'string', 'max:255'],
            'parent_agreed' => ['accepted'],
        ], [
            'parent_agreed.accepted' => __('A parent or guardian must agree before the series changes.'),
            'series_id.not_in' => __('The student is already in that series.'),
        ]);

        $series = Series::whereKey($data['series_id'])->with('subjects:id')->firstOrFail();

        if ($series->subjects->where('pivot.kind', 'core')->isEmpty()) {
            throw ValidationException::withMessages([
                'series_id' => __(':name has no core subjects yet, so nobody can be moved into it.', ['name' => $series->name]),
            ]);
        }

        // Everything the student took and the new pool still offers is kept.
        $taken = [
            ...$registration->electives->modelKeys(),
            ...($registration->series ? array_values($registration->series->subjects->where('pivot.kind', 'core')->modelKeys()) : []),
        ];
        $kept = array_values(array_intersect($taken, array_values($series->subjects->where('pivot.kind', 'elective')->modelKeys())));

        DB::transaction(function () use ($request, $school, $registration, $series, $kept, $data, $target) {
            $from = $registration->series?->code;

            $registration->update([
                'series_id' => $series->id,
                'chosen_by' => $request->user()?->id,
                'chosen_at' => now(),
                'change_reason' => $data['reason'],
                'change_note' => $data['note'] ?? null,
                'parent_agreed' => true,
            ]);
            $registration->electives()->sync($kept);

            AuditEvent::record($school, $request->user(), 'student', $target->id, 'series_changed', [
                'from' => $from,
                'to' => $series->code,
                'reason' => $data['reason'],
                'note' => $data['note'] ?? null,
            ]);
        });

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
