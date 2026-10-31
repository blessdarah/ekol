<?php

namespace App\Http\Controllers;

use App\Http\Requests\Structure\UpdateClassRequest;
use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\SchoolClass;
use App\Models\TimetableSlot;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SchoolClassController extends Controller
{
    public function storeClass(Request $request, string $level): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = Level::where('school_id', $school->id)->where('id', $level)->firstOrFail();
        $year = $this->schoolContext->year();

        if (! $year) {
            throw ValidationException::withMessages([
                'class' => __('Classes belong to an academic year. Make a year active in School Setup first.'),
            ]);
        }

        $taken = SchoolClass::withTrashed()
            ->where('academic_year_id', $year->id)
            ->where('level_id', $target->id)
            ->pluck('name')
            ->all();

        $name = collect(range('A', 'Z'))
            ->map(fn (string $letter) => SchoolClass::nameFor($target->name, $letter))
            ->first(fn (string $candidate) => ! in_array($candidate, $taken, true));

        if (! $name) {
            throw ValidationException::withMessages([
                'class' => __('This level already has every class from A to Z.'),
            ]);
        }

        $class = SchoolClass::create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'level_id' => $target->id,
            'name' => $name,
            'capacity' => SchoolClass::DEFAULT_SEATS,
        ]);

        AuditEvent::record($school, $request->user(), 'school_class', $class->id, 'created', ['name' => $name]);

        $this->notify('Class added.');

        return back();
    }

    public function updateClass(UpdateClassRequest $request, string $class): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = SchoolClass::where('school_id', $school->id)->where('id', $class)->firstOrFail();

        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $target, $data) {
            $before = $target->only(array_keys($data));
            $target->update($data);

            AuditEvent::record($school, $request->user(), 'school_class', $target->id, 'updated', [
                'before' => $before,
                'after' => $target->only(array_keys($data)),
            ]);
        });

        $this->notify('Class saved.');

        return back();
    }

    public function destroyClass(Request $request, string $class): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = SchoolClass::where('school_id', $school->id)->where('id', $class)->firstOrFail();

        $inUse = Enrolment::where('school_class_id', $target->id)->exists()
            || TimetableSlot::where('school_class_id', $target->id)->exists()
            || Assessment::where('school_class_id', $target->id)->exists();

        if ($inUse) {
            throw ValidationException::withMessages([
                'class' => __(':name has students, lessons or assessments. Move them before removing the class.', ['name' => $target->name]),
            ]);
        }

        DB::transaction(function () use ($request, $school, $target) {
            AuditEvent::record($school, $request->user(), 'school_class', $target->id, 'removed', ['name' => $target->name]);

            // Nothing references it, so the name is freed for reuse.
            $target->forceDelete();
        });

        $this->notify('Class removed.');

        return back();
    }
}
