<?php

namespace App\Http\Controllers;

use App\Models\DemoRequest;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class DemoSchoolController extends Controller
{
    protected function school(DemoRequest $demo): School
    {
        $school = School::whereKey($demo->demo_school_id)->where('is_demo', true)->firstOrFail();
        abort_unless($this->schoolContext->hasSchool() && $this->schoolContext->school()->id === $school->id, 404);
        abort_unless($demo->status === 'trying' && $school->demo_expires_at?->isFuture(), 410);

        return $school;
    }

    public function show(Request $request, DemoRequest $demo): Response
    {
        $school = $this->school($demo);

        return Inertia::render('platform/demo-welcome', [
            'name' => $demo->school_name, 'expires' => $school->demo_expires_at->toDateString(),
            'openUrl' => URL::temporarySignedRoute('demo-school.open', $school->demo_expires_at, ['demo' => $demo->id], absolute: false),
        ]);
    }

    public function open(Request $request, DemoRequest $demo): RedirectResponse
    {
        $school = $this->school($demo);
        $user = User::whereKey($demo->demo_user_id)->where('school_id', $school->id)->firstOrFail();
        Auth::guard('web')->login($user);
        $user->forceFill(['last_signed_in_at' => now()])->save();
        $request->session()->regenerate();
        $request->session()->put('school_id', $school->id);

        return redirect()->route('dashboard');
    }

    public function start(Request $request): HttpResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);
        abort_unless($school instanceof School && $school->is_demo && $request->user()?->school_id === $school->id, 403);
        $demo = DemoRequest::where('demo_school_id', $school->id)->firstOrFail();
        $path = URL::temporarySignedRoute('demo-school.register', now()->addHour(), ['demo' => $demo->id], absolute: false);

        return Inertia::location(rtrim((string) config('app.url'), '/').$path);
    }

    public function register(Request $request, DemoRequest $demo): RedirectResponse
    {
        abort_unless($request->getHost() === parse_url((string) config('app.url'), PHP_URL_HOST), 404);
        $request->session()->put('demo_registration', $demo->id);
        $request->session()->put('registration.prefill', ['name' => $demo->school_name, 'full_name' => $demo->contact_name, 'phone' => $demo->whatsapp, 'email' => $demo->email]);
        app()->setLocale($demo->locale);
        $request->session()->put('locale', $demo->locale);

        return redirect()->route('register.school');
    }
}
