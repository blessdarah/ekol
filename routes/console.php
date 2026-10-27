<?php

use App\Models\MobilePayment;
use App\Models\PendingRegistration;
use App\Models\User;
use BlessDarah\PhpCampay\Campay;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('user:edit {--email= : The email the user signs in with} {--password= : The new password} {--school= : The school\'s workspace address, when the email is used in more than one school}', function () {
    $option = fn (string $name): string => is_string($value = $this->option($name)) ? $value : '';
    $email = trim($option('email'));
    $password = $option('password');
    $school = trim($option('school'));

    $validator = Validator::make(
        ['email' => $email, 'password' => $password],
        ['email' => ['required', 'email'], 'password' => ['required', 'string', Password::defaults()]],
    );

    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $message) {
            $this->error($message);
        }

        return 1;
    }

    $users = User::where('email', $email)
        ->when($school !== '', fn ($query) => $query->whereHas('school', fn ($inner) => $inner->where('slug', $school)))
        ->with('school:id,slug')
        ->get();

    if ($users->isEmpty()) {
        $this->error($school === '' ? "No user has the email {$email}." : "No user in {$school} has the email {$email}.");

        return 1;
    }

    if ($users->count() > 1) {
        $this->error("{$email} is used in more than one school. Choose one with --school:");

        foreach ($users as $user) {
            $this->line('  --school='.($user->school->slug ?? '(none)'));
        }

        return 1;
    }

    $user = $users->first();
    $user->update(['password' => $password]);

    $this->info("Password changed for {$user->full_name} ({$email}".($user->school ? ", {$user->school->slug}" : '').').');

    return 0;
})->purpose('Change a user\'s password');

Artisan::command('registrations:prune', function () {
    $count = PendingRegistration::pruneExpired();

    $this->comment("Pruned {$count} expired registrations.");
})->purpose('Delete expired, unconsumed school registrations');

Schedule::command('registrations:prune')->daily();
Schedule::command('platform:expire')->everyMinute()->withoutOverlapping();

Artisan::command('payments:check-mobile', function () {
    $campay = app(Campay::class);
    $pending = MobilePayment::where('status', MobilePayment::PENDING)
        ->where(fn ($query) => $query->whereNull('checked_at')->orWhere('checked_at', '<', now()->subSeconds(30)))
        ->get();

    $pending->each(fn (MobilePayment $payment) => $payment->refreshStatus($campay));

    $this->comment("Checked {$pending->count()} mobile money requests.");
})->purpose('Ask Campay about mobile money payments still waiting for an answer');

Schedule::command('payments:check-mobile')->everyMinute()->withoutOverlapping();
