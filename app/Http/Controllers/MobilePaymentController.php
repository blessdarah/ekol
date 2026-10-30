<?php

namespace App\Http\Controllers;

use App\Models\MobilePayment;
use App\Models\Money;
use BlessDarah\PhpCampay\Campay;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The bursar's log of what parents paid by mobile money: what went
 * through, what is still waiting on the parent's phone, what failed.
 */
class MobilePaymentController extends Controller
{
    protected const int PER_PAGE = 20;

    protected const array FILTERS = ['all', 'today', 'paid', 'waiting', 'failed'];

    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $filter = in_array($request->query('show'), static::FILTERS, true) ? (string) $request->query('show') : 'all';
        $base = MobilePayment::where('school_id', $school->id);
        $page = max(1, (int) $request->query('page', 1));
        $listed = (clone $base)
            ->when($filter === 'today', fn (Builder $query) => $query->where('created_at', '>=', today()))
            ->when($filter === 'paid', fn (Builder $query) => $query->where('status', MobilePayment::SUCCESSFUL))
            ->when($filter === 'waiting', fn (Builder $query) => $query->where('status', MobilePayment::PENDING))
            ->when($filter === 'failed', fn (Builder $query) => $query->where('status', MobilePayment::FAILED))
            ->with(['student:id,full_name,admission_no', 'payment:id,receipt_no'])
            ->latest()
            ->paginate(static::PER_PAGE, page: $page);
        $today = (clone $base)->where('created_at', '>=', today());

        return Inertia::render('fees/mobile-money', [
            'currency' => $school->currency,
            'totals' => [
                'collected_today' => Money::number(Money::sum((clone $today)->where('status', MobilePayment::SUCCESSFUL)->pluck('amount'))),
                'paid_today' => (clone $today)->where('status', MobilePayment::SUCCESSFUL)->count(),
                'waiting' => (clone $base)->where('status', MobilePayment::PENDING)->count(),
                'failed_today' => (clone $today)->where('status', MobilePayment::FAILED)->count(),
            ],
            'filters' => ['show' => $filter],
            'requests' => [
                'rows' => collect($listed->items())->map(fn (MobilePayment $payment) => [
                    'id' => $payment->id,
                    'student' => $payment->student ? ['id' => $payment->student_id, 'name' => $payment->student->full_name, 'matricule' => $payment->student->admission_no] : null,
                    'amount' => Money::number(Money::units($payment->amount)),
                    'phone' => $payment->phone,
                    'operator' => $payment->operator,
                    'status' => $payment->status,
                    'reason' => $payment->failure_reason,
                    'reference' => $payment->reference,
                    'receipt' => $payment->payment ? ['id' => $payment->payment->id, 'no' => $payment->payment->receipt_no] : null,
                    'requested_at' => $payment->created_at->toIso8601String(),
                ])->values(),
                'page' => $listed->currentPage(),
                'lastPage' => $listed->lastPage(),
                'total' => $listed->total(),
            ],
        ]);
    }

    /**
     * Ask Campay again about a request still waiting.
     */
    public function check(Request $request, string $payment, Campay $campay): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = MobilePayment::where('school_id', $school->id)->whereKey($payment)->firstOrFail();

        if ($target->status !== MobilePayment::PENDING) {
            return back();
        }

        $target->refreshStatus($campay);

        $this->notify(match ($target->status) {
            MobilePayment::SUCCESSFUL => 'The payment went through and is on the student’s account.',
            MobilePayment::FAILED => 'The payment did not go through.',
            default => 'Still waiting for the parent to approve.',
        }, match ($target->status) {
            MobilePayment::SUCCESSFUL => 'success',
            MobilePayment::FAILED => 'error',
            default => 'info',
        });

        return back();
    }
}
