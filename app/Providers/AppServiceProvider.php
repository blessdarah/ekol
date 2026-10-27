<?php

namespace App\Providers;

use App\Models\AuditEvent;
use App\Models\School;
use App\Models\User;
use BlessDarah\PhpCampay\Campay;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(Campay::class, fn (): Campay => new Campay(
            (string) config('services.campay.username'),
            (string) config('services.campay.password'),
            (string) config('services.campay.base_url'),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        User::saving(function (User $user) {
            abort_if($user->is_platform_admin && $user->school_id !== null, 403);
        });
        AuditEvent::creating(function (AuditEvent $event) {
            if (app()->bound('currentPlatformVisit')) {
                $event->diff = [...($event->diff ?? []), 'by' => 'Campus super-admin'];
            }
        });
        Event::listen(NotificationSending::class, function ($event) {
            $schoolId = $event->notifiable->school_id ?? $event->notification->schoolId ?? null;
            if ($schoolId && School::whereKey($schoolId)->where('is_demo', true)->exists()) {
                return false;
            }
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
