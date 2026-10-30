<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInvitationRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetCodeRequest;
use App\Mail\PasswordResetMail;
use App\Models\School;
use App\Models\User;
use App\Notifications\PasswordResetCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Undjike\CamooNotificationChannel\CamooChannel;

/**
 * A staff member who forgot their password gets a new one for this
 * school only: by email, a link; by phone, a code by SMS that leads to
 * the same link. Nothing on the way says whether an account exists.
 */
class PasswordResetController extends Controller
{
    protected const int LINK_MINUTES = 60;

    protected const int CODE_MINUTES = 15;

    protected const int CODE_ATTEMPTS = 5;

    /**
     * Requests one account can make in an hour, by link or by code.
     */
    protected const int PER_HOUR = 3;

    public function show(Request $request): Response|RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);

        if (! $school) {
            return redirect()->route('login');
        }

        return Inertia::render('auth/forgot-password', [
            'school' => $this->identity($school),
            'sent' => $request->session()->get('password_reset_sent'),
        ]);
    }

    public function send(ForgotPasswordRequest $request): RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);

        if (! $school) {
            return redirect()->route('login');
        }

        $identifier = trim((string) $request->validated('identifier'));
        $byEmail = filter_var($identifier, FILTER_VALIDATE_EMAIL) !== false;
        $user = $this->account($school, $identifier, $byEmail);
        $limit = $user ? 'password-reset:'.$user->id : null;
        $allowed = $limit !== null && ! RateLimiter::tooManyAttempts($limit, static::PER_HOUR);

        if ($user && $allowed) {
            RateLimiter::hit((string) $limit, 3600);
            $byEmail ? $this->mailLink($school, $user) : $this->textCode($school, $user);
        }

        if ($byEmail) {
            return back()->with('password_reset_sent', mb_strtolower($identifier));
        }

        $request->session()->put('password_reset', ['user_id' => $user?->id, 'phone' => $identifier]);

        return redirect()->route('password.code');
    }

    /**
     * The page to type the SMS code on.
     */
    public function code(Request $request): Response|RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);
        $pending = $request->session()->get('password_reset');

        if (! $school || ! is_array($pending)) {
            return redirect()->route('password.request');
        }

        $digits = preg_replace('/\D/', '', (string) ($pending['phone'] ?? ''));

        return Inertia::render('auth/reset-code', [
            'school' => $this->identity($school),
            'phone' => strlen((string) $digits) >= 4 ? '•• •• '.substr((string) $digits, -4) : (string) ($pending['phone'] ?? ''),
        ]);
    }

    public function checkCode(ResetCodeRequest $request): RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);
        $pending = $request->session()->get('password_reset');

        if (! $school || ! is_array($pending)) {
            return redirect()->route('password.request');
        }

        $user = is_string($pending['user_id'] ?? null)
            ? User::where('school_id', $school->id)->whereKey($pending['user_id'])->first()
            : null;

        if (! $user || ! $user->password_reset_code_hash || ($user->password_reset_expires_at?->isPast() ?? true)) {
            throw ValidationException::withMessages(['code' => __('This code is not right or has expired. Ask for a new one.')]);
        }

        if ($user->password_reset_attempts >= static::CODE_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => __('Too many attempts. Ask for a new code.')]);
        }

        if (! hash_equals($user->password_reset_code_hash, hash('sha256', (string) $request->validated('code')))) {
            $user->forceFill(['password_reset_attempts' => $user->password_reset_attempts + 1])->save();

            throw ValidationException::withMessages(['code' => __('This code is not right or has expired. Ask for a new one.')]);
        }

        $request->session()->forget('password_reset');

        return redirect()->route('password.reset', $this->issueToken($user, static::CODE_MINUTES));
    }

    /**
     * The page to choose the new password on.
     */
    public function edit(string $token): Response|RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);

        if (! $school) {
            return redirect()->route('login');
        }

        $user = $this->holder($school, $token);

        return Inertia::render('auth/reset-password', [
            'token' => $token,
            'school' => $this->identity($school),
            'member' => $user ? ['name' => $user->full_name] : null,
        ]);
    }

    public function update(AcceptInvitationRequest $request, string $token): RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);
        $user = $school ? $this->holder($school, $token) : null;

        if (! $school || ! $user) {
            return redirect()->route('password.reset', $token);
        }

        $user->forceFill([
            'password' => $request->validated('password'),
            'password_changed_at' => now(),
            'password_reset_token_hash' => null,
            'password_reset_code_hash' => null,
            'password_reset_attempts' => 0,
            'password_reset_expires_at' => null,
            'invitation_token_hash' => null,
            'invitation_expires_at' => null,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        RateLimiter::clear("signin:{$school->id}:".strtolower((string) $user->email));
        Auth::login($user);
        $user->forceFill(['last_signed_in_at' => now()])->save();
        $request->session()->regenerate();
        $request->session()->put('school_id', $school->id);
        $this->notify('Password changed. You are signed in.');

        return redirect()->route('dashboard');
    }

    /**
     * @return array{name: string, address: string}
     */
    protected function identity(School $school): array
    {
        return ['name' => $school->name, 'address' => $school->slug.'.'.parse_url((string) config('app.url'), PHP_URL_HOST)];
    }

    /**
     * The account of this school that signs in with the email or phone,
     * matching a phone however it was typed.
     */
    protected function account(School $school, string $identifier, bool $byEmail): ?User
    {
        if ($byEmail) {
            return User::where('school_id', $school->id)->whereRaw('LOWER(email) = ?', [mb_strtolower($identifier)])->first();
        }

        $digits = (string) preg_replace('/\D/', '', $identifier);

        if (strlen($digits) < 8) {
            return null;
        }

        return User::where('school_id', $school->id)
            ->whereNotNull('phone')
            ->get(['id', 'school_id', 'phone', 'full_name', 'given_name', 'family_name', 'email', 'locale'])
            ->first(fn (User $user) => str_ends_with((string) preg_replace('/\D/', '', (string) $user->phone), substr($digits, -9)));
    }

    /**
     * The account a still-valid reset link belongs to.
     */
    protected function holder(School $school, string $token): ?User
    {
        return User::where('school_id', $school->id)
            ->where('password_reset_token_hash', hash('sha256', $token))
            ->where('password_reset_expires_at', '>', now())
            ->first();
    }

    protected function issueToken(User $user, int $minutes): string
    {
        $token = Str::random(48);
        $user->forceFill([
            'password_reset_token_hash' => hash('sha256', $token),
            'password_reset_code_hash' => null,
            'password_reset_attempts' => 0,
            'password_reset_expires_at' => now()->addMinutes($minutes),
        ])->save();

        return $token;
    }

    protected function mailLink(School $school, User $user): void
    {
        $token = $this->issueToken($user, static::LINK_MINUTES);

        try {
            Mail::to($user->email)->locale($user->locale ?? $school->locale)->send(new PasswordResetMail(
                $school,
                $user->full_name,
                route('password.reset', $token),
                static::LINK_MINUTES,
            ));
        } catch (\Throwable $exception) {
            Log::warning('Password reset email failed.', ['user' => $user->id, 'error' => $exception->getMessage()]);
        }
    }

    protected function textCode(School $school, User $user): void
    {
        $code = (string) random_int(100000, 999999);
        $user->forceFill([
            'password_reset_token_hash' => null,
            'password_reset_code_hash' => hash('sha256', $code),
            'password_reset_attempts' => 0,
            'password_reset_expires_at' => now()->addMinutes(static::CODE_MINUTES),
        ])->save();

        $digits = (string) preg_replace('/\D/', '', (string) $user->phone);
        Notification::route(CamooChannel::class, '+237'.substr($digits, -9))
            ->notify((new PasswordResetCode($code, $school->name, $user->id))->locale($user->locale ?? $school->locale));
    }
}
