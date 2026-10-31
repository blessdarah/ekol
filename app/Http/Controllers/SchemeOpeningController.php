<?php

namespace App\Http\Controllers;

use App\Actions\OpenTermSchemes;
use App\Http\Requests\Schemes\OpenSchemesRequest;
use App\Models\ClassSubject;
use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\SyllabusTopic;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SchemeOpeningController extends Controller
{
    /**
     * Step 2: what opening the term's schemes would create.
     */
    public function opening(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();

        if (! $term) {
            return redirect()->route('setup');
        }

        $opening = SchemeOpening::where('term_id', $term->id)->first();
        $existing = Scheme::where('term_id', $term->id)->pluck('class_subject_id');
        $classSubjects = ClassSubject::where('school_id', $school->id)
            ->whereHas('schoolClass', fn ($query) => $query->where('academic_year_id', $term->academic_year_id))
            ->whereNotIn('id', $existing)
            ->with(['schoolClass.level:id,name', 'subject:id,name'])
            ->get();
        $withSyllabus = SyllabusTopic::where('school_id', $school->id)
            ->where('term_sequence', $term->sequence)
            ->get(['level_id', 'subject_id'])
            ->map(fn (SyllabusTopic $topic) => $topic->level_id.'|'.$topic->subject_id)
            ->unique();
        $empty = $classSubjects
            ->reject(fn (ClassSubject $classSubject) => $withSyllabus->contains($classSubject->schoolClass?->level_id.'|'.$classSubject->subject_id))
            ->map(fn (ClassSubject $classSubject) => $classSubject->subject?->name.' · '.$classSubject->schoolClass?->level?->name)
            ->unique()
            ->values();

        return Inertia::render('schemes/open', [
            'steps' => Scheme::steps($school, $this->schoolContext->term()),
            'term' => [
                'id' => $term->id,
                'label' => $term->label,
                'starts_on' => $term->starts_on->toDateString(),
                'ends_on' => $term->ends_on->toDateString(),
                'weeks' => $term->week_count,
            ],
            'opening' => $opening ? [
                'due_on' => $opening->due_on->toDateString(),
                'approval' => $opening->approval,
                'starts_from' => $opening->starts_from,
                'free_changes' => $opening->free_changes,
            ] : null,
            'suggestedDueOn' => $term->starts_on->copy()->addDays(18)->toDateString(),
            'creates' => [
                'schemes' => $classSubjects->count(),
                'classes' => $classSubjects->pluck('school_class_id')->unique()->count(),
                'with_teacher' => $classSubjects->whereNotNull('staff_id')->count(),
                'without_teacher' => $classSubjects->whereNull('staff_id')->map(fn (ClassSubject $classSubject) => $classSubject->subject?->name.' · '.$classSubject->schoolClass?->name)->values(),
                'empty_syllabus' => $empty,
            ],
        ]);
    }

    public function open(OpenSchemesRequest $request, OpenTermSchemes $openSchemes): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();

        if (! $term) {
            return redirect()->route('setup');
        }

        $created = $openSchemes->handle($school, $term, $request->user(), $request->openingData());
        $this->notify(trans_choice('{0} Settings saved. No new schemes to open.|{1} :count scheme opened.|[2,*] :count schemes opened.', $created));

        return redirect()->route('schemes');
    }
}
