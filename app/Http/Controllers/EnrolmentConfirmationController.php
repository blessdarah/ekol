<?php

namespace App\Http\Controllers;

use App\Actions\Enrolment\ConfirmEnrolment;
use App\Enums\EnrolmentDecision;
use App\Http\EnrolmentOrigins;
use App\Models\Enrolment;
use App\Models\Level;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EnrolmentConfirmationController extends Controller
{
    public function confirm(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $successors = $school->successorLevels();
        $continuing = Enrolment::continuingFor($school, $this->schoolContext->year());
        $enrolments = Enrolment::where('academic_year_id', $next->id)->get();
        $origins = (new EnrolmentOrigins)->handle($school, $this->schoolContext->year(), $enrolments);
        $kinds = $enrolments->countBy(fn (Enrolment $enrolment) => $origins[$enrolment->student_id]['kind'] ?? 'new');
        $usesSeries = Level::where('school_id', $school->id)->where('uses_series', true)->pluck('id');

        return Inertia::render('enrolment/confirm', [
            'enrolment' => $next->enrolmentProgress($school, $this->schoolContext->year()),
            'confirmedOn' => $next->enrolment_confirmed_at?->toDateString(),
            'who' => [
                'promoted' => (int) $kinds->get('promoted', 0),
                'repeating' => (int) $kinds->get('repeating', 0),
                'new' => (int) $kinds->get('new', 0),
                'graduating' => $continuing
                    ->filter(fn (Enrolment $enrolment) => ! isset($successors[(string) $enrolment->schoolClass?->level_id]))
                    ->count(),
                'leaving' => $continuing->where('decision', EnrolmentDecision::Leaving)->count(),
                'series' => $enrolments->whereIn('level_id', $usesSeries)->count(),
            ],
        ]);
    }

    public function storeConfirmation(Request $request, ConfirmEnrolment $confirm): RedirectResponse
    {
        $confirm->handle($this->schoolContext->school(), $this->schoolContext->year(), $this->schoolContext->requireNextYear(), $request->user());
        $this->notify('Enrolment confirmed.');

        return back();
    }
}
