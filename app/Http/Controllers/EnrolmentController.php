<?php

namespace App\Http\Controllers;

use App\Enums\ApplicationStage;
use App\Enums\EnrolmentDecision;
use App\Models\Application;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class EnrolmentController extends Controller
{
    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();
        $current = $this->schoolContext->year();

        if (! $next) {
            return Inertia::render('enrolment/overview', [
                'enrolment' => null,
                'currentLabel' => $current?->label,
            ]);
        }

        $stages = Application::where('academic_year_id', $next->id)->pluck('stage');
        $successors = $school->successorLevels();
        $continuing = Enrolment::continuingFor($school, $this->schoolContext->year());
        $deciding = $continuing->filter(fn (Enrolment $enrolment) => isset($successors[(string) $enrolment->schoolClass?->level_id]));
        $progress = $next->enrolmentProgress($school, $this->schoolContext->year());

        return Inertia::render('enrolment/overview', [
            'enrolment' => $progress,
            'currentLabel' => $current?->label,
            'startsOn' => $next->starts_on->toDateString(),
            'applications' => [
                'total' => $stages->count(),
                'admitted' => $stages->filter(fn (ApplicationStage $stage) => $stage === ApplicationStage::Admitted)->count(),
                'to_review' => $progress['to_review'],
                'waitlist' => $stages->filter(fn (ApplicationStage $stage) => $stage === ApplicationStage::Waitlist)->count(),
                'declined' => $stages->filter(fn (ApplicationStage $stage) => $stage === ApplicationStage::Declined)->count(),
            ],
            'continuing' => [
                'total' => $deciding->count(),
                'promote' => $deciding->where('decision', EnrolmentDecision::Promote)->count(),
                'repeat' => $deciding->where('decision', EnrolmentDecision::Repeat)->count(),
                'leaving' => $deciding->where('decision', EnrolmentDecision::Leaving)->count(),
                'undecided' => $progress['undecided'],
                'graduating' => $continuing->count() - $deciding->count(),
            ],
            'levels' => $next->enrolmentCapacity($school),
            'copyable' => $current
                ? SchoolClass::where('academic_year_id', $current->id)->count()
                : 0,
        ]);
    }

    /**
     * Give the coming year the same classes as this year: names, seats,
     * streams and home rooms. Form masters are chosen again each year.
     */
    public function copyClasses(Request $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $current = $this->schoolContext->year();

        if (SchoolClass::where('academic_year_id', $next->id)->exists()) {
            throw ValidationException::withMessages(['classes' => __(':label already has classes.', ['label' => $next->label])]);
        }

        $classes = $current
            ? SchoolClass::where('academic_year_id', $current->id)->orderBy('name')->get()
            : new Collection;

        if ($classes->isEmpty()) {
            throw ValidationException::withMessages(['classes' => __('This year has no classes to copy.')]);
        }

        DB::transaction(function () use ($request, $school, $next, $classes) {
            foreach ($classes as $class) {
                SchoolClass::create([
                    'school_id' => $school->id,
                    'academic_year_id' => $next->id,
                    'level_id' => $class->level_id,
                    'name' => $class->name,
                    'capacity' => $class->capacity,
                    'stream' => $class->stream,
                    'home_room_id' => $class->home_room_id,
                ]);
            }

            AuditEvent::record($school, $request->user(), 'academic_year', $next->id, 'classes_copied', ['classes' => $classes->count()]);
        });

        $this->notify('Classes copied to the coming year.');

        return back();
    }

    public function storeClass(Request $request, string $level): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->requireNextYear();
        $target = Level::where('school_id', $school->id)->where('id', $level)->firstOrFail();

        $taken = SchoolClass::withTrashed()
            ->where('academic_year_id', $next->id)
            ->where('level_id', $target->id)
            ->pluck('name')
            ->all();

        $name = collect(range('A', 'Z'))
            ->map(fn (string $letter) => SchoolClass::nameFor($target->name, $letter))
            ->first(fn (string $candidate) => ! in_array($candidate, $taken, true));

        if (! $name) {
            throw ValidationException::withMessages(['class' => __('This level already has every class from A to Z.')]);
        }

        $class = SchoolClass::create([
            'school_id' => $school->id,
            'academic_year_id' => $next->id,
            'level_id' => $target->id,
            'name' => $name,
            'capacity' => SchoolClass::DEFAULT_SEATS,
        ]);

        AuditEvent::record($school, $request->user(), 'school_class', $class->id, 'created', ['name' => $name, 'year' => $next->label]);

        $this->notify('Class added.');

        return back();
    }
}
