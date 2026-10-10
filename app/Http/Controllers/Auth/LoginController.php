<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    protected const int MAX_ATTEMPTS = 5;

    protected const int LOCKOUT_SECONDS = 900;

    protected function currentSchool(Request $request): ?School
    {
        /** @var School|null $school */
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        return $school instanceof School ? $school : null;
    }

    protected function parentDomain(): string
    {
        return (string) parse_url((string) config('app.url'), PHP_URL_HOST);
    }

    public function show(Request $request): Response
    {
        if ($school = $this->currentSchool($request)) {
            return Inertia::render('auth/login', [
                'school' => $school->only(['name', 'slug']),
                'address' => "{$school->slug}.".$this->parentDomain(),
                'switchUrl' => '//'.$this->parentDomain().'/login',
            ]);
        }

        return Inertia::render('auth/find-school');
    }

    public function store(Request $request): RedirectResponse
    {
        $school = $this->currentSchool($request);

        if (! $school) {
            return redirect()->route('login');
        }

        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $key = "signin:{$school->id}:".strtolower($data['identifier']);

        if (RateLimiter::tooManyAttempts($key, static::MAX_ATTEMPTS)) {
            $minutes = (int) ceil(RateLimiter::availableIn($key) / 60);

            return back()->withErrors([
                'identifier' => "Too many attempts. Sign in pauses for {$minutes} minutes. You can reset your password at any time.",
            ]);
        }

        $user = $this->resolveUser($school, $data['identifier']);

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, static::LOCKOUT_SECONDS);

            $left = static::MAX_ATTEMPTS - RateLimiter::attempts($key);

            return back()->withErrors([
                'identifier' => "Email or password is incorrect. You have {$left} attempts left.",
            ]);
        }

        RateLimiter::clear($key);

        Auth::login($user, (bool) ($data['remember'] ?? false));
        $request->session()->regenerate();
        $request->session()->put('school_id', $school->id);

        if ($user->setup_completed_at) {
            return redirect()->intended(route('dashboard'));
        }

        return in_array($user->role, [UserRole::Admin, UserRole::Principal], true)
            ? redirect()->route('setup')
            : redirect()->intended(route('dashboard'));
    }

    public function findSchool(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'exists:schools,slug'],
        ]);

        $host = $request->getHost();

        return redirect()->away("//{$data['slug']}.{$host}/login");
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    protected function resolveUser(School $school, string $identifier): ?User
    {
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            return User::where('email', $identifier)
                ->where('school_id', $school->id)
                ->first();
        }

        return User::where('school_id', $school->id)
            ->where('phone', $identifier)
            ->first();
    }
}
