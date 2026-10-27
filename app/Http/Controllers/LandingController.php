<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDemoRequest;
use App\Models\DemoRequest;
use App\Models\School;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class LandingController extends Controller
{
    /**
     * The public page that sells the product. A school's own address
     * has nothing to sell: it goes straight to that school's portal.
     */
    public function show(): Response|RedirectResponse
    {
        if (app()->bound('currentSchool') && app('currentSchool') instanceof School) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('landing', [
            'roles' => DemoRequest::ROLES,
            'sizes' => DemoRequest::SIZES,
            'dialCode' => DemoRequest::DIAL_CODE,
            'demoBooking' => session('demo_booking'),
        ]);
    }

    /**
     * Keep a school's request to be called for a demo.
     */
    public function storeDemo(StoreDemoRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $phone = DemoRequest::DIAL_CODE.preg_replace('/\s+/', '', $data['whatsapp']);
        $attributes = [
            'contact_name' => $data['contact_name'] ?? null,
            'email' => $data['email'] ?? null,
            'school_name' => trim($data['school_name']),
            'role' => $data['role'],
            'students' => $data['students'],
            'whatsapp' => $phone,
            'locale' => app()->getLocale(),
        ];
        $demo = Cache::lock('demo-request:'.hash('sha256', $phone), 10)->block(5, function () use ($request, $phone, $attributes) {
            $existing = DemoRequest::where('whatsapp', $phone)->whereIn('status', ['new', 'contacted', 'trying'])->first();
            if ($existing) {
                return $existing;
            }
            $editable = DemoRequest::whereKey($request->session()->get('demo_booking.id'))->where('status', 'new')->first();
            if ($editable) {
                $editable->update($attributes);

                return $editable;
            }

            return DemoRequest::create($attributes);
        });

        $ownsRequest = $demo->wasRecentlyCreated || $demo->id === $request->session()->get('demo_booking.id');
        $request->session()->put('demo_booking', [
            'id' => $ownsRequest ? $demo->id : null,
            'contact_name' => $attributes['contact_name'], 'school_name' => $attributes['school_name'], 'whatsapp' => $phone,
        ]);

        $this->notify('Thank you. We will call you on WhatsApp to arrange your demo.');

        return back();
    }
}
