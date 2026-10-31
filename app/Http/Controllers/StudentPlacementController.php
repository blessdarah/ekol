<?php

namespace App\Http\Controllers;

use App\Actions\Enrolment\PlaceStudents;
use App\Http\EnrolmentOrigins;
use App\Http\Requests\Enrolment\ClearClassRequest;
use App\Http\Requests\Enrolment\PlaceLevelRequest;
use App\Http\Requests\Enrolment\PlaceStudentsRequest;
use App\Models\Enrolment;
use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StudentPlacementController extends Controller
{
    public function placement(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $next = $this->schoolContext->nextYear();

        if (! $next) {
            return redirect()->route('enrolment');
        }

        $capacity = collect($next->enrolmentCapacity($school));
        $busy = $capacity->filter(fn (array $level) => $level['expected'] > 0 || $level['classes'] > 0)->values();
        $level = $busy->firstWhere('id', (string) $request->query('level', ''))
            ?? $busy->first(fn (array $option) => $option['expected'] > $option['placed'])
            ?? $busy->first();

        $enrolments = $level
            ? Enrolment::where('academic_year_id', $next->id)
                ->where('level_id', $level['id'])
                ->with('student:id,full_name,admission_no')
                ->get()
            : new Collection;
        $origins = (new EnrolmentOrigins)->handle($school, $this->schoolContext->year(), $enrolments);
        $classes = $level
            ? SchoolClass::where('academic_year_id', $next->id)->where('level_id', $level['id'])->orderBy('name')->get()
            : new Collection;

        return Inertia::render('enrolment/placement', [
            'enrolment' => $next->enrolmentProgress($school, $this->schoolContext->year()),
            'levels' => $busy->map(fn (array $option) => [
                'id' => $option['id'],
                'name' => $option['name'],
                'over' => $option['expected'] > $option['seats'],
                'waiting' => $option['expected'] - $option['placed'],
            ]),
            'level' => $level,
            'waiting' => $enrolments
                ->whereNull('school_class_id')
                ->sortBy(fn (Enrolment $enrolment) => $enrolment->student?->full_name)
                ->map(fn (Enrolment $enrolment) => [
                    'id' => $enrolment->id,
                    'name' => $enrolment->student?->full_name,
                    'kind' => $origins[$enrolment->student_id]['kind'] ?? 'new',
                    'from' => $origins[$enrolment->student_id]['from'] ?? null,
                ])
                ->values(),
            'classes' => $classes->map(function (SchoolClass $class) use ($enrolments, $origins) {
                $placed = $enrolments->where('school_class_id', $class->id);
                $kinds = $placed->countBy(fn (Enrolment $enrolment) => $origins[$enrolment->student_id]['kind'] ?? 'new');

                return [
                    'id' => $class->id,
                    'name' => $class->name,
                    'capacity' => $class->capacity,
                    'placed' => $placed->count(),
                    'promoted' => (int) $kinds->get('promoted', 0),
                    'repeating' => (int) $kinds->get('repeating', 0),
                    'new' => (int) $kinds->get('new', 0),
                ];
            })->values(),
        ]);
    }

    public function place(PlaceStudentsRequest $request, PlaceStudents $place): RedirectResponse
    {
        $place->inClass($this->schoolContext->school(), $this->schoolContext->requireNextYear(), $request->validated('class_id'), $request->validated('enrolment_ids'), $request->user());
        $this->notify('Students placed.');

        return back();
    }

    public function placeAll(PlaceLevelRequest $request, PlaceStudents $place): RedirectResponse
    {
        $place->acrossLevel($this->schoolContext->school(), $this->schoolContext->requireNextYear(), $request->validated('level_id'), $request->user());
        $this->notify('Level placed.');

        return back();
    }

    public function clearClass(ClearClassRequest $request, PlaceStudents $place): RedirectResponse
    {
        $place->clearClass($this->schoolContext->school(), $this->schoolContext->requireNextYear(), $request->validated('class_id'), $request->user());
        $this->notify('Class cleared.');

        return back();
    }
}
