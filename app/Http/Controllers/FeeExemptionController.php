<?php

namespace App\Http\Controllers;

use App\Actions\Fees\GrantInvoiceExemption;
use App\Actions\Fees\RemoveInvoiceExemption;
use App\Http\Requests\Fees\ExemptInvoiceRequest;
use App\Models\Invoice;
use App\Models\School;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FeeExemptionController extends Controller
{
    public function exempt(ExemptInvoiceRequest $request, string $invoice, GrantInvoiceExemption $action): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->findInvoice($school, $invoice);
        $action->handle($school, $target, $request->user(), $request->validated());
        $this->notify('Exemption saved.');

        return back();
    }

    public function removeExemption(Request $request, string $invoice, RemoveInvoiceExemption $action): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->findInvoice($school, $invoice);
        $action->handle($school, $target, $request->user());
        $this->notify('Exemption removed.');

        return back();
    }

    protected function findInvoice(School $school, string $id): Invoice
    {
        return Invoice::whereKey($id)
            ->whereHas('student', fn (Builder $query) => $query->where('school_id', $school->id))
            ->with(['installments', 'lines', 'payments', 'exemption'])
            ->firstOrFail();
    }
}
