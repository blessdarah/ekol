<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Mail\WorkspaceReadyMail;
use App\Models\PendingRegistration;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RegistrationController extends Controller
{
    protected function parentDomain(): string
    {
        return (string) parse_url((string) config('app.url'), PHP_URL_HOST);
    }

    public function showSchoolStep(): Response
    {
        return Inertia::render('auth/register-school', [
            'parentDomain' => $this->parentDomain(),
            'ownershipOptions' => School::OWNERSHIP_OPTIONS,
            'subsystemOptions' => School::SUBSYSTEM_OPTIONS,
            'regions' => School::REGIONS,
        ]);
    }

    public function slugCheck(Request $request): JsonResponse
    {
        $slug = strtolower((string) $request->query('slug'));

        $available = $slug !== ''
            && ! in_array($slug, School::RESERVED_SLUGS, true)
            && ! School::where('slug', $slug)->exists();

        return response()->json(['available' => $available]);
    }

    public function storeSchoolStep(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:schools,name'],
            'code' => ['required', 'string', 'max:255'],
            'slug' => [
                'required', 'string', 'max:255', 'lowercase', 'alpha_dash',
                Rule::notIn(School::RESERVED_SLUGS),
                'unique:schools,slug',
            ],
            'ownership' => ['required', Rule::in(School::OWNERSHIP_OPTIONS)],
            'region' => ['nullable', Rule::in(School::REGIONS)],
            'town' => ['nullable', 'string', 'max:255'],
            'subsystem' => ['nullable', Rule::in(School::SUBSYSTEM_OPTIONS)],
        ]);

        session(['registration.school' => $data]);

        return redirect()->route('register.admin');
    }

    public function showAdminStep(Request $request): Response|RedirectResponse
    {
        $school = $request->session()->get('registration.school');

        if (! $school) {
            return redirect()->route('register.school');
        }

        return Inertia::render('auth/register-admin', [
            'schoolName' => $school['name'],
        ]);
    }

    public function storeAdminStep(Request $request): RedirectResponse
    {
        $school = $request->session()->get('registration.school');

        if (! $school) {
            return redirect()->route('register.school');
        }

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::enum(UserRole::class)],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'authorisation' => ['accepted'],
        ]);

        unset($validated['authorisation']);

        [$pending] = PendingRegistration::stage($school, $validated);

        $request->session()->put('registration.pending_id', $pending->id);
        $request->session()->forget('registration.school');

        return redirect()->route('register.verify');
    }

    protected function pending(Request $request): PendingRegistration
    {
        return PendingRegistration::whereKey($request->session()->get('registration.pending_id'))->firstOrFail();
    }

    public function showVerifyStep(Request $request): Response
    {
        $pending = $this->pending($request);
        $pending->assertNotConsumed();

        return Inertia::render('auth/verify-code', [
            'email' => $pending->admin_payload['email'] ?? null,
            'expired' => now()->greaterThan($pending->expires_at),
            'expiresAt' => $pending->expires_at->toIso8601String(),
            'channel' => $pending->channel,
        ]);
    }

    public function verify(Request $request): RedirectResponse
    {
        $pending = $this->pending($request);

        $data = $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        if (! $pending->attempt($data['code'])) {
            return back()->withErrors(['code' => 'This code is incorrect.']);
        }

        $user = $pending->bootstrap();

        $this->sendReadyEmail($user->school, $user);

        auth()->login($user);
        $request->session()->regenerate();
        $request->session()->forget('registration');

        return redirect()->route('register.ready');
    }

    public function resend(Request $request): RedirectResponse
    {
        $pending = $this->pending($request);
        $pending->assertNotConsumed();
        $pending->reissue();

        return back()->with('status', 'A new code was sent.');
    }

    public function channel(Request $request): RedirectResponse
    {
        $pending = $this->pending($request);
        $pending->assertNotConsumed();

        $data = $request->validate([
            'channel' => ['required', Rule::in(['email', 'sms'])],
        ]);

        $pending->update(['channel' => $data['channel']]);
        $pending->reissue();

        return back()->with('status', "Code will arrive by {$data['channel']}.");
    }

    public function updateEmail(Request $request): RedirectResponse
    {
        $pending = $this->pending($request);
        $pending->assertNotConsumed();

        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
        ]);

        $payload = $pending->admin_payload;
        $payload['email'] = $data['email'];
        $pending->update(['admin_payload' => $payload]);
        $pending->reissue();

        return back()->with('status', 'Email updated. A new code was sent.');
    }

    public function showReady(): Response|RedirectResponse
    {
        $user = auth()->user();

        if (! $user) {
            return redirect()->route('login');
        }

        $school = $user->school;
        $address = "https://{$school->slug}.".$this->parentDomain();
        $year = $school->academicYears()->orderByDesc('starts_on')->first();

        return Inertia::render('auth/workspace-ready', [
            'school' => $school->only(['name', 'slug', 'code']),
            'administrator' => $user->only(['full_name', 'email']),
            'address' => $address,
            'loginUrl' => $address.'/login',
            'studentIdExample' => $school->code.'-'.substr((string) ($year?->starts_on->year ?? now()->year), -2).'-0001',
        ]);
    }

    protected function sendReadyEmail(School $school, User $user): void
    {
        $address = "https://{$school->slug}.".$this->parentDomain();

        try {
            Mail::to($user->email)->send(new WorkspaceReadyMail($school, $user, $address));
        } catch (\Throwable $exception) {
            Log::warning('Workspace-ready email failed.', [
                'school_id' => $school->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
