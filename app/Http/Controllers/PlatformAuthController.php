<?php

namespace App\Http\Controllers;

use App\Models\SchoolVisit;
use App\Models\User;
use App\Notifications\PlatformSignInCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Inertia\Response;

class PlatformAuthController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        if ($request->boolean('restart')) {
            $request->session()->forget('platform_challenge');
        }
        $admin = Auth::guard('platform')->user();
        if ($admin?->is_platform_admin && $admin->school_id === null) {
            return redirect()->route('platform.schools');
        }
        Auth::guard('platform')->logout();

        return Inertia::render('platform/login', ['awaitingCode' => $request->session()->has('platform_challenge')]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        Auth::guard('platform')->logout();
        $request->session()->forget('platform_challenge');
        $user = User::where('email', strtolower($data['email']))->whereNull('school_id')->where('is_platform_admin', true)->first();
        if (! $user || ! Hash::check($data['password'], $user->password ?? '')) {
            return back()->withErrors(['email' => __('Email or password is incorrect.')]);
        }
        $code = (string) random_int(100000, 999999);
        $request->session()->put('platform_challenge', [
            'id' => $user->id, 'hash' => Hash::make($code), 'expires' => now()->addMinutes(10)->timestamp,
        ]);
        try {
            $user->notify(new PlatformSignInCode($code));
        } catch (\Throwable $exception) {
            $request->session()->forget('platform_challenge');
            Log::warning('Platform sign-in email failed.', ['user_id' => $user->id, 'error' => $exception->getMessage()]);

            return back()->withErrors(['email' => __('The sign-in code could not be sent. Try again.')]);
        }

        return redirect()->route('platform.login');
    }

    public function verify(Request $request): RedirectResponse
    {
        $data = $request->validate(['code' => ['required', 'digits:6']]);
        $challenge = $request->session()->get('platform_challenge');
        $key = 'platform-code:'.$request->session()->getId();
        if (! $challenge || RateLimiter::tooManyAttempts($key, 5) || $challenge['expires'] <= now()->timestamp) {
            $request->session()->forget('platform_challenge');

            return back()->withErrors(['code' => __('Your code expired. Sign in again.')]);
        }
        RateLimiter::hit($key, 600);
        if (! Hash::check($data['code'], $challenge['hash'])) {
            return back()->withErrors(['code' => __('This code is incorrect.')]);
        }
        $user = User::whereKey($challenge['id'])->whereNull('school_id')->where('is_platform_admin', true)->firstOrFail();
        Auth::guard('platform')->login($user);
        $request->session()->forget('platform_challenge');
        $request->session()->regenerate();

        return redirect()->route('platform.schools');
    }

    public function logout(Request $request): RedirectResponse
    {
        $visit = SchoolVisit::whereKey($request->session()->get('platform_visit'))->where('user_id', Auth::guard('platform')->id())->first();
        $visit?->finish();
        Auth::guard('platform')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('platform.login');
    }
}
