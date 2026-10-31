<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Models\AssessmentPlan;
use App\Models\AuditEvent;
use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AssessmentResultController extends Controller
{
    public function results(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $plans = AssessmentPlan::forYear($school, $year)
            ->filter(fn (AssessmentPlan $plan) => in_array($plan->state, [AssessmentState::MarksOpen, AssessmentState::MarksClosed, AssessmentState::Published], true))
            ->values();
        $plan = $plans->firstWhere('id', (string) $request->query('plan', ''))
            ?? $plans->firstWhere('state', AssessmentState::MarksClosed)
            ?? $plans->last();
        $classes = $plan
            ? SchoolClass::whereIn('id', $plan->assessments()->select('school_class_id'))->orderBy('name')->get()
            : new Collection;
        $classId = (string) $request->query('class', '');
        $shown = $classId === 'all' ? $classes : $classes->where('id', $classes->firstWhere('id', $classId)->id ?? $classes->first()?->id);
        $rows = [];

        foreach ($plan ? $shown : [] as $class) {
            foreach ($plan->standings($class) as $studentId => $row) {
                $rows[$studentId] = [...$row, 'id' => $studentId, 'class' => $class->name];
                unset($rows[$studentId]['subjects']);
            }
        }

        $ranks = AssessmentPlan::rank(array_map(
            fn (array $row) => (float) $row['average'],
            array_filter($rows, fn (array $row) => $row['complete']),
        ));
        $averages = collect($rows)->pluck('average')->filter(fn (?float $average) => $average !== null);
        $pass = (float) $school->pass_mark;
        $missing = (int) collect($rows)->sum(fn (array $row) => count($row['missing']));

        return Inertia::render('assessments/results', [
            'tabs' => AssessmentPlan::tabs($school, $year),
            'plans' => $plans->map(fn (AssessmentPlan $option) => $option->summary()),
            'plan' => $plan ? $plan->summary() : null,
            'classes' => $classes->map(fn (SchoolClass $class) => ['id' => $class->id, 'name' => $class->name]),
            'class' => $classId === 'all' ? 'all' : $shown->first()?->id,
            'passMark' => $pass,
            'stats' => [
                'average' => $averages->isNotEmpty() ? round((float) $averages->avg(), 2) : null,
                'highest' => $averages->max(),
                'lowest' => $averages->min(),
                'passed' => $averages->isNotEmpty() ? (int) round($averages->filter(fn (float $average) => $average >= $pass)->count() / $averages->count() * 100) : null,
            ],
            'missing' => $missing,
            'rows' => collect($rows)
                ->map(fn (array $row) => [...$row, 'rank' => $ranks[$row['id']] ?? null])
                ->sortBy([
                    fn (array $a, array $b) => ($a['rank'] ?? PHP_INT_MAX) <=> ($b['rank'] ?? PHP_INT_MAX),
                    fn (array $a, array $b) => ($b['average'] ?? -1) <=> ($a['average'] ?? -1),
                    fn (array $a, array $b) => $a['name'] <=> $b['name'],
                ])
                ->values(),
        ]);
    }

    /**
     * Publish an assessment's results for every class. Marks lock; a
     * later change goes through Corrections.
     */
    public function publish(Request $request, string $plan): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = AssessmentPlan::forSchool($school->id)->whereKey($plan)->with('term')->firstOrFail();

        if ($target->state !== AssessmentState::MarksClosed) {
            throw ValidationException::withMessages([
                'publish' => $target->state === AssessmentState::Published
                    ? __(':name is already published.', ['name' => $target->name])
                    : __('Close marks entry before publishing results.'),
            ]);
        }

        $target->moveTo(AssessmentState::Published, ['published_at' => now(), 'published_by' => $request->user()?->id]);
        AuditEvent::record($school, $request->user(), 'assessment_plan', $target->id, 'published', []);

        $this->notify('Results published.');

        return redirect()->route('assessments.reports', ['plan' => $target->id]);
    }
}
