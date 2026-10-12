<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
use App\Http\Requests\Setup\StoreYearRequest;
use App\Http\Requests\Setup\UpdateInstallmentsRequest;
use App\Http\Requests\Setup\UpdateProfileRequest;
use App\Http\Requests\Setup\UpdateSchooldayRequest;
use App\Http\Requests\Setup\UpdateTermsRequest;
use App\Http\Requests\Setup\UpdateWindowsRequest;
use App\Http\Requests\Setup\UpdateYearRequest;
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

    public function updateProfile(UpdateProfileRequest $request): RedirectResponse
    {
        $school = $this->school($request);

        if ($request->has('slug')) {
            throw ValidationException::withMessages([
                'slug' => 'The workspace address cannot be changed.',
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
            'name', 'code', 'ownership', 'region', 'town',
            'subsystem', 'currency', 'timezone', 'logo_path',
        ]));

        $before = $school->only(array_keys($dirty));
        $school->update($dirty);

        $this->audit($request, 'school', $school->id, 'profile_updated', [
            'before' => $before,
            'after' => $school->only(array_keys($dirty)),
        ]);

        $this->notify('School profile saved.');

        return back();
    }

    public function storeYear(StoreYearRequest $request): RedirectResponse
    {
        $school = $this->school($request);

        $data = $request->validated();

        $year = AcademicYear::create([
            'school_id' => $school->id,
            ...$data,
            'status' => 'planned',
        ]);

        $this->audit($request, 'academic_year', $year->id, 'created', $data);

        $this->notify('Academic year added.');

        return back();
    }

    public function updateYear(UpdateYearRequest $request, string $year): RedirectResponse
    {
        $school = $this->school($request);
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
                'starts_on' => "{$outside->label} falls outside these dates. Change the term first.",
            ]);
        }

        $before = $this->yearPayload($target);
        $target->update($data);

        $this->audit($request, 'academic_year', $target->id, 'updated', [
            'before' => $before,
            'after' => $this->yearPayload($target),
        ]);

        $this->notify('Academic year saved.');

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

        $this->notify('Academic year made current.');

        return back();
    }

    public function updateInstallments(UpdateInstallmentsRequest $request): RedirectResponse
    {
        $school = $this->school($request);
        $year = $this->managedYear($request, $school);

        abort_if(! $year, 422, 'Create an academic year first.');

        $data = $request->validated();

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

        $this->notify('Installments saved.');

        return back();
    }

    public function updateWindows(UpdateWindowsRequest $request): RedirectResponse
    {
        $school = $this->school($request);

        $data = $request->validated();

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

        $this->notify('Marks windows saved.');

        return back();
    }

    public function updateSchoolday(UpdateSchooldayRequest $request): RedirectResponse
    {
        $school = $this->school($request);

        $data = $request->validated();

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

        $this->notify('School day saved.');

        return back();
    }

    public function updateTerms(UpdateTermsRequest $request): RedirectResponse
    {
        $school = $this->school($request);
        $year = $this->managedYear($request, $school);

        abort_if(! $year, 422, 'Create an academic year first.');

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

        $this->audit($request, 'term', $year->id, 'terms_saved', [
            'count' => count($data['terms']),
        ]);

        $this->notify('Terms saved.');

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

        $this->notify('Term made active.');

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
