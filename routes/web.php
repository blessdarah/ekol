<?php

use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\AssessmentController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\StaffInvitationController;
use App\Http\Controllers\CorrectionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EnrolmentController;
use App\Http\Controllers\ExamScheduleController;
use App\Http\Controllers\FeeController;
use App\Http\Controllers\GradingController;
use App\Http\Controllers\MarkSheetController;
use App\Http\Controllers\SeriesController;
use App\Http\Controllers\SeriesRegistrationController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StructureController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\StudentImportController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\TermResultController;
use App\Http\Controllers\TimetableChangeController;
use App\Http\Controllers\TimetableController;
use App\Http\Controllers\TimetableReviewController;
use App\Http\Controllers\TimetableRoomController;
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
        Route::get('/dashboard', [DashboardController::class, 'show'])->name('dashboard');

        $teacherStubs = [
            '/my-timetable' => ['My Timetable', 'teacher timetable flow'],
            '/attendance' => ['Attendance', 'attendance flow'],
            '/teaching-log' => ['Teaching Log', 'teaching log flow'],
            '/lesson-notes' => ['Lesson Notes', 'lesson notes flow'],
            '/question-bank' => ['Question Bank', 'question bank flow'],
        ];

        foreach ($teacherStubs as $uri => [$section, $flow]) {
            Route::inertia($uri, 'shell/stub', ['section' => $section, 'flow' => $flow])->name(trim($uri, '/'));
        }

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
        Route::get('/students', [StudentController::class, 'index'])->name('students');
        Route::get('/students/new', [StudentController::class, 'create'])->name('students.create');
        Route::post('/students', [StudentController::class, 'store'])->name('students.store');
        Route::get('/students/sibling-check', [StudentController::class, 'siblingCheck'])->name('students.sibling-check');
        Route::get('/students/import', [StudentImportController::class, 'show'])->name('students.import');
        Route::post('/students/import', [StudentImportController::class, 'upload'])->name('students.import.upload');
        Route::delete('/students/import', [StudentImportController::class, 'destroy'])->name('students.import.destroy');
        Route::post('/students/import/mapping', [StudentImportController::class, 'mapping'])->name('students.import.mapping');
        Route::delete('/students/import/mapping', [StudentImportController::class, 'clearMapping'])->name('students.import.mapping.clear');
        Route::post('/students/import/run', [StudentImportController::class, 'run'])->name('students.import.run');
        Route::get('/students/import/problems', [StudentImportController::class, 'problems'])->name('students.import.problems');
        Route::get('/students/import/template', [StudentImportController::class, 'template'])->name('students.import.template');
        Route::get('/students/{student}', [StudentController::class, 'show'])->name('students.show');
        Route::get('/students/{student}/fees', [FeeController::class, 'studentTab'])->name('students.fees');
        Route::get('/students/{student}/edit', [StudentController::class, 'edit'])->name('students.edit');
        Route::patch('/students/{student}', [StudentController::class, 'update'])->name('students.update');
        Route::get('/series', [SeriesRegistrationController::class, 'index'])->name('series');
        Route::get('/series/register', [SeriesRegistrationController::class, 'one'])->name('series.one');
        Route::post('/series/register', [SeriesRegistrationController::class, 'register'])->name('series.register');
        Route::get('/series/bulk', [SeriesRegistrationController::class, 'bulk'])->name('series.bulk');
        Route::post('/series/bulk', [SeriesRegistrationController::class, 'bulkStore'])->name('series.bulk.store');
        Route::get('/series/students/{student}/change', [SeriesRegistrationController::class, 'change'])->name('series.change');
        Route::post('/series/students/{student}/change', [SeriesRegistrationController::class, 'changeStore'])->name('series.change.store');
        Route::get('/enrolment', [EnrolmentController::class, 'index'])->name('enrolment');
        Route::post('/enrolment/classes', [EnrolmentController::class, 'copyClasses'])->name('enrolment.classes.copy');
        Route::post('/enrolment/levels/{level}/classes', [EnrolmentController::class, 'storeClass'])->name('enrolment.classes.store');
        Route::get('/enrolment/applications', [ApplicationController::class, 'index'])->name('enrolment.applications');
        Route::get('/enrolment/applications/new', [ApplicationController::class, 'create'])->name('enrolment.applications.create');
        Route::post('/enrolment/applications', [ApplicationController::class, 'store'])->name('enrolment.applications.store');
        Route::get('/enrolment/applications/{application}', [ApplicationController::class, 'show'])->name('enrolment.applications.show');
        Route::patch('/enrolment/applications/{application}/documents', [ApplicationController::class, 'documents'])->name('enrolment.applications.documents');
        Route::post('/enrolment/applications/{application}/decision', [ApplicationController::class, 'decide'])->name('enrolment.applications.decide');
        Route::get('/enrolment/re-enrolment', [EnrolmentController::class, 'reEnrolment'])->name('enrolment.re-enrolment');
        Route::post('/enrolment/re-enrolment', [EnrolmentController::class, 'decide'])->name('enrolment.re-enrolment.decide');
        Route::post('/enrolment/re-enrolment/promote', [EnrolmentController::class, 'promoteClass'])->name('enrolment.re-enrolment.promote');
        Route::get('/enrolment/placement', [EnrolmentController::class, 'placement'])->name('enrolment.placement');
        Route::post('/enrolment/placement', [EnrolmentController::class, 'place'])->name('enrolment.placement.place');
        Route::post('/enrolment/placement/all', [EnrolmentController::class, 'placeAll'])->name('enrolment.placement.all');
        Route::post('/enrolment/placement/clear', [EnrolmentController::class, 'clearClass'])->name('enrolment.placement.clear');
        Route::get('/enrolment/confirm', [EnrolmentController::class, 'confirm'])->name('enrolment.confirm');
        Route::post('/enrolment/confirm', [EnrolmentController::class, 'storeConfirmation'])->name('enrolment.confirm.store');
        Route::get('/timetable', [TimetableController::class, 'index'])->name('timetable');
        Route::get('/timetable/setup', [TimetableController::class, 'setup'])->name('timetable.setup');
        Route::get('/timetable/rooms', [TimetableRoomController::class, 'index'])->name('timetable.rooms');
        Route::post('/timetable/rooms', [TimetableRoomController::class, 'store'])->name('timetable.rooms.store');
        Route::patch('/timetable/rooms/{room}', [TimetableRoomController::class, 'update'])->name('timetable.rooms.update');
        Route::delete('/timetable/rooms/{room}', [TimetableRoomController::class, 'destroy'])->name('timetable.rooms.destroy');
        Route::get('/timetable/checks', [TimetableController::class, 'checks'])->name('timetable.checks');
        Route::get('/timetable/generate', [TimetableController::class, 'generator'])->name('timetable.generate');
        Route::post('/timetable/generate', [TimetableController::class, 'generate'])->name('timetable.generate.run');
        Route::get('/timetable/review', [TimetableReviewController::class, 'show'])->name('timetable.review');
        Route::post('/timetable/slots', [TimetableReviewController::class, 'store'])->name('timetable.slots.store');
        Route::patch('/timetable/slots/{slot}', [TimetableReviewController::class, 'update'])->name('timetable.slots.update');
        Route::delete('/timetable/slots/{slot}', [TimetableReviewController::class, 'destroy'])->name('timetable.slots.destroy');
        Route::get('/timetable/publish', [TimetableController::class, 'publishing'])->name('timetable.publish');
        Route::post('/timetable/publish', [TimetableController::class, 'publish'])->name('timetable.publish.store');
        Route::get('/timetable/changes', [TimetableChangeController::class, 'index'])->name('timetable.changes');
        Route::post('/timetable/changes', [TimetableChangeController::class, 'store'])->name('timetable.changes.store');
        Route::get('/fees', [FeeController::class, 'index'])->name('fees');
        Route::get('/fees/structure', [FeeController::class, 'structure'])->name('fees.structure');
        Route::patch('/fees/structure', [FeeController::class, 'updateStructure'])->name('fees.structure.update');
        Route::post('/fees/structure/bill', [FeeController::class, 'bill'])->name('fees.structure.bill');
        Route::get('/fees/students/{student}', [FeeController::class, 'student'])->name('fees.student');
        Route::post('/fees/students/{student}/payments', [FeeController::class, 'pay'])->name('fees.pay');
        Route::post('/fees/invoices/{invoice}/exemption', [FeeController::class, 'exempt'])->name('fees.exemption');
        Route::delete('/fees/invoices/{invoice}/exemption', [FeeController::class, 'removeExemption'])->name('fees.exemption.remove');
        Route::get('/fees/payments/{payment}/receipt', [FeeController::class, 'receipt'])->name('fees.receipt');
        Route::get('/assessments', [AssessmentController::class, 'index'])->name('assessments');
        Route::get('/assessments/new', [AssessmentController::class, 'create'])->name('assessments.create');
        Route::post('/assessments', [AssessmentController::class, 'store'])->name('assessments.store');
        Route::post('/assessments/terms/{term}/usual', [AssessmentController::class, 'usual'])->name('assessments.usual');
        Route::get('/assessments/schedule', [ExamScheduleController::class, 'show'])->name('assessments.schedule');
        Route::post('/assessments/schedule/{plan}/papers', [ExamScheduleController::class, 'save'])->name('assessments.schedule.save');
        Route::delete('/assessments/schedule/{plan}/papers/{paper}', [ExamScheduleController::class, 'destroy'])->name('assessments.schedule.destroy');
        Route::post('/assessments/schedule/{plan}/publish', [ExamScheduleController::class, 'publish'])->name('assessments.schedule.publish');
        Route::get('/assessments/progress', [AssessmentController::class, 'progress'])->name('assessments.progress');
        Route::get('/assessments/results', [AssessmentController::class, 'results'])->name('assessments.results');
        Route::get('/assessments/term', [TermResultController::class, 'term'])->name('assessments.term');
        Route::get('/assessments/reports', [TermResultController::class, 'reports'])->name('assessments.reports');
        Route::get('/assessments/reports/print', [TermResultController::class, 'print'])->name('assessments.reports.print');
        Route::get('/assessments/corrections', [CorrectionController::class, 'index'])->name('assessments.corrections');
        Route::post('/assessments/corrections', [CorrectionController::class, 'store'])->name('assessments.corrections.store');
        Route::post('/assessments/corrections/{correction}/decision', [CorrectionController::class, 'decide'])->name('assessments.corrections.decide');
        Route::get('/assessments/grading', [GradingController::class, 'show'])->name('assessments.grading');
        Route::put('/assessments/grading', [GradingController::class, 'update'])->name('assessments.grading.update');
        Route::get('/assessments/sheets', [MarkSheetController::class, 'index'])->name('assessments.sheets');
        Route::get('/assessments/sheets/{sheet}', [MarkSheetController::class, 'show'])->name('assessments.sheets.show');
        Route::patch('/assessments/sheets/{sheet}', [MarkSheetController::class, 'update'])->name('assessments.sheets.update');
        Route::get('/assessments/{plan}/edit', [AssessmentController::class, 'edit'])->name('assessments.edit');
        Route::patch('/assessments/{plan}', [AssessmentController::class, 'update'])->name('assessments.update');
        Route::post('/assessments/{plan}/close', [AssessmentController::class, 'close'])->name('assessments.close');
        Route::post('/assessments/{plan}/window', [AssessmentController::class, 'window'])->name('assessments.window');
        Route::post('/assessments/{plan}/publish', [AssessmentController::class, 'publish'])->name('assessments.publish');
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
