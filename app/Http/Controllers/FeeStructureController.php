<?php

namespace App\Http\Controllers;

use App\Actions\Fees\BillYearlyFees;
use App\Actions\Fees\SaveFeeStructure;
use App\Enums\AcademicYearStatus;
use App\Http\FeeEnrolments;
use App\Http\Requests\Fees\BillFeesRequest;
use App\Http\Requests\Fees\UpdateFeeStructureRequest;
use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeeItem;
use App\Models\FeeItemAmount;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Money;
use App\Models\School;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class FeeStructureController extends Controller
{
    /**
     * What each level costs for a year, and who still has to be billed.
     */
    public function structure(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $years = AcademicYear::where('school_id', $school->id)
            ->where('status', '!=', AcademicYearStatus::Closed)
            ->orderBy('starts_on')
            ->get();
        $year = $years->firstWhere('id', (string) $request->query('year', ''))
            ?? $years->firstWhere('status', AcademicYearStatus::Current)
            ?? $years->first();

        if (! $year) {
            return Inertia::render('fees/structure', ['year' => null, 'currency' => $school->currency]);
        }

        $plans = FeePlan::where('school_id', $school->id)->where('academic_year_id', $year->id)->get()->keyBy('level_id');
        $previous = AcademicYear::where('school_id', $school->id)->whereDate('starts_on', '<', $year->starts_on)->orderByDesc('starts_on')->first();
        $students = (new FeeEnrolments)->handle($school, $year);
        $collected = $this->collected($students);
        $enrolled = collect($students)->groupBy(fn (Enrolment $enrolment) => (string) ($enrolment->level_id ?? $enrolment->schoolClass?->level_id));

        return Inertia::render('fees/structure', [
            'currency' => $school->currency,
            'years' => $years->map(fn (AcademicYear $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'current' => $option->status === AcademicYearStatus::Current,
            ]),
            'year' => ['id' => $year->id, 'label' => $year->label, 'current' => $year->status === AcademicYearStatus::Current],
            'previousLabel' => $previous?->label,
            'items' => $this->items($school, $year, $collected),
            'previousItems' => $previous ? $this->items($school, $previous) : [],
            'billingTerm' => $this->billingTerm($school, $year)?->label,
            'installments' => FeeInstallmentTemplate::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->orderBy('seq')
                ->get()
                ->map(fn (FeeInstallmentTemplate $template) => [
                    'seq' => $template->seq,
                    'label' => Invoice::ordinal($template->seq, true),
                    'percent' => (float) $template->percent,
                    'due_on' => $template->due_on?->toDateString(),
                ]),
            'levels' => Level::where('school_id', $school->id)->orderBy('ordinal')->get()->map(function (Level $level) use ($plans, $enrolled) {
                $students = $enrolled->get($level->id);
                $billed = $students
                    ? $students->filter(fn (Enrolment $enrolment) => (bool) $enrolment->student?->invoices->isNotEmpty())->count()
                    : 0;

                return [
                    'id' => $level->id,
                    'name' => $level->name,
                    'has_fee' => $plans->has($level->id),
                    'students' => $students ? $students->count() : 0,
                    'billed' => $billed,
                ];
            }),
        ]);
    }

    public function updateStructure(UpdateFeeStructureRequest $request, SaveFeeStructure $save): RedirectResponse
    {
        $save->handle($this->schoolContext->school(), $request->user(), $request->validated());
        $this->notify('Fees saved.');

        return back();
    }

    /**
     * Issue the year's invoice to every enrolled student who has none,
     * in the levels that have a fee.
     */
    public function bill(BillFeesRequest $request, BillYearlyFees $bill): RedirectResponse
    {
        $school = $this->schoolContext->school();

        $data = $request->validated();

        $year = AcademicYear::whereKey($data['year_id'])->firstOrFail();
        $term = $this->billingTerm($school, $year);

        if (! $term) {
            throw ValidationException::withMessages([
                'bill' => __(':label has no term to bill against. Add its terms in School Setup first.', ['label' => $year->label]),
            ]);
        }

        $bill->billEnrolled($school, $year, $term, $request->user(), $data['level_id'] ?? null);
        $this->notify('Billing done.');

        return back();
    }

    /**
     * The term a year's invoices are issued against: the active term
     * when it belongs to the year, else the year's first term.
     */
    protected function billingTerm(School $school, AcademicYear $year): ?Term
    {
        $current = $this->schoolContext->term();

        return $current && $current->academic_year_id === $year->id
            ? $current
            : Term::where('academic_year_id', $year->id)->orderBy('sequence')->first();
    }

    /**
     * A year's fee items in the order money is shared out, each with
     * its amount per level and, when asked, what it has brought in.
     *
     * @param  array<string, array{billed: int, collected: int}>|null  $collected
     * @return list<array<string, mixed>>
     */
    protected function items(School $school, AcademicYear $year, ?array $collected = null): array
    {
        return array_values(FeeItem::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->orderBy('position')
            ->with('amounts')
            ->get()
            ->map(fn (FeeItem $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'spread' => $item->is_spread,
                'new_only' => $item->new_students_only,
                'amounts' => $item->amounts->mapWithKeys(fn (FeeItemAmount $amount) => [$amount->level_id => Money::number(Money::units($amount->amount))])->all(),
                'billed' => Money::number($collected[$item->name]['billed'] ?? 0),
                'collected' => Money::number($collected[$item->name]['collected'] ?? 0),
            ])
            ->all());
    }

    /**
     * What each item on the year's invoices was billed and has
     * received, by item name.
     *
     * @param  list<Enrolment>  $enrolments
     * @return array<string, array{billed: int, collected: int}>
     */
    protected function collected(array $enrolments): array
    {
        $totals = [];

        foreach ($enrolments as $enrolment) {
            foreach ($enrolment->student->invoices ?? [] as $invoice) {
                foreach ($invoice->ledgerMinor()['items'] as $item) {
                    $totals[$item['name']] ??= ['billed' => 0, 'collected' => 0];
                    $totals[$item['name']]['billed'] += $item['amount'];
                    $totals[$item['name']]['collected'] += $item['paid'];
                }
            }
        }

        return $totals;
    }
}
