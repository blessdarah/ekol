<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
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
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SetupController extends Controller
{
    protected function school(Request $request): School
    {
        $school = app('currentSchool');

        if (! $school instanceof School) {
            abort(404);
        }

        return $school;
    }

    protected function managedYear(Request $request, School $school): ?AcademicYear
    {
        $yearId = $request->query('year');

        $query = AcademicYear::where('school_id', $school->id)->orderByDesc('starts_on');

        if ($yearId) {
            return $query->clone()->where('id', $yearId)->firstOrFail();
        }

        return $query->clone()->where('status', 'current')->first()
            ?? $query->first();
    }

    public function show(Request $request): Response
    {
        $school = $this->school($request);
        $year = $this->managedYear($request, $school);

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
                    'id', 'name', 'code', 'slug', 'ownership', 'region', 'town',
                    'cycle', 'subsystem', 'currency', 'timezone', 'school_days',
                ]),
                'logo_url' => $school->logo_path ? "/storage/{$school->logo_path}" : null,
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

    public function updateProfile(Request $request): RedirectResponse
    {
        $school = $this->school($request);

        if ($request->has('slug')) {
            throw ValidationException::withMessages([
                'slug' => 'The workspace address cannot be changed.',
            ]);
        }

        // SVGs carry no raster dimensions; the size rule applies to PNGs only.
        $logoRules = ['sometimes', 'file', 'mimes:png,svg', 'max:2048'];

        if ($request->hasFile('logo')
            && strtolower((string) $request->file('logo')->getClientOriginalExtension()) !== 'svg'
        ) {
            $logoRules[] = Rule::dimensions()->minWidth(256)->minHeight(256)->ratio(1);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'max:255'],
            'ownership' => ['sometimes', Rule::in(School::OWNERSHIP_OPTIONS)],
            'region' => ['sometimes', 'nullable', Rule::in(School::REGIONS)],
            'town' => ['sometimes', 'nullable', 'string', 'max:255'],
            'subsystem' => ['sometimes', 'nullable', Rule::in(School::SUBSYSTEM_OPTIONS)],
            'currency' => ['sometimes', 'string', 'size:3'],
            'timezone' => ['sometimes', 'string', 'max:255'],
            'logo' => $logoRules,
        ]);

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
            'name', 'code', 'ownership', 'region', 'town',
            'subsystem', 'currency', 'timezone', 'logo_path',
        ]));

        $before = $school->only(array_keys($dirty));
        $school->update($dirty);

        $this->audit($request, 'school', $school->id, 'profile_updated', [
            'before' => $before,
            'after' => $school->only(array_keys($dirty)),
        ]);

        return back();
    }

    public function storeYear(Request $request): RedirectResponse
    {
        $school = $this->school($request);

        $data = $request->validate([
            'label' => ['required', 'string', 'max:255', Rule::unique('academic_years')->where('school_id', $school->id)],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
        ]);

        $year = AcademicYear::create([
            'school_id' => $school->id,
            ...$data,
            'status' => 'planned',
        ]);

        $this->audit($request, 'academic_year', $year->id, 'created', $data);

        return back();
    }

    public function updateYear(Request $request, string $year): RedirectResponse
    {
        $school = $this->school($request);
        $target = AcademicYear::where('school_id', $school->id)
            ->where('id', $year)
            ->firstOrFail();

        $data = $request->validate([
            'label' => [
                'required', 'string', 'max:255',
                Rule::unique('academic_years')->where('school_id', $school->id)->ignore($target->id),
            ],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
        ]);

        $outside = Term::where('academic_year_id', $target->id)
            ->where(fn ($query) => $query
                ->whereDate('starts_on', '<', $data['starts_on'])
                ->orWhereDate('ends_on', '>', $data['ends_on']))
            ->orderBy('sequence')
            ->first();

        if ($outside) {
            throw ValidationException::withMessages([
                'starts_on' => "{$outside->label} falls outside these dates. Change the term first.",
            ]);
        }

        $before = $this->yearPayload($target);
        $target->update($data);

        $this->audit($request, 'academic_year', $target->id, 'updated', [
            'before' => $before,
            'after' => $this->yearPayload($target),
        ]);

        return back();
    }

    /**
     * Make a year the school's current one. The year it replaces closes
     * when it lies in the past and returns to planned otherwise, and the
     * active term moves into the new year (today's term, else the first).
     */
    public function activateYear(Request $request, string $year): RedirectResponse
    {
        $school = $this->school($request);
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

        $this->audit($request, 'academic_year', $target->id, 'activated', [
            'label' => $target->label,
        ]);

        return back();
    }

    public function updateInstallments(Request $request): RedirectResponse
    {
        $school = $this->school($request);
        $year = $this->managedYear($request, $school);

        abort_if(! $year, 422, 'Create an academic year first.');

        $data = $request->validate([
            'templates' => ['required', 'array', 'min:1'],
            'templates.*.seq' => ['required', 'integer', 'min:1'],
            'templates.*.percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'templates.*.due_on' => ['nullable', 'date'],
        ]);

        $total = array_sum(array_column($data['templates'], 'percent'));

        if (abs($total - 100) > 0.01) {
            throw ValidationException::withMessages([
                'templates' => 'Percents must sum to 100.',
            ]);
        }

        DB::transaction(function () use ($school, $year, $data) {
            FeeInstallmentTemplate::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->delete();

            foreach ($data['templates'] as $row) {
                FeeInstallmentTemplate::create([
                    'school_id' => $school->id,
                    'academic_year_id' => $year->id,
                    'seq' => $row['seq'],
                    'percent' => $row['percent'],
                    'due_on' => $row['due_on'] ?? null,
                ]);
            }
        });

        $this->audit($request, 'fee_installment_template', $year->id, 'schedule_saved', $data);

        return back();
    }

    public function updateWindows(Request $request): RedirectResponse
    {
        $school = $this->school($request);

        $data = $request->validate([
            'assessments' => ['required', 'array'],
            'assessments.*.id' => ['required', 'uuid'],
            'assessments.*.window_starts_on' => ['nullable', 'date'],
            'assessments.*.window_ends_on' => ['nullable', 'date', 'after_or_equal:assessments.*.window_starts_on'],
        ]);

        foreach ($data['assessments'] as $row) {
            $assessment = Assessment::where('school_id', $school->id)
                ->where('id', $row['id'])
                ->firstOrFail();
            $assessment->update([
                'window_starts_on' => $row['window_starts_on'],
                'window_ends_on' => $row['window_ends_on'],
            ]);
        }

        $this->audit($request, 'assessment', $school->id, 'windows_saved', [
            'count' => count($data['assessments']),
        ]);

        return back();
    }

    public function updateSchoolday(Request $request): RedirectResponse
    {
        $school = $this->school($request);

        $data = $request->validate([
            'school_days' => ['sometimes', 'integer', 'min:0', 'max:127'],
            'periods' => ['sometimes', 'array'],
            'periods.*.id' => ['nullable', 'uuid'],
            'periods.*.label' => ['required_with:periods', 'string', 'max:255'],
            'periods.*.starts_at' => ['required_with:periods', 'date_format:H:i'],
            'periods.*.ends_at' => ['required_with:periods', 'date_format:H:i', 'after:periods.*.starts_at'],
            'periods.*.is_break' => ['sometimes', 'boolean'],
            'periods.*._delete' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($school, $data) {
            if (array_key_exists('school_days', $data)) {
                $school->update(['school_days' => $data['school_days']]);
            }

            // Soft-deleted rows keep their ordinal, so new ones go past the end.
            $nextOrdinal = (int) Period::withTrashed()->where('school_id', $school->id)->max('ordinal');

            foreach ($data['periods'] ?? [] as $row) {
                if (! empty($row['id'])) {
                    $period = Period::where('school_id', $school->id)
                        ->where('id', $row['id'])
                        ->firstOrFail();
                    if (! empty($row['_delete'])) {
                        if ($period->timetableSlots()->exists()) {
                            throw ValidationException::withMessages([
                                'periods' => "Period {$period->label} is on the timetable and cannot be deleted.",
                            ]);
                        }
                        $period->delete();

                        continue;
                    }

                    $period->update([
                        'label' => $row['label'],
                        'starts_at' => $row['starts_at'],
                        'ends_at' => $row['ends_at'],
                        'is_break' => (bool) ($row['is_break'] ?? false),
                    ]);

                    continue;
                }

                if (! empty($row['_delete'])) {
                    continue;
                }

                Period::create([
                    'school_id' => $school->id,
                    'label' => $row['label'],
                    'ordinal' => ++$nextOrdinal,
                    'starts_at' => $row['starts_at'],
                    'ends_at' => $row['ends_at'],
                    'is_break' => (bool) ($row['is_break'] ?? false),
                ]);
            }
        });

        $this->audit($request, 'period', $school->id, 'schoolday_saved', [
            'school_days' => $data['school_days'] ?? null,
        ]);

        return back();
    }

    public function updateTerms(Request $request): RedirectResponse
    {
        $school = $this->school($request);
        $year = $this->managedYear($request, $school);

        abort_if(! $year, 422, 'Create an academic year first.');

        $data = $request->validate([
            'terms' => ['required', 'array', 'min:1'],
            'terms.*.id' => ['nullable', 'uuid'],
            'terms.*.label' => ['required', 'string', 'max:255'],
            'terms.*.sequence' => ['required', 'integer', 'min:1'],
            'terms.*.starts_on' => ['required', 'date'],
            'terms.*.ends_on' => ['required', 'date', 'after_or_equal:terms.*.starts_on'],
            'terms.*.week_count' => ['required', 'integer', 'min:1'],
        ]);

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

        $this->audit($request, 'term', $year->id, 'terms_saved', [
            'count' => count($data['terms']),
        ]);

        return back();
    }

    /**
     * Make a term the school's active one. Only terms of the current
     * academic year qualify: moving between years is rollover, not Setup.
     */
    public function activateTerm(Request $request, string $term): RedirectResponse
    {
        $school = $this->school($request);

        $target = Term::where('school_id', $school->id)
            ->where('id', $term)
            ->firstOrFail();

        if ($target->academicYear?->status !== AcademicYearStatus::Current) {
            throw ValidationException::withMessages([
                'term' => 'Only a term of the current academic year can be made active.',
            ]);
        }

        DB::transaction(function () use ($school, $target) {
            Term::where('school_id', $school->id)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            Term::whereKey($target->id)->update(['is_current' => true]);
        });

        $this->audit($request, 'term', $target->id, 'activated', [
            'label' => $target->label,
        ]);

        return back();
    }

    protected function audit(Request $request, string $entity, string $entityId, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $this->school($request)->id,
            'actor_id' => $request->user()?->id,
            'entity' => $entity,
            'entity_id' => $entityId,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
