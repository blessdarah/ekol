<?php

namespace App\Http\Controllers;

use App\Actions\Enrolment\DecideReEnrolment;
use App\Enums\EnrolmentDecision;
use App\Http\Requests\Enrolment\DecideReEnrolmentRequest;
use App\Http\Requests\Enrolment\PromoteClassRequest;
use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Money;
use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReEnrolmentController extends Controller
{
    public function reEnrolment(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();
        $current = $this->schoolContext->year();

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $successors = $school->successorLevels();
        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->get();
        $continuing = Enrolment::continuingFor($school, $this->schoolContext->year());
        $classes = $current
            ? SchoolClass::where('academic_year_id', $current->id)->orderBy('name')->get()
            : new Collection;
        $open = $classes->filter(fn (SchoolClass $class) => isset($successors[$class->level_id]))->values();

        $undecidedIn = fn (SchoolClass $class) => $continuing
            ->where('school_class_id', $class->id)
            ->whereNull('decision')
            ->count();

        $requested = (string) $request->query('class', '');
        $levelId = (string) $request->query('level', '');
        $inLevel = $levelId !== '' ? $open->where('level_id', $levelId)->values() : $open;
        $class = $open->firstWhere('id', $requested)
            ?? $inLevel->first(fn (SchoolClass $candidate) => $undecidedIn($candidate) > 0)
            ?? $inLevel->first()
            ?? $open->first();

        $level = $class ? $levels->firstWhere('id', $class->level_id) : null;
        $nextLevel = $level ? $levels->firstWhere('id', $successors[$level->id] ?? null) : null;

        $rows = $class
            ? Enrolment::whereIn('id', $continuing->where('school_class_id', $class->id)->modelKeys())
                ->with(['student.invoices.payments', 'student.invoices.exemption'])
                ->get()
                ->sortBy(fn (Enrolment $enrolment) => $enrolment->student?->full_name)
                ->values()
            : new Collection;

        return Inertia::render('enrolment/re-enrolment', [
            'enrolment' => $next->enrolmentProgress($school, $this->schoolContext->year()),
            'levels' => $levels
                ->filter(fn (Level $option) => isset($successors[$option->id]) && $open->contains('level_id', $option->id))
                ->map(fn (Level $option) => ['id' => $option->id, 'name' => $option->name])
                ->values(),
            'graduating' => $levels
                ->filter(fn (Level $option) => ! isset($successors[$option->id]) && $classes->contains('level_id', $option->id))
                ->pluck('name')
                ->values(),
            'level' => $level ? [
                'id' => $level->id,
                'name' => $level->name,
                'next' => $nextLevel?->name,
            ] : null,
            'classes' => $level
                ? $open->where('level_id', $level->id)->map(function (SchoolClass $option) use ($continuing, $undecidedIn) {
                    $total = $continuing->where('school_class_id', $option->id)->count();

                    return [
                        'id' => $option->id,
                        'name' => $option->name,
                        'total' => $total,
                        'decided' => $total - $undecidedIn($option),
                    ];
                })->values()
                : [],
            'class' => $class ? ['id' => $class->id, 'name' => $class->name] : null,
            'students' => $rows->map(fn (Enrolment $enrolment) => [
                'id' => $enrolment->id,
                'name' => $enrolment->student?->full_name,
                'matricule' => $enrolment->student?->admission_no,
                'decision' => $enrolment->decision?->value,
                'owed' => $this->owed($enrolment),
            ]),
        ]);
    }

    public function decide(DecideReEnrolmentRequest $request, DecideReEnrolment $decide): RedirectResponse
    {
        $data = $request->validated();
        $decide->decide($this->schoolContext->school(), $this->schoolContext->year(), $this->schoolContext->requireNextYear(), $data['enrolment_id'], isset($data['decision']) ? EnrolmentDecision::from($data['decision']) : null, $request->user());

        return back();
    }

    public function promoteClass(PromoteClassRequest $request, DecideReEnrolment $decide): RedirectResponse
    {
        $decide->promoteClass($this->schoolContext->school(), $this->schoolContext->year(), $this->schoolContext->requireNextYear(), $request->validated('class_id'), $request->user());
        $this->notify('Class promoted.');

        return back();
    }

    /**
     * What the student still owes across every invoice.
     */
    protected function owed(Enrolment $enrolment): float
    {
        $student = $enrolment->student;
        $invoices = $student ? $student->invoices : new Collection;
        $due = (int) $invoices->sum(fn (Invoice $invoice) => Money::units($invoice->amount_due) - $invoice->exemptedMinor());
        $paid = Money::sum($invoices->flatMap(fn (Invoice $invoice) => $invoice->payments->pluck('amount')));

        return Money::number(max(0, $due - $paid));
    }
}
