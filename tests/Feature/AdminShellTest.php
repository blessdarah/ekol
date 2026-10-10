<?php

use App\Enums\AcademicYearStatus;
use App\Enums\InvoiceStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function shellSchool(array $overrides = []): School
{
    return School::create(array_merge([
        'name' => 'Shell Academy',
        'code' => 'SHA',
        'slug' => 'shella',
        'cycle' => SchoolCycle::Secondary,
        'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ], $overrides));
}

function shellAdmin(School $school): User
{
    return User::create([
        'school_id' => $school->id,
        'staff_code' => 'STF-0001',
        'full_name' => 'Shell Admin',
        'initials' => 'SA',
        'email' => 'shell-admin@example.com',
        'role' => UserRole::Admin,
        'phone' => '+237600000001',
        'password' => 'password123',
    ]);
}

function shellYear(School $school): AcademicYear
{
    return AcademicYear::create([
        'school_id' => $school->id,
        'label' => '2025/26',
        'starts_on' => today()->subMonths(2)->toDateString(),
        'ends_on' => today()->addMonths(8)->toDateString(),
        'status' => AcademicYearStatus::Current,
    ]);
}

test('guests are redirected to sign-in from shell routes', function () {
    $this->get('http://shella.ekol.test/students')
        ->assertRedirect(route('login'));
});

test('every stub destination renders inside the shell', function () {
    $school = shellSchool();
    $user = shellAdmin($school);

    $pages = [
        '/dashboard' => 'dashboard',
        '/students' => 'students/roster',
        '/enrolment' => 'shell/stub',
        '/classes' => 'structure/levels',
        '/series' => 'shell/stub',
        '/assessments' => 'shell/stub',
        '/timetable' => 'shell/stub',
        '/fees' => 'shell/stub',
        '/staff' => 'staff/roster',
        '/setup' => 'setup',
    ];

    foreach ($pages as $uri => $component) {
        $this->actingAs($user)
            ->get("http://shella.ekol.test{$uri}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component($component)
                ->where('school.slug', 'shella'));
    }
});

test('shell props carry live school, term week, user and badge data', function () {
    $school = shellSchool();
    $user = shellAdmin($school);
    $year = shellYear($school);
    Term::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'label' => 'Term 1',
        'sequence' => 1,
        'starts_on' => today()->subDays(28)->toDateString(),
        'ends_on' => today()->addDays(60)->toDateString(),
        'week_count' => 15,
        'is_current' => true,
    ]);

    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 4', 'ordinal' => 4,
        'cycle' => SchoolCycle::Secondary,
    ]);
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => 'ADM-1',
        'full_name' => 'Fee Debtor', 'gender' => 'male',
        'date_of_birth' => '2012-01-01', 'guardian_name' => 'G',
        'guardian_phone' => '+237600000002', 'admitted_on' => '2025-09-01',
    ]);
    $term = Term::where('school_id', $school->id)->first();
    Invoice::create([
        'student_id' => $student->id, 'term_id' => $term->id,
        'fee_plan_id' => FeePlan::create([
            'school_id' => $school->id, 'level_id' => $level->id,
            'academic_year_id' => $year->id, 'annual_amount' => '100000.00',
            'currency' => 'XAF',
        ])->id,
        'amount_due' => '50000.00', 'issued_on' => '2025-09-05',
        'status' => InvoiceStatus::Overdue,
    ]);

    $this->actingAs($user)
        ->get('http://shella.ekol.test/fees')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('school.name', 'Shell Academy')
            ->where('term.label', 'Term 1')
            ->where('term.weekLabel', 'Week 5 of 15')
            ->where('shellUser.full_name', 'Shell Admin')
            ->where('shellUser.roleLabel', 'Admin')
            ->where('feeBadge', 1)
            ->where('section', 'Fees'));
});

test('term chip hides without a current term and badge hides at zero', function () {
    $school = shellSchool();
    $user = shellAdmin($school);

    $this->actingAs($user)
        ->get('http://shella.ekol.test/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('term', null)
            ->where('feeBadge', null));
});
