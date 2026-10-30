<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\FindSchoolRequest;
use App\Http\Requests\Auth\SignInRequest;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class LoginController extends Controller
{
    protected const int MAX_ATTEMPTS = 5;

    protected const int LOCKOUT_SECONDS = 900;

    protected function parentDomain(): string
    {
        return (string) parse_url((string) config('app.url'), PHP_URL_HOST);
    }

    public function show(Request $request): Response
    {
        if ($school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null)) {
            return Inertia::render('auth/login', [
                'school' => $school->only(['name', 'slug']),
                'address' => "{$school->slug}.".$this->parentDomain(),
                'switchUrl' => '//'.$this->parentDomain().'/login',
                'parentsUrl' => '//'.$this->parentDomain().'/parents?school='.rawurlencode($school->slug),
            ]);
        }

        return Inertia::render('auth/find-school');
    }

    public function store(SignInRequest $request): RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);

        if (! $school) {
            return redirect()->route('login');
        }

        $data = $request->validated();

        $key = "signin:{$school->id}:".strtolower($data['identifier']);

        if (RateLimiter::tooManyAttempts($key, static::MAX_ATTEMPTS)) {
            $minutes = (int) ceil(RateLimiter::availableIn($key) / 60);

            return back()->withErrors([
                'identifier' => __('Too many attempts. Sign in pauses for :minutes minutes. You can reset your password at any time.', ['minutes' => $minutes]),
            ]);
        }

        $user = $this->resolveUser($school, $data['identifier']);

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, static::LOCKOUT_SECONDS);

            $left = static::MAX_ATTEMPTS - RateLimiter::attempts($key);

            return back()->withErrors([
                'identifier' => __('Email or password is incorrect. You have :left attempts left.', ['left' => $left]),
            ]);
        }

        RateLimiter::clear($key);

        Auth::login($user, (bool) ($data['remember'] ?? false));
        $user->forceFill(['last_signed_in_at' => now()])->save();
        $request->session()->regenerate();
        $request->session()->put('school_id', $school->id);

        if ($user->setup_completed_at) {
            return redirect()->intended(route('dashboard'));
        }

        return in_array($user->role, [UserRole::Admin, UserRole::Principal], true)
            ? redirect()->route('setup')
            : redirect()->intended(route('dashboard'));
    }

    /**
     * Send the visitor to their school's own sign-in page. That page
     * is on another address, so the browser has to load it in full: an
     * ordinary redirect would be followed in the background and blocked.
     */
    public function findSchool(FindSchoolRequest $request): SymfonyResponse
    {
        $data = $request->validated();

        return Inertia::location("{$request->getScheme()}://{$data['slug']}.{$request->getHttpHost()}/login");
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
