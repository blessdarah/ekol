<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\StaffInvitationController;
use App\Http\Controllers\SeriesController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StructureController;
use App\Http\Controllers\SubjectController;
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
    Route::get('/invitation/{token}', [StaffInvitationController::class, 'show'])->name('invitation.show');
    Route::post('/invitation/{token}', [StaffInvitationController::class, 'store'])
        ->middleware('throttle:10,1')->name('invitation.store');

    Route::middleware('auth')->group(function () {
        Route::inertia('/dashboard', 'dashboard')->name('dashboard');
        Route::get('/setup', [SetupController::class, 'show'])->name('setup');
        Route::patch('/setup/profile', [SetupController::class, 'updateProfile'])->name('setup.profile');
        Route::post('/setup/years', [SetupController::class, 'storeYear'])->name('setup.years.store');
        Route::patch('/setup/years/{year}', [SetupController::class, 'updateYear'])->name('setup.years.update');
        Route::patch('/setup/years/{year}/active', [SetupController::class, 'activateYear'])->name('setup.years.activate');
        Route::patch('/setup/terms', [SetupController::class, 'updateTerms'])->name('setup.terms');
        Route::patch('/setup/terms/{term}/active', [SetupController::class, 'activateTerm'])->name('setup.terms.activate');
        Route::patch('/setup/installments', [SetupController::class, 'updateInstallments'])->name('setup.installments');
        Route::patch('/setup/windows', [SetupController::class, 'updateWindows'])->name('setup.windows');
        Route::patch('/setup/schoolday', [SetupController::class, 'updateSchoolday'])->name('setup.schoolday');

        Route::get('/staff', [StaffController::class, 'index'])->name('staff');
        Route::get('/staff/register', [StaffController::class, 'create'])->name('staff.create');
        Route::post('/staff', [StaffController::class, 'store'])->name('staff.store');
        Route::get('/staff/{staff}', [StaffController::class, 'show'])->name('staff.show');
        Route::get('/staff/{staff}/edit', [StaffController::class, 'edit'])->name('staff.edit');
        Route::patch('/staff/{staff}', [StaffController::class, 'update'])->name('staff.update');
        Route::get('/staff/{staff}/access', [StaffController::class, 'access'])->name('staff.access');
        Route::post('/staff/{staff}/access', [StaffController::class, 'saveAccess'])->name('staff.access.save');
        Route::post('/staff/{staff}/reminder', [StaffController::class, 'remind'])->name('staff.remind');
        Route::patch('/staff/{staff}/hours', [StaffController::class, 'updateHours'])->name('staff.hours');

        Route::get('/classes', [StructureController::class, 'index'])->name('classes');
        Route::get('/classes/levels/new', [StructureController::class, 'createLevel'])->name('classes.levels.create');
        Route::post('/classes/levels', [StructureController::class, 'storeLevel'])->name('classes.levels.store');
        Route::get('/classes/levels/templates', [StructureController::class, 'levelTemplates'])->name('classes.levels.templates');
        Route::post('/classes/levels/templates', [StructureController::class, 'storeLevelTemplates'])->name('classes.levels.templates.store');
        Route::patch('/classes/levels/{level}', [StructureController::class, 'updateLevel'])->name('classes.levels.update');
        Route::post('/classes/levels/{level}/classes', [StructureController::class, 'storeClass'])->name('classes.classes.store');
        Route::patch('/classes/classes/{class}', [StructureController::class, 'updateClass'])->name('classes.classes.update');
        Route::delete('/classes/classes/{class}', [StructureController::class, 'destroyClass'])->name('classes.classes.destroy');
        Route::post('/classes/rooms', [StructureController::class, 'storeRoom'])->name('classes.rooms.store');
        Route::get('/classes/series', [SeriesController::class, 'index'])->name('classes.series');
        Route::get('/classes/series/new', [SeriesController::class, 'create'])->name('classes.series.create');
        Route::post('/classes/series', [SeriesController::class, 'store'])->name('classes.series.store');
        Route::get('/classes/series/{series}', [SeriesController::class, 'edit'])->name('classes.series.edit');
        Route::patch('/classes/series/{series}', [SeriesController::class, 'update'])->name('classes.series.update');
        Route::get('/classes/subjects', [SubjectController::class, 'index'])->name('classes.subjects');
        Route::get('/classes/subjects/new', [SubjectController::class, 'create'])->name('classes.subjects.create');
        Route::post('/classes/subjects', [SubjectController::class, 'store'])->name('classes.subjects.store');
        Route::get('/classes/subjects/templates', [SubjectController::class, 'templates'])->name('classes.subjects.templates');
        Route::post('/classes/subjects/templates', [SubjectController::class, 'storeTemplates'])->name('classes.subjects.templates.store');
        Route::get('/classes/subjects/{subject}', [SubjectController::class, 'show'])->name('classes.subjects.show');
        Route::get('/classes/subjects/{subject}/edit', [SubjectController::class, 'edit'])->name('classes.subjects.edit');
        Route::patch('/classes/subjects/{subject}', [SubjectController::class, 'update'])->name('classes.subjects.update');
        Route::post('/logout', [LoginController::class, 'logout'])->name('logout');

        $stubs = [
            '/students' => ['Students', 'student flow'],
            '/enrolment' => ['Enrolment', 'enrolment flow'],
            '/series' => ['Series Registration', 'series registration flow'],
            '/assessments' => ['Sequences & Exams', 'assessment flow'],
            '/timetable' => ['Timetable', 'timetable flow'],
            '/fees' => ['Fees', 'finance flow'],
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
