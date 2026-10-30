<?php

namespace App\Providers;

use App\Livewire\Pulse\SchoolExceptions;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\User;
use BlessDarah\PhpCampay\Campay;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\DevCommands;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Pulse\Facades\Pulse;
use Livewire\Livewire;

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
        $this->configurePulse();

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
     * Pulse is for Campus super-admins only, on the admin site, where
     * the platform guard holds who is signed in. Users are shown with
     * their school, and no email leaves for Gravatar.
     */
    protected function configurePulse(): void
    {
        Gate::define('viewPulse', function (): bool {
            $admin = Auth::guard('platform')->user();

            return $admin instanceof User && $admin->is_platform_admin && $admin->school_id === null;
        });

        Pulse::user(fn (User $user): array => [
            'name' => $user->full_name,
            'extra' => $user->is_platform_admin
                ? 'Campus super-admin'
                : trim(($user->school->name ?? '').' · '.$user->role->label(), ' ·'),
            'avatar' => static::initialsAvatar($user->initials ?: mb_substr($user->full_name, 0, 2)),
        ]);

        Livewire::component('pulse.school-exceptions', SchoolExceptions::class);

        DevCommands::artisan('pulse:check', 'pulse');
    }

    /**
     * A small inline SVG with the person's initials, used as their avatar.
     */
    protected static function initialsAvatar(string $initials): string
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#E3EEE8"/>'
            .'<text x="32" y="40" text-anchor="middle" font-family="Inter, sans-serif" font-size="24" font-weight="600" fill="#0E4D3A">'
            .e(mb_strtoupper($initials)).'</text></svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
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
