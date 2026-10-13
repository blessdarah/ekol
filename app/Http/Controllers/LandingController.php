<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDemoRequest;
use App\Models\DemoRequest;
use App\Models\School;
use Illuminate\Http\RedirectResponse;
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
        ]);
    }

    /**
     * Keep a school's request to be called for a demo.
     */
    public function storeDemo(StoreDemoRequest $request): RedirectResponse
    {
        $data = $request->validated();

        DemoRequest::create([
            'school_name' => trim($data['school_name']),
            'role' => $data['role'],
            'students' => $data['students'],
            'whatsapp' => DemoRequest::DIAL_CODE.preg_replace('/\s+/', '', $data['whatsapp']),
            'locale' => app()->getLocale(),
        ]);

        $this->notify('Thank you. We will call you on WhatsApp to arrange your demo.');

        return back();
    }
}
