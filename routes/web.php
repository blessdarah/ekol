<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegistrationController;
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
        Route::inertia('/setup', 'setup')->name('setup');
        Route::post('/logout', [LoginController::class, 'logout'])->name('logout');
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
