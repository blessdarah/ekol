<?php

namespace App\Http\Middleware;

use App\Models\AuditEvent;
use App\Models\School;
use App\Models\SchoolVisit;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PlatformContext
{
    public static function host(): string
    {
        return 'admin.'.parse_url((string) config('app.url'), PHP_URL_HOST);
    }

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('platform', 'platform/*')) {
            abort_unless($request->getHost() === static::host(), 404);
            $request->session()->forget('school_id');
            if (! $request->is('platform/login', 'platform/verify')) {
                $admin = Auth::guard('platform')->user();
                if (! $admin || ! $admin->is_platform_admin || $admin->school_id !== null) {
                    return redirect()->route('platform.login');
                }
            }

            return $next($request);
        }
        if ($request->getHost() !== static::host()) {
            return $next($request);
        }
        $admin = Auth::guard('platform')->user();
        if (! $admin || ! $admin->is_platform_admin || $admin->school_id !== null) {
            return redirect()->route('platform.login');
        }
        // The Pulse dashboard refreshes its cards through Livewire, outside
        // /platform; those requests belong to the admin site, not a visit.
        if ($request->is('livewire-*/*', 'livewire/*')) {
            return $next($request);
        }
        $visit = SchoolVisit::whereKey($request->session()->get('platform_visit'))
            ->where('user_id', $admin->id)->whereNull('ended_at')->first();
        if (! $visit || $visit->expires_at->isPast()) {
            $visit?->finish();
            $request->session()->forget(['platform_visit', 'school_id']);

            return redirect()->route('platform.schools');
        }
        $school = School::findOrFail($visit->school_id);
        abort_if($request->is('login*', 'logout', 'register*', 'invitation/*', 'forgot-password', 'parents*', 'pay*', 'demo*'), 403);
        abort_if($request->is('staff/*/access', 'staff/*/reminder'), 403, 'Platform visits cannot manage sign-in credentials.');
        app()->instance('currentSchool', $school);
        app()->instance('currentPlatformVisit', $visit);
        $request->session()->put('school_id', $school->id);
        Auth::guard('web')->setUser($admin);

        try {
            $response = $next($request);
        } finally {
            app()->forgetInstance('currentSchool');
            app()->forgetInstance('currentPlatformVisit');
        }

        if (! $request->isMethodSafe() && $response->getStatusCode() < 400) {
            AuditEvent::create([
                'school_id' => $school->id, 'actor_id' => $admin->id,
                'entity' => 'school_visit', 'entity_id' => $visit->id, 'action' => 'visit.changed',
                'diff' => ['by' => 'Campus super-admin', 'method' => $request->method(), 'path' => $request->path()], 'occurred_at' => now(),
            ]);
        }

        return $response;
    }
}
