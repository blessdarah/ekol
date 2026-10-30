<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChooseChannelRequest;
use App\Http\Requests\Auth\StoreAdminStepRequest;
use App\Http\Requests\Auth\StoreSchoolStepRequest;
use App\Http\Requests\Auth\UpdatePendingEmailRequest;
use App\Http\Requests\Auth\VerifyCodeRequest;
use App\Mail\WorkspaceReadyMail;
use App\Models\DemoRequest;
use App\Models\PendingRegistration;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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
            'prefill' => session('registration.prefill', []),
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

    public function storeSchoolStep(StoreSchoolStepRequest $request): RedirectResponse
    {
        $data = $request->validated();

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
            'prefill' => $request->session()->get('registration.prefill', []),
        ]);
    }

    public function storeAdminStep(StoreAdminStepRequest $request): RedirectResponse
    {
        $school = $request->session()->get('registration.school');

        if (! $school) {
            return redirect()->route('register.school');
        }

        $validated = $request->validated();

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

    public function verify(VerifyCodeRequest $request): RedirectResponse
    {
        $pending = $this->pending($request);

        $data = $request->validated();

        if (! $pending->attempt($data['code'])) {
            return back()->withErrors(['code' => __('This code is incorrect.')]);
        }

        $user = $pending->bootstrap();

        if ($demoId = $request->session()->pull('demo_registration')) {
            DemoRequest::whereKey($demoId)->update(['status' => 'school', 'converted_school_id' => $user->school_id]);
        }

        $this->sendReadyEmail($user->school, $user);

        auth()->login($user);
        $user->forceFill(['last_signed_in_at' => now()])->save();
        $request->session()->regenerate();
        $request->session()->forget('registration');

        return redirect()->route('register.ready');
    }

    public function resend(Request $request): RedirectResponse
    {
        $pending = $this->pending($request);
        $pending->assertNotConsumed();
        $pending->reissue();

        $this->notify('A new code was sent.');

        return back();
    }

    public function channel(ChooseChannelRequest $request): RedirectResponse
    {
        $pending = $this->pending($request);
        $pending->assertNotConsumed();

        $data = $request->validated();

        $pending->update(['channel' => $data['channel']]);
        $pending->reissue();

        $this->notify(__('Code will arrive by :channel.', ['channel' => $data['channel'] === 'sms' ? 'SMS' : __('email')]));

        return back();
    }

    public function updateEmail(UpdatePendingEmailRequest $request): RedirectResponse
    {
        $pending = $this->pending($request);
        $pending->assertNotConsumed();

        $data = $request->validated();

        $payload = $pending->admin_payload;
        $payload['email'] = $data['email'];
        $pending->update(['admin_payload' => $payload]);
        $pending->reissue();

        $this->notify('Email updated. A new code was sent.');

        return back();
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
            Mail::to($user->email)->locale(app()->getLocale())->send(new WorkspaceReadyMail($school, $user, $address));
        } catch (\Throwable $exception) {
            Log::warning('Workspace-ready email failed.', [
                'school_id' => $school->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
