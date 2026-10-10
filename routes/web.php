<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\SetupController;
use App\Http\Middleware\ResolveSchool;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

/*
 * School tenancy resolves from the subdomain (ResolveSchool): requests on
 * {slug}.{parent-host} bind that school, bare-domain requests pass through
 * for the general sign-in and registration.
 *
 * Local development: add per-school entries to /etc/hosts, e.g.
 *   127.0.0.1  ekol.test acme.ekol.test
 * Production wildcard DNS (*.parent) needs no per-school entries.
 * Session cookies are host-only by default (SESSION_DOMAIN=null), which is
 * correct because login happens on the school host itself.
 */

Route::middleware(ResolveSchool::class)->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('login.store');
    Route::post('/login/find-school', [LoginController::class, 'findSchool'])->name('login.find');
    Route::inertia('/forgot-password', 'auth/forgot-password')->name('password.request');

    Route::middleware('auth')->group(function () {
        Route::inertia('/dashboard', 'dashboard')->name('dashboard');
        Route::get('/setup', [SetupController::class, 'show'])->name('setup');
        Route::patch('/setup/profile', [SetupController::class, 'updateProfile'])->name('setup.profile');
        Route::post('/setup/years', [SetupController::class, 'storeYear'])->name('setup.years.store');
        Route::patch('/setup/terms', [SetupController::class, 'updateTerms'])->name('setup.terms');
        Route::patch('/setup/terms/{term}/active', [SetupController::class, 'activateTerm'])->name('setup.terms.activate');
        Route::patch('/setup/installments', [SetupController::class, 'updateInstallments'])->name('setup.installments');
        Route::patch('/setup/windows', [SetupController::class, 'updateWindows'])->name('setup.windows');
        Route::patch('/setup/schoolday', [SetupController::class, 'updateSchoolday'])->name('setup.schoolday');
        Route::post('/logout', [LoginController::class, 'logout'])->name('logout');

        $stubs = [
            '/students' => ['Students', 'student flow'],
            '/enrolment' => ['Enrolment', 'enrolment flow'],
            '/classes' => ['Classes & Subjects', 'subject management flow'],
            '/series' => ['Series Registration', 'series registration flow'],
            '/assessments' => ['Sequences & Exams', 'assessment flow'],
            '/timetable' => ['Timetable', 'timetable flow'],
            '/fees' => ['Fees', 'finance flow'],
            '/staff' => ['Teachers & Staff', 'staff management flow'],
        ];

        foreach ($stubs as $uri => [$section, $flow]) {
            $name = trim($uri, '/');
            Route::inertia($uri, 'shell/stub', ['section' => $section, 'flow' => $flow])->name($name);
        }
    });
});

Route::get('/register', [RegistrationController::class, 'showSchoolStep'])->name('register.school');
Route::get('/register/slug-check', [RegistrationController::class, 'slugCheck'])->name('register.slug-check');
Route::post('/register/school', [RegistrationController::class, 'storeSchoolStep'])->name('register.school.store');
Route::get('/register/admin', [RegistrationController::class, 'showAdminStep'])->name('register.admin');
Route::post('/register/admin', [RegistrationController::class, 'storeAdminStep'])->name('register.admin.store');
Route::get('/register/verify', [RegistrationController::class, 'showVerifyStep'])->name('register.verify');
Route::post('/register/verify', [RegistrationController::class, 'verify'])->name('register.verify.store');
Route::post('/register/resend', [RegistrationController::class, 'resend'])->name('register.resend');
Route::post('/register/channel', [RegistrationController::class, 'channel'])->name('register.channel');
Route::post('/register/email', [RegistrationController::class, 'updateEmail'])->name('register.email');
Route::get('/register/ready', [RegistrationController::class, 'showReady'])->name('register.ready');
