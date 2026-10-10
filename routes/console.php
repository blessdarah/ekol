<?php

use App\Models\PendingRegistration;
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
