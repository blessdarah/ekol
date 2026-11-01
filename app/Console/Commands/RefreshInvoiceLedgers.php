<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class RefreshInvoiceLedgers extends Command
{
    protected $signature = 'fees:refresh-ledgers {--all : Rebuild every invoice, including settled and already refreshed records}';

    protected $description = 'Refresh stored fee totals and overdue status in bounded batches';

    public function handle(): int
    {
        $count = 0;
        Invoice::withoutGlobalScope('school')
            ->when(! $this->option('all'), fn (Builder $query) => $query->where(fn (Builder $pending) => $pending
                ->whereNull('ledger_updated_on')->orWhere(fn (Builder $open) => $open->where('balance_minor', '>', 0)->where('ledger_updated_on', '<', today()->toDateString()))))
            ->select('id')
            ->chunkById(100, function (Collection $invoices) use (&$count): void {
                Invoice::syncStatuses($invoices->modelKeys());
                $count += $invoices->count();
            });
        $this->info("Refreshed {$count} invoice ledgers.");

        return self::SUCCESS;
    }
}
