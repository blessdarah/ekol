<?php

use App\Models\MobilePayment;
use App\Models\PendingRegistration;
use BlessDarah\PhpCampay\Campay;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('registrations:prune', function () {
    $count = PendingRegistration::pruneExpired();

    $this->comment("Pruned {$count} expired registrations.");
})->purpose('Delete expired, unconsumed school registrations');

Schedule::command('registrations:prune')->daily();

Artisan::command('payments:check-mobile', function () {
    $campay = app(Campay::class);
    $pending = MobilePayment::where('status', MobilePayment::PENDING)
        ->where(fn ($query) => $query->whereNull('checked_at')->orWhere('checked_at', '<', now()->subSeconds(30)))
        ->get();

    $pending->each(fn (MobilePayment $payment) => $payment->refreshStatus($campay));

    $this->comment("Checked {$pending->count()} mobile money requests.");
})->purpose('Ask Campay about mobile money payments still waiting for an answer');

Schedule::command('payments:check-mobile')->everyMinute()->withoutOverlapping();
