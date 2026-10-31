<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
use App\Http\Requests\Setup\StoreYearRequest;
use App\Http\Requests\Setup\UpdateProfileRequest;
use App\Http\Requests\Setup\UpdateTermsRequest;
use App\Http\Requests\Setup\UpdateYearRequest;
use App\Http\SchoolSetupYear;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\FeeInstallmentTemplate;
use App\Models\Period;
use App\Models\School;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SetupController extends Controller
{
    public function show(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = SchoolSetupYear::selected($request, $school);

        $terms = $year
            ? Term::where('academic_year_id', $year->id)->orderBy('sequence')->get()
            : collect();
        $templates = $year
            ? FeeInstallmentTemplate::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->orderBy('seq')->get()
            : collect();
        $periods = Period::where('school_id', $school->id)
            ->orderBy('starts_at')->orderBy('ordinal')->get();

        return Inertia::render('setup', [
            'school' => [
                ...$school->only([
                    'id', 'name', 'motto', 'code', 'slug', 'ownership', 'region', 'town',
                    'cycle', 'subsystem', 'currency', 'timezone', 'school_days', 'locale',
                ]),
                'logo_url' => $school->logo_path ? "/storage/{$school->logo_path}" : null,
                'day_starts_at' => substr((string) $school->day_starts_at, 0, 5),
                'period_minutes' => $school->period_minutes,
            ],
            'years' => AcademicYear::where('school_id', $school->id)
                ->orderByDesc('starts_on')
                ->get()
                ->map(fn (AcademicYear $option) => $this->yearPayload($option)),
            'year' => $year ? $this->yearPayload($year) : null,
            'terms' => $terms->map(fn (Term $term) => [
                'id' => $term->id,
                'label' => $term->label,
                'sequence' => $term->sequence,
                'starts_on' => $term->starts_on->toDateString(),
                'ends_on' => $term->ends_on->toDateString(),
                'week_count' => $term->week_count,
                'is_current' => $term->is_current,
                'has_marks' => $term->hasMarks(),
            ]),
            'templates' => $templates->map(fn (FeeInstallmentTemplate $template) => [
                'seq' => $template->seq,
                'percent' => (float) $template->percent,
                'due_on' => $template->due_on?->toDateString(),
            ]),
            'periods' => $periods->map(fn (Period $period) => [
                'id' => $period->id,
                'label' => $period->label,
                'starts_at' => substr($period->starts_at, 0, 5),
                'ends_at' => substr($period->ends_at, 0, 5),
                'is_break' => $period->is_break,
                'custom_minutes' => $period->custom_minutes,
            ]),
            'assessments' => $this->assessmentWindows($school, $terms->pluck('id')->all()),
        ]);
    }

    /**
     * @return array{id: string, label: string, status: string, starts_on: string, ends_on: string}
     */
    protected function yearPayload(AcademicYear $year): array
    {
        return [
            'id' => $year->id,
            'label' => $year->label,
            'status' => $year->status->value,
            'starts_on' => $year->starts_on->toDateString(),
            'ends_on' => $year->ends_on->toDateString(),
        ];
    }

    /**
     * Assessments exist once per class; Setup shows one row per term and
     * name, so a window edit applies to every class sitting it.
     *
     * @param  array<int, string>  $termIds
     * @return array<int, array{ids: array<int, string>, name: string, kind: string, window_starts_on: string|null, window_ends_on: string|null, window_status: string}>
     */
    protected function assessmentWindows(School $school, array $termIds): array
    {
        return Assessment::where('school_id', $school->id)
            ->whereIn('term_id', $termIds)
            ->orderBy('created_at')
            ->get()
            ->groupBy(fn (Assessment $assessment) => $assessment->term_id.'|'.$assessment->name)
            ->map(function ($group) {
                /** @var Assessment $first */
                $first = $group->first();

                return [
                    'ids' => $group->modelKeys(),
                    'name' => $first->name,
                    'kind' => $first->kind->value,
                    'window_starts_on' => $first->window_starts_on?->toDateString(),
                    'window_ends_on' => $first->window_ends_on?->toDateString(),
                    'window_status' => $this->windowStatus($first),
                ];
            })
            ->sortBy(fn (array $row) => $row['window_starts_on'] ?? '9999')
            ->values()
            ->all();
    }

    protected function windowStatus(Assessment $assessment): string
    {
        if (! $assessment->window_starts_on || ! $assessment->window_ends_on) {
            return 'unscheduled';
        }

        if (today()->lt($assessment->window_starts_on)) {
            return 'scheduled';
        }

        return today()->gt($assessment->window_ends_on) ? 'closed' : 'open';
    }

    public function updateProfile(UpdateProfileRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();

        if ($request->has('slug')) {
            throw ValidationException::withMessages([
                'slug' => __('The workspace address cannot be changed.'),
            ]);
        }

        $data = $request->validated();

        if ($request->hasFile('logo')) {
            if ($school->logo_path) {
                Storage::disk('public')->delete($school->logo_path);
            }

            $data['logo_path'] = $request->file('logo')->store(
                "logos/{$school->id}", 'public'
            );
            unset($data['logo']);
        }

        $dirty = array_intersect_key($data, array_flip([
            'name', 'motto', 'code', 'ownership', 'region', 'town',
            'subsystem', 'currency', 'timezone', 'logo_path', 'locale',
        ]));

        $before = $school->only(array_keys($dirty));
        $school->update($dirty);

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'school', $school->id, 'profile_updated', [
            'before' => $before,
            'after' => $school->only(array_keys($dirty)),
        ]);

        $this->notify('School profile saved.');

        return back();
    }

    public function storeYear(StoreYearRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();

        $data = $request->validated();

        $year = AcademicYear::create([
            'school_id' => $school->id,
            ...$data,
            'status' => 'planned',
        ]);

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'academic_year', $year->id, 'created', $data);

        $this->notify('Academic year added.');

        $this->schoolContext->refresh();

        return back();
    }

    public function updateYear(UpdateYearRequest $request, string $year): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = AcademicYear::where('school_id', $school->id)
            ->where('id', $year)
            ->firstOrFail();

        $data = $request->validated();

        $outside = Term::where('academic_year_id', $target->id)
            ->where(fn ($query) => $query
                ->whereDate('starts_on', '<', $data['starts_on'])
                ->orWhereDate('ends_on', '>', $data['ends_on']))
            ->orderBy('sequence')
            ->first();

        if ($outside) {
            throw ValidationException::withMessages([
                'starts_on' => __(':label falls outside these dates. Change the term first.', ['label' => $outside->label]),
            ]);
        }

        $before = $this->yearPayload($target);
        $target->update($data);

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'academic_year', $target->id, 'updated', [
            'before' => $before,
            'after' => $this->yearPayload($target),
        ]);

        $this->notify('Academic year saved.');

        $this->schoolContext->refresh();

        return back();
    }

    /**
     * Make a year the school's current one. The year it replaces closes
     * when it lies in the past and returns to planned otherwise, and the
     * active term moves into the new year (today's term, else the first).
     */
    public function activateYear(Request $request, string $year): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = AcademicYear::where('school_id', $school->id)
            ->where('id', $year)
            ->firstOrFail();

        if ($target->status === AcademicYearStatus::Current) {
            return back();
        }

        DB::transaction(function () use ($school, $target) {
            $previous = AcademicYear::where('school_id', $school->id)
                ->where('status', AcademicYearStatus::Current)
                ->first();

            $previous?->update([
                'status' => $previous->starts_on->lt($target->starts_on)
                    ? AcademicYearStatus::Closed
                    : AcademicYearStatus::Planned,
            ]);

            $target->update(['status' => AcademicYearStatus::Current]);

            Term::where('school_id', $school->id)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            $terms = Term::where('academic_year_id', $target->id)->orderBy('sequence')->get();
            $term = $terms->first(fn (Term $term) => today()->between($term->starts_on, $term->ends_on))
                ?? $terms->first();

            if ($term) {
                Term::whereKey($term->id)->update(['is_current' => true]);
            }
        });

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'academic_year', $target->id, 'activated', [
            'label' => $target->label,
        ]);

        $this->notify('Academic year made current.');

        $this->schoolContext->refresh();

        return back();
    }

    public function updateTerms(UpdateTermsRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = SchoolSetupYear::selected($request, $school);

        abort_if(! $year, 422, __('Create an academic year first.'));

        $data = $request->validated();

        foreach ($data['terms'] as $row) {
            if (! empty($row['id'])) {
                $term = Term::where('school_id', $school->id)
                    ->where('id', $row['id'])
                    ->firstOrFail();
                // Model guards enforce the marks-lock and year-bounds rules.
                $term->update($row);

                continue;
            }

            Term::create([
                'school_id' => $school->id,
                'academic_year_id' => $year->id,
                ...$row,
            ]);
        }

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'term', $year->id, 'terms_saved', [
            'count' => count($data['terms']),
        ]);

        $this->notify('Terms saved.');

        $this->schoolContext->refresh();

        return back();
    }

    /**
     * Make a term the school's active one. Only terms of the current
     * academic year qualify: moving between years is rollover, not Setup.
     */
    public function activateTerm(Request $request, string $term): RedirectResponse
    {
        $school = $this->schoolContext->school();

        $target = Term::where('school_id', $school->id)
            ->where('id', $term)
            ->firstOrFail();

        if ($target->academicYear?->status !== AcademicYearStatus::Current) {
            throw ValidationException::withMessages([
                'term' => __('Only a term of the current academic year can be made active.'),
            ]);
        }

        DB::transaction(function () use ($school, $target) {
            Term::where('school_id', $school->id)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            Term::whereKey($target->id)->update(['is_current' => true]);
        });

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'term', $target->id, 'activated', [
            'label' => $target->label,
        ]);

        $this->notify('Term made active.');

        $this->schoolContext->refresh();

        return back();
    }
}
