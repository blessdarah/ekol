<?php

namespace App\Http\Controllers;

use App\Http\Requests\Setup\UpdateInstallmentsRequest;
use App\Http\Requests\Setup\UpdateSchooldayRequest;
use App\Http\Requests\Setup\UpdateWindowsRequest;
use App\Http\SchoolSetupYear;
use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\FeeInstallmentTemplate;
use App\Models\Period;
use App\Models\School;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SchoolScheduleController extends Controller
{
    public function updateInstallments(UpdateInstallmentsRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = SchoolSetupYear::selected($request, $school);

        abort_if(! $year, 422, __('Create an academic year first.'));

        $data = $request->validated();

        $total = array_sum(array_column($data['templates'], 'percent'));

        if (abs($total - 100) > 0.01) {
            throw ValidationException::withMessages([
                'templates' => __('Percents must sum to 100.'),
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

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'fee_installment_template', $year->id, 'schedule_saved', $data);

        $this->notify('Installments saved.');

        return back();
    }

    public function updateWindows(UpdateWindowsRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();

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

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'assessment', $school->id, 'windows_saved', [
            'count' => count($data['assessments']),
        ]);

        $this->notify('Marks windows saved.');

        return back();
    }

    /**
     * Save the school day. Periods come in the order they run; each
     * starts when the one before it ends, beginning when the day starts,
     * and lasts the default length unless it has its own.
     */
    public function updateSchoolday(UpdateSchooldayRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();

        $data = $request->validated();

        DB::transaction(function () use ($school, $data) {
            $school->update(array_intersect_key($data, array_flip(['school_days', 'day_starts_at', 'period_minutes'])));

            if (! array_key_exists('periods', $data)) {
                $this->retime($school);

                return;
            }

            // Soft-deleted rows keep their ordinal, so new ones go past the end.
            $nextOrdinal = (int) Period::withTrashed()->where('school_id', $school->id)->max('ordinal');
            $kept = [];

            foreach ($data['periods'] as $row) {
                $period = empty($row['id'])
                    ? null
                    : Period::where('school_id', $school->id)->where('id', $row['id'])->firstOrFail();

                if (! empty($row['_delete'])) {
                    if ($period?->timetableSlots()->exists()) {
                        throw ValidationException::withMessages([
                            'periods' => __('Period :label is on the timetable and cannot be deleted.', ['label' => $period->label]),
                        ]);
                    }
                    $period?->delete();

                    continue;
                }

                $isBreak = (bool) ($row['is_break'] ?? false);
                $fields = [
                    'label' => $row['label'],
                    'is_break' => $isBreak,
                    'custom_minutes' => isset($row['custom_minutes']) ? (int) $row['custom_minutes'] : null,
                ];

                $kept[] = $period
                    ? tap($period)->fill($fields)
                    : new Period([...$fields, 'school_id' => $school->id, 'ordinal' => ++$nextOrdinal]);
            }

            $this->retime($school, $kept);
        });

        AuditEvent::record($this->schoolContext->school(), $request->user(), 'period', $school->id, 'schoolday_saved', [
            'school_days' => $data['school_days'] ?? null,
            'day_starts_at' => $data['day_starts_at'] ?? null,
            'period_minutes' => $data['period_minutes'] ?? null,
        ]);

        $this->notify('School day saved.');

        return back();
    }

    /**
     * Give each period its times, one after another from the start of
     * the day, and save them. Without a list the school's periods are
     * taken in the order they run now.
     *
     * @param  list<Period>|null  $periods
     */
    protected function retime(School $school, ?array $periods = null): void
    {
        $periods ??= Period::where('school_id', $school->id)->orderBy('starts_at')->orderBy('ordinal')->get()->all();
        $cursor = Carbon::createFromFormat('H:i', substr((string) $school->day_starts_at, 0, 5));
        $endOfDay = $cursor->copy()->setTime(23, 59);

        foreach ($periods as $period) {
            $starts = $cursor->copy();
            $cursor->addMinutes($period->minutesWith($school->period_minutes));

            if ($cursor->gt($endOfDay)) {
                throw ValidationException::withMessages([
                    'periods' => __('The day would run past midnight. Start earlier, or make periods shorter.'),
                ]);
            }

            $period->fill(['starts_at' => $starts->format('H:i'), 'ends_at' => $cursor->format('H:i')])->save();
        }
    }
}
