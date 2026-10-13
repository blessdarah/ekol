<?php

use App\Enums\SchoolCycle;
use App\Models\DemoRequest;
use App\Models\School;
use Inertia\Testing\AssertableInertia as Assert;

test('the home page is the landing page with its demo form', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('landing')
            ->where('dialCode', '+237')
            ->has('roles', count(DemoRequest::ROLES))
            ->has('sizes', count(DemoRequest::SIZES))
            ->where('locale', 'en'));
});

test('a school address skips the landing page for its own portal', function () {
    School::create([
        'name' => 'Landing Academy', 'code' => 'LA', 'slug' => 'landa',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);

    $this->get('http://landa.ekol.test/')->assertRedirect(route('dashboard'));
});

test('a school asks for a demo and the request is kept', function () {
    $this->from('/')
        ->post('/demo', [
            'school_name' => ' GBHS Bamenda ', 'role' => 'Principal', 'students' => '300–800', 'whatsapp' => '6 77 12 34 56',
        ])
        ->assertRedirect('/')
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast.type', 'success');

    $request = DemoRequest::firstOrFail();

    expect($request->school_name)->toBe('GBHS Bamenda')
        ->and($request->whatsapp)->toBe('+237677123456')
        ->and($request->locale)->toBe('en')
        ->and($request->handled_at)->toBeNull();
});

test('a demo request needs a school, a known role and size, and a number', function () {
    $this->post('/demo', ['school_name' => '', 'role' => 'King', 'students' => 'Lots', 'whatsapp' => 'call me'])
        ->assertSessionHasErrors(['school_name', 'role', 'students', 'whatsapp']);

    expect(DemoRequest::count())->toBe(0);
});
