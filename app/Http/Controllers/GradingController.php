<?php

namespace App\Http\Controllers;

use App\Http\Requests\Assessments\UpdateGradingRequest;
use App\Models\AssessmentPlan;
use App\Models\AuditEvent;
use App\Models\GradeBand;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The pass mark and the grade bands every assessment, term and year
 * is read with.
 */
class GradingController extends Controller
{
    public function show(Request $request): Response
    {
        [$school, $year] = AssessmentController::context($request);

        return Inertia::render('assessments/grading', [
            'tabs' => AssessmentController::tabs($school, $year),
            'outOf' => AssessmentPlan::OUT_OF,
            'passMark' => (float) $school->pass_mark,
            'bands' => array_map(fn (array $band) => [
                'letter' => $band['letter'],
                'from' => $band['from'],
                'to' => $band['to'],
                'meaning' => $band['meaning'],
                'remark' => $band['remark'],
            ], GradeBand::scale($school->id)),
            'standard' => GradeBand::STANDARD,
            'isStandard' => ! GradeBand::where('school_id', $school->id)->exists(),
            'canEdit' => (bool) $request->user()?->can('manage-staff'),
        ]);
    }

    /**
     * Save the pass mark and the scale. Bands must cover 0 to 20 with
     * no gap and no overlap.
     */
    public function update(UpdateGradingRequest $request): RedirectResponse
    {
        [$school] = AssessmentController::context($request);
        $user = $request->user();
        Gate::authorize('manage-staff');
        $top = AssessmentPlan::OUT_OF;

        $data = $request->validated();

        $bands = collect($this->bandRows($data))
            ->map(fn (array $band) => [...$band, 'from' => round((float) $band['from'], 2), 'to' => round((float) $band['to'], 2)])
            ->sortByDesc('from')
            ->values();

        foreach ($bands as $position => $band) {
            $above = $bands->get($position - 1);

            if ($band['to'] < $band['from']) {
                throw ValidationException::withMessages(['bands' => __('Grade :letter ends below where it starts.', ['letter' => $band['letter']])]);
            }

            if ($position === 0 ? abs($band['to'] - $top) > 0.001 : abs($above['from'] - $band['to'] - 0.01) > 0.001) {
                throw ValidationException::withMessages([
                    'bands' => $position === 0
                        ? __('The top grade must end at :top.', ['top' => $top])
                        : __('Grade :letter must end at :value, just below grade :above.', ['letter' => $band['letter'], 'value' => number_format($above['from'] - 0.01, 2), 'above' => $above['letter']]),
                ]);
            }
        }

        if (abs($bands->last()['from']) > 0.001) {
            throw ValidationException::withMessages(['bands' => __('The lowest grade must start at 0.')]);
        }

        DB::transaction(function () use ($school, $data, $bands, $user) {
            $school->update(['pass_mark' => $data['pass_mark']]);
            $keep = [];

            foreach ($bands as $position => $band) {
                $keep[] = GradeBand::updateOrCreate(
                    ['school_id' => $school->id, 'letter' => strtoupper(trim($band['letter']))],
                    [
                        'from_percent' => round($band['from'] * 5, 2),
                        'to_percent' => round($band['to'] * 5, 2),
                        'meaning' => trim($band['meaning']),
                        'standard_remark' => trim($band['remark']),
                        'rank_order' => $position + 1,
                    ],
                )->id;
            }

            GradeBand::where('school_id', $school->id)->whereNotIn('id', $keep)->delete();

            AuditEvent::create([
                'school_id' => $school->id,
                'actor_id' => $user->id,
                'entity' => 'school',
                'entity_id' => $school->id,
                'action' => 'grading_saved',
                'diff' => ['pass_mark' => $data['pass_mark'], 'bands' => $bands->pluck('letter')->all()],
            ]);
        });

        $this->notify('Grading saved.');

        return back();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{letter: string, from: float|int|string, to: float|int|string, meaning: string, remark: string}>
     */
    protected function bandRows(array $data): array
    {
        return $data['bands'];
    }
}
