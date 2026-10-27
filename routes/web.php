<?php

use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\AssessmentController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\StaffInvitationController;
use App\Http\Controllers\CorrectionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DemoSchoolController;
use App\Http\Controllers\EnrolmentController;
use App\Http\Controllers\ExamScheduleController;
use App\Http\Controllers\FeeController;
use App\Http\Controllers\GradingController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\MarkSheetController;
use App\Http\Controllers\MobilePaymentController;
use App\Http\Controllers\ParentController;
use App\Http\Controllers\PayController;
use App\Http\Controllers\PlatformAuthController;
use App\Http\Controllers\PlatformController;
use App\Http\Controllers\SchemeController;
use App\Http\Controllers\SeriesController;
use App\Http\Controllers\SeriesRegistrationController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StructureController;
use App\Http\Controllers\StudentAcademicsController;
use App\Http\Controllers\StudentAttendanceController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\StudentImportController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\SyllabusController;
use App\Http\Controllers\TeacherSchemeController;
use App\Http\Controllers\TeacherTimetableController;
use App\Http\Controllers\TermResultController;
use App\Http\Controllers\TimetableChangeController;
use App\Http\Controllers\TimetableController;
use App\Http\Controllers\TimetableReviewController;
use App\Http\Controllers\TimetableRoomController;
use App\Http\Middleware\ResolveSchool;
use App\Http\Middleware\SetLocale;
use Illuminate\Support\Facades\Route;

Route::prefix('platform')->name('platform.')->group(function () {
    Route::get('/login', [PlatformAuthController::class, 'show'])->name('login');
    Route::post('/login', [PlatformAuthController::class, 'store'])->middleware('throttle:5,1')->name('login.store');
    Route::post('/verify', [PlatformAuthController::class, 'verify'])->middleware('throttle:5,1')->name('verify');
    Route::post('/logout', [PlatformAuthController::class, 'logout'])->name('logout');
    Route::get('/', [PlatformController::class, 'schools'])->name('schools');
    Route::post('/schools/{school}/visit', [PlatformController::class, 'visit'])->name('visit');
    Route::post('/leave', [PlatformController::class, 'leave'])->name('leave');
    Route::get('/visits', [PlatformController::class, 'visits'])->name('visits');
    Route::get('/sign-ups', [PlatformController::class, 'signups'])->name('signups');
    Route::get('/demos', [PlatformController::class, 'demos'])->name('demos');
    Route::post('/demos/{demo}', [PlatformController::class, 'updateDemo'])->name('demos.update');
    Route::post('/demos/{demo}/email', [PlatformController::class, 'emailDemo'])->middleware('throttle:3,1')->name('demos.email');
});

Route::middleware([ResolveSchool::class, SetLocale::class])->group(function () {
    Route::get('/demo-school/{demo}', [DemoSchoolController::class, 'show'])->middleware('signed:relative')->name('demo-school.show');
    Route::post('/demo-school/{demo}/open', [DemoSchoolController::class, 'open'])->middleware('signed:relative')->name('demo-school.open');
    Route::post('/demo-start', [DemoSchoolController::class, 'start'])->middleware('auth')->name('demo-school.start');
    Route::get('/demo-register/{demo}', [DemoSchoolController::class, 'register'])->middleware('signed:relative')->name('demo-school.register');
});

Route::get('/', [LandingController::class, 'show'])->middleware([ResolveSchool::class, SetLocale::class])->name('home');
Route::post('/demo', [LandingController::class, 'storeDemo'])->middleware([SetLocale::class, 'throttle:6,1'])->name('demo.store');

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

Route::post('/locale', [LocaleController::class, 'update'])->middleware([ResolveSchool::class, SetLocale::class])->name('locale.update');

Route::middleware([ResolveSchool::class, SetLocale::class])->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('login.store');
    Route::post('/login/find-school', [LoginController::class, 'findSchool'])->name('login.find');
    Route::inertia('/forgot-password', 'auth/forgot-password')->name('password.request');
    Route::get('/invitation/{token}', [StaffInvitationController::class, 'show'])->name('invitation.show');
    Route::post('/invitation/{token}', [StaffInvitationController::class, 'store'])
        ->middleware('throttle:10,1')->name('invitation.store');

    Route::get('/pay', [ParentController::class, 'fromSchool'])->name('pay');

    Route::middleware('auth')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'show'])->name('dashboard');
        Route::get('/my-timetable', [TeacherTimetableController::class, 'show'])->name('my-timetable');
        Route::get('/attendance', [AttendanceController::class, 'show'])->name('attendance');
        Route::post('/attendance/{slot}', [AttendanceController::class, 'store'])->name('attendance.store');

        Route::group(['prefix' => 'my-scheme'], function () {
            Route::get('/', [TeacherSchemeController::class, 'show'])->name('my-scheme');
            Route::post('/{scheme}/items', [TeacherSchemeController::class, 'add'])->name('my-scheme.items.store');
            Route::patch('/{scheme}/items/{item}', [TeacherSchemeController::class, 'place'])->name('my-scheme.items.place');
            Route::delete('/{scheme}/items/{item}', [TeacherSchemeController::class, 'remove'])->name('my-scheme.items.destroy');
            Route::patch('/{scheme}/items/{item}/taught', [TeacherSchemeController::class, 'tick'])->name('my-scheme.items.tick');
            Route::post('/{scheme}/submit', [TeacherSchemeController::class, 'submit'])->name('my-scheme.submit');
        });

        $teacherStubs = [
            '/teaching-log' => ['Teaching Log', 'teaching log flow'],
            '/lesson-notes' => ['Lesson Notes', 'lesson notes flow'],
            '/question-bank' => ['Question Bank', 'question bank flow'],
        ];

        foreach ($teacherStubs as $uri => [$section, $flow]) {
            Route::inertia($uri, 'shell/stub', ['section' => $section, 'flow' => $flow])->name(trim($uri, '/'));
        }

        Route::group(['prefix' => 'setup'], function () {
            Route::get('/', [SetupController::class, 'show'])->name('setup');
            Route::patch('/profile', [SetupController::class, 'updateProfile'])->name('setup.profile');
            Route::post('/years', [SetupController::class, 'storeYear'])->name('setup.years.store');
            Route::patch('/years/{year}', [SetupController::class, 'updateYear'])->name('setup.years.update');
            Route::patch('/years/{year}/active', [SetupController::class, 'activateYear'])->name('setup.years.activate');
            Route::patch('/terms', [SetupController::class, 'updateTerms'])->name('setup.terms');
            Route::patch('/terms/{term}/active', [SetupController::class, 'activateTerm'])->name('setup.terms.activate');
            Route::patch('/installments', [SetupController::class, 'updateInstallments'])->name('setup.installments');
            Route::patch('/windows', [SetupController::class, 'updateWindows'])->name('setup.windows');
            Route::patch('/schoolday', [SetupController::class, 'updateSchoolday'])->name('setup.schoolday');
        });

        Route::group(['prefix' => 'staff'], function () {
            Route::get('/', [StaffController::class, 'index'])->name('staff');
            Route::get('/register', [StaffController::class, 'create'])->name('staff.create');
            Route::post('', [StaffController::class, 'store'])->name('staff.store');
            Route::get('/{staff}', [StaffController::class, 'show'])->name('staff.show');
            Route::get('/{staff}/edit', [StaffController::class, 'edit'])->name('staff.edit');
            Route::patch('/{staff}', [StaffController::class, 'update'])->name('staff.update');
            Route::get('/{staff}/access', [StaffController::class, 'access'])->name('staff.access');
            Route::post('/{staff}/access', [StaffController::class, 'saveAccess'])->name('staff.access.save');
            Route::post('/{staff}/reminder', [StaffController::class, 'remind'])->name('staff.remind');
            Route::patch('/{staff}/hours', [StaffController::class, 'updateHours'])->name('staff.hours');
        });

        Route::group(['prefix' => 'classes'], function () {
            Route::get('/', [StructureController::class, 'index'])->name('classes');
            Route::get('/levels/new', [StructureController::class, 'createLevel'])->name('classes.levels.create');
            Route::post('/levels', [StructureController::class, 'storeLevel'])->name('classes.levels.store');
            Route::get('/levels/templates', [StructureController::class, 'levelTemplates'])->name('classes.levels.templates');
            Route::post('/levels/templates', [StructureController::class, 'storeLevelTemplates'])->name('classes.levels.templates.store');
            Route::patch('/levels/{level}', [StructureController::class, 'updateLevel'])->name('classes.levels.update');
            Route::post('/levels/{level}/classes', [StructureController::class, 'storeClass'])->name('classes.classes.store');
            Route::patch('/classes/{class}', [StructureController::class, 'updateClass'])->name('classes.classes.update');
            Route::delete('/classes/{class}', [StructureController::class, 'destroyClass'])->name('classes.classes.destroy');
            Route::post('/rooms', [StructureController::class, 'storeRoom'])->name('classes.rooms.store');
            Route::get('/series', [SeriesController::class, 'index'])->name('classes.series');
            Route::get('/series/new', [SeriesController::class, 'create'])->name('classes.series.create');
            Route::post('/series', [SeriesController::class, 'store'])->name('classes.series.store');
            Route::get('/series/{series}', [SeriesController::class, 'edit'])->name('classes.series.edit');
            Route::patch('/series/{series}', [SeriesController::class, 'update'])->name('classes.series.update');
            Route::group(['prefix' => 'schemes'], function () {
                Route::get('/', [SchemeController::class, 'index'])->name('schemes');
                Route::get('/syllabus', [SyllabusController::class, 'show'])->name('schemes.syllabus');
                Route::post('/syllabus/topics', [SyllabusController::class, 'store'])->name('schemes.syllabus.store');
                Route::patch('/syllabus/topics/{topic}', [SyllabusController::class, 'update'])->name('schemes.syllabus.update');
                Route::delete('/syllabus/topics/{topic}', [SyllabusController::class, 'destroy'])->name('schemes.syllabus.destroy');
                Route::patch('/syllabus/topics/{topic}/move', [SyllabusController::class, 'move'])->name('schemes.syllabus.move');
                Route::get('/open', [SchemeController::class, 'opening'])->name('schemes.open');
                Route::post('/open', [SchemeController::class, 'open'])->name('schemes.open.store');
                Route::get('/close', [SchemeController::class, 'closing'])->name('schemes.close');
                Route::post('/close', [SchemeController::class, 'close'])->name('schemes.close.store');
                Route::get('/close/report', [SchemeController::class, 'report'])->name('schemes.report');
                Route::get('/{scheme}', [SchemeController::class, 'show'])->name('schemes.show');
                Route::post('/{scheme}/review', [SchemeController::class, 'review'])->name('schemes.review');
                Route::post('/{scheme}/notes', [SchemeController::class, 'note'])->name('schemes.note');
            });
            Route::get('/subjects', [SubjectController::class, 'index'])->name('classes.subjects');
            Route::get('/subjects/new', [SubjectController::class, 'create'])->name('classes.subjects.create');
            Route::post('/subjects', [SubjectController::class, 'store'])->name('classes.subjects.store');
            Route::get('/subjects/templates', [SubjectController::class, 'templates'])->name('classes.subjects.templates');
            Route::post('/subjects/templates', [SubjectController::class, 'storeTemplates'])->name('classes.subjects.templates.store');
            Route::get('/subjects/{subject}', [SubjectController::class, 'show'])->name('classes.subjects.show');
            Route::get('/subjects/{subject}/edit', [SubjectController::class, 'edit'])->name('classes.subjects.edit');
            Route::patch('/subjects/{subject}', [SubjectController::class, 'update'])->name('classes.subjects.update');
        });

        Route::group(['prefix' => 'students'], function () {
            Route::get('/', [StudentController::class, 'index'])->name('students');
            Route::get('/new', [StudentController::class, 'create'])->name('students.create');
            Route::post('', [StudentController::class, 'store'])->name('students.store');
            Route::get('/sibling-check', [StudentController::class, 'siblingCheck'])->name('students.sibling-check');
            Route::get('/import', [StudentImportController::class, 'show'])->name('students.import');
            Route::post('/import', [StudentImportController::class, 'upload'])->name('students.import.upload');
            Route::delete('/import', [StudentImportController::class, 'destroy'])->name('students.import.destroy');
            Route::post('/import/mapping', [StudentImportController::class, 'mapping'])->name('students.import.mapping');
            Route::delete('/import/mapping', [StudentImportController::class, 'clearMapping'])->name('students.import.mapping.clear');
            Route::post('/import/run', [StudentImportController::class, 'run'])->name('students.import.run');
            Route::get('/import/problems', [StudentImportController::class, 'problems'])->name('students.import.problems');
            Route::get('/import/template', [StudentImportController::class, 'template'])->name('students.import.template');
            Route::get('/{student}', [StudentController::class, 'show'])->name('students.show');
            Route::get('/{student}/academics', [StudentAcademicsController::class, 'show'])->name('students.academics');
            Route::get('/{student}/fees', [FeeController::class, 'studentTab'])->name('students.fees');
            Route::get('/{student}/attendance', [StudentAttendanceController::class, 'show'])->name('students.attendance');
            Route::post('/{student}/attendance/{attendance}/excuse', [StudentAttendanceController::class, 'excuse'])->name('students.attendance.excuse');
            Route::get('/{student}/edit', [StudentController::class, 'edit'])->name('students.edit');
            Route::patch('/{student}', [StudentController::class, 'update'])->name('students.update');
        });

        Route::group(['prefix' => 'series'], function () {
            Route::get('/', [SeriesRegistrationController::class, 'index'])->name('series');
            Route::get('/register', [SeriesRegistrationController::class, 'one'])->name('series.one');
            Route::post('/register', [SeriesRegistrationController::class, 'register'])->name('series.register');
            Route::get('/bulk', [SeriesRegistrationController::class, 'bulk'])->name('series.bulk');
            Route::post('/bulk', [SeriesRegistrationController::class, 'bulkStore'])->name('series.bulk.store');
            Route::get('/students/{student}/change', [SeriesRegistrationController::class, 'change'])->name('series.change');
            Route::post('/students/{student}/change', [SeriesRegistrationController::class, 'changeStore'])->name('series.change.store');
        });

        Route::group(['prefix' => 'enrolment'], function () {
            Route::get('/', [EnrolmentController::class, 'index'])->name('enrolment');
            Route::post('/classes', [EnrolmentController::class, 'copyClasses'])->name('enrolment.classes.copy');
            Route::post('/levels/{level}/classes', [EnrolmentController::class, 'storeClass'])->name('enrolment.classes.store');
            Route::get('/applications', [ApplicationController::class, 'index'])->name('enrolment.applications');
            Route::get('/applications/new', [ApplicationController::class, 'create'])->name('enrolment.applications.create');
            Route::post('/applications', [ApplicationController::class, 'store'])->name('enrolment.applications.store');
            Route::get('/applications/{application}', [ApplicationController::class, 'show'])->name('enrolment.applications.show');
            Route::patch('/applications/{application}/documents', [ApplicationController::class, 'documents'])->name('enrolment.applications.documents');
            Route::post('/applications/{application}/decision', [ApplicationController::class, 'decide'])->name('enrolment.applications.decide');
            Route::get('/re-enrolment', [EnrolmentController::class, 'reEnrolment'])->name('enrolment.re-enrolment');
            Route::post('/re-enrolment', [EnrolmentController::class, 'decide'])->name('enrolment.re-enrolment.decide');
            Route::post('/re-enrolment/promote', [EnrolmentController::class, 'promoteClass'])->name('enrolment.re-enrolment.promote');
            Route::get('/placement', [EnrolmentController::class, 'placement'])->name('enrolment.placement');
            Route::post('/placement', [EnrolmentController::class, 'place'])->name('enrolment.placement.place');
            Route::post('/placement/all', [EnrolmentController::class, 'placeAll'])->name('enrolment.placement.all');
            Route::post('/placement/clear', [EnrolmentController::class, 'clearClass'])->name('enrolment.placement.clear');
            Route::get('/confirm', [EnrolmentController::class, 'confirm'])->name('enrolment.confirm');
            Route::post('/confirm', [EnrolmentController::class, 'storeConfirmation'])->name('enrolment.confirm.store');
        });

        Route::group(['prefix' => 'timetable'], function () {
            Route::get('/', [TimetableController::class, 'index'])->name('timetable');
            Route::get('/setup', [TimetableController::class, 'setup'])->name('timetable.setup');
            Route::get('/rooms', [TimetableRoomController::class, 'index'])->name('timetable.rooms');
            Route::post('/rooms', [TimetableRoomController::class, 'store'])->name('timetable.rooms.store');
            Route::patch('/rooms/{room}', [TimetableRoomController::class, 'update'])->name('timetable.rooms.update');
            Route::delete('/rooms/{room}', [TimetableRoomController::class, 'destroy'])->name('timetable.rooms.destroy');
            Route::get('/checks', [TimetableController::class, 'checks'])->name('timetable.checks');
            Route::get('/generate', [TimetableController::class, 'generator'])->name('timetable.generate');
            Route::post('/generate', [TimetableController::class, 'generate'])->name('timetable.generate.run');
            Route::get('/review', [TimetableReviewController::class, 'show'])->name('timetable.review');
            Route::post('/slots', [TimetableReviewController::class, 'store'])->name('timetable.slots.store');
            Route::patch('/slots/{slot}', [TimetableReviewController::class, 'update'])->name('timetable.slots.update');
            Route::delete('/slots/{slot}', [TimetableReviewController::class, 'destroy'])->name('timetable.slots.destroy');
            Route::get('/publish', [TimetableController::class, 'publishing'])->name('timetable.publish');
            Route::post('/publish', [TimetableController::class, 'publish'])->name('timetable.publish.store');
            Route::get('/changes', [TimetableChangeController::class, 'index'])->name('timetable.changes');
            Route::post('/changes', [TimetableChangeController::class, 'store'])->name('timetable.changes.store');
        });

        Route::group(['prefix' => 'fees'], function () {
            Route::get('/', [FeeController::class, 'index'])->name('fees');
            Route::get('/structure', [FeeController::class, 'structure'])->name('fees.structure');
            Route::patch('/structure', [FeeController::class, 'updateStructure'])->name('fees.structure.update');
            Route::post('/structure/bill', [FeeController::class, 'bill'])->name('fees.structure.bill');
            Route::get('/students/{student}', [FeeController::class, 'student'])->name('fees.student');
            Route::post('/students/{student}/payments', [FeeController::class, 'pay'])->name('fees.pay');
            Route::post('/invoices/{invoice}/exemption', [FeeController::class, 'exempt'])->name('fees.exemption');
            Route::delete('/invoices/{invoice}/exemption', [FeeController::class, 'removeExemption'])->name('fees.exemption.remove');
            Route::get('/payments/{payment}/receipt', [FeeController::class, 'receipt'])->name('fees.receipt');
            Route::get('/mobile-money', [MobilePaymentController::class, 'index'])->name('fees.mobile');
            Route::post('/mobile-money/{payment}/check', [MobilePaymentController::class, 'check'])->name('fees.mobile.check');
        });

        Route::group(['prefix' => 'assessments'], function () {
            Route::get('/', [AssessmentController::class, 'index'])->name('assessments');
            Route::get('/new', [AssessmentController::class, 'create'])->name('assessments.create');
            Route::post('', [AssessmentController::class, 'store'])->name('assessments.store');
            Route::post('/terms/{term}/usual', [AssessmentController::class, 'usual'])->name('assessments.usual');
            Route::get('/schedule', [ExamScheduleController::class, 'show'])->name('assessments.schedule');
            Route::post('/schedule/{plan}/papers', [ExamScheduleController::class, 'save'])->name('assessments.schedule.save');
            Route::delete('/schedule/{plan}/papers/{paper}', [ExamScheduleController::class, 'destroy'])->name('assessments.schedule.destroy');
            Route::post('/schedule/{plan}/publish', [ExamScheduleController::class, 'publish'])->name('assessments.schedule.publish');
            Route::get('/progress', [AssessmentController::class, 'progress'])->name('assessments.progress');
            Route::get('/results', [AssessmentController::class, 'results'])->name('assessments.results');
            Route::get('/term', [TermResultController::class, 'term'])->name('assessments.term');
            Route::get('/reports', [TermResultController::class, 'reports'])->name('assessments.reports');
            Route::get('/reports/print', [TermResultController::class, 'print'])->name('assessments.reports.print');
            Route::get('/corrections', [CorrectionController::class, 'index'])->name('assessments.corrections');
            Route::post('/corrections', [CorrectionController::class, 'store'])->name('assessments.corrections.store');
            Route::post('/corrections/{correction}/decision', [CorrectionController::class, 'decide'])->name('assessments.corrections.decide');
            Route::get('/grading', [GradingController::class, 'show'])->name('assessments.grading');
            Route::put('/grading', [GradingController::class, 'update'])->name('assessments.grading.update');
            Route::get('/sheets', [MarkSheetController::class, 'index'])->name('assessments.sheets');
            Route::get('/sheets/{sheet}', [MarkSheetController::class, 'show'])->name('assessments.sheets.show');
            Route::patch('/sheets/{sheet}', [MarkSheetController::class, 'update'])->name('assessments.sheets.update');
            Route::get('/{plan}/edit', [AssessmentController::class, 'edit'])->name('assessments.edit');
            Route::patch('/{plan}', [AssessmentController::class, 'update'])->name('assessments.update');
            Route::post('/{plan}/close', [AssessmentController::class, 'close'])->name('assessments.close');
            Route::post('/{plan}/window', [AssessmentController::class, 'window'])->name('assessments.window');
            Route::post('/{plan}/publish', [AssessmentController::class, 'publish'])->name('assessments.publish');
        });

        Route::post('/logout', [LoginController::class, 'logout'])->name('logout');
    });
});

/*
 * Parent services live on the main address: parents do not know their
 * school's subdomain. They find the school, then prove the child is
 * theirs with the matricule, the phone the school has and an SMS code.
 */
Route::group(['prefix' => 'parents', 'middleware' => SetLocale::class], function () {
    Route::get('/', [ParentController::class, 'show'])->name('parents');
    Route::get('/schools', [ParentController::class, 'schools'])->middleware('throttle:60,1')->name('parents.schools');
    Route::post('/', [ParentController::class, 'find'])->middleware('throttle:10,1')->name('parents.find');
    Route::get('/verify', [ParentController::class, 'verification'])->name('parents.verify');
    Route::post('/verify', [ParentController::class, 'verify'])->middleware('throttle:10,1')->name('parents.verify.store');
    Route::post('/verify/resend', [ParentController::class, 'resend'])->middleware('throttle:3,1')->name('parents.verify.resend');
    Route::get('/home', [ParentController::class, 'home'])->name('parents.home');
    Route::get('/attendance', [ParentController::class, 'attendance'])->name('parents.attendance');
    Route::post('/leave', [ParentController::class, 'leave'])->name('parents.leave');
    Route::get('/pay', [PayController::class, 'amount'])->name('parents.pay');
    Route::post('/pay', [PayController::class, 'chooseAmount'])->name('parents.pay.amount');
    Route::get('/pay/phone', [PayController::class, 'phone'])->name('parents.pay.phone');
    Route::post('/pay/phone', [PayController::class, 'store'])->middleware('throttle:6,1')->name('parents.pay.store');
    Route::get('/pay/requests/{payment}', [PayController::class, 'status'])->name('parents.pay.status');
    Route::post('/pay/requests/{payment}/retry', [PayController::class, 'retry'])->middleware('throttle:6,1')->name('parents.pay.retry');
});

Route::group(['prefix' => 'register', 'middleware' => SetLocale::class], function () {
    Route::get('/', [RegistrationController::class, 'showSchoolStep'])->name('register.school');
    Route::get('/slug-check', [RegistrationController::class, 'slugCheck'])->name('register.slug-check');
    Route::post('/school', [RegistrationController::class, 'storeSchoolStep'])->name('register.school.store');
    Route::get('/admin', [RegistrationController::class, 'showAdminStep'])->name('register.admin');
    Route::post('/admin', [RegistrationController::class, 'storeAdminStep'])->name('register.admin.store');
    Route::get('/verify', [RegistrationController::class, 'showVerifyStep'])->name('register.verify');
    Route::post('/verify', [RegistrationController::class, 'verify'])->name('register.verify.store');
    Route::post('/resend', [RegistrationController::class, 'resend'])->name('register.resend');
    Route::post('/channel', [RegistrationController::class, 'channel'])->name('register.channel');
    Route::post('/email', [RegistrationController::class, 'updateEmail'])->name('register.email');
    Route::get('/ready', [RegistrationController::class, 'showReady'])->name('register.ready');
});
