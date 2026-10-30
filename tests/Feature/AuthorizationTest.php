<?php

use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AssessmentSubject;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;

function authSchool(): School
{
    return School::create([
        'name' => 'Gate Academy', 'code' => 'GATE', 'slug' => 'gatea',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
}

test('each ability gate follows the role that holds it', function (UserRole $role, array $allowed) {
    $user = User::factory()->make(['role' => $role]);

    foreach (UserRole::ABILITIES as $ability) {
        expect(Gate::forUser($user)->allows($ability))->toBe(in_array($ability, $allowed, true), "{$role->value} · {$ability}");
    }
})->with([
    'principal' => [UserRole::Principal, ['manage-structure', 'manage-students', 'see-private-student-details', 'manage-assessments', 'manage-schemes', 'follow-schemes', 'manage-fees', 'read-student-fees', 'manage-staff']],
    'bursar' => [UserRole::Bursar, ['manage-fees', 'read-student-fees']],
    'registrar' => [UserRole::Registrar, ['manage-students', 'read-student-fees']],
    'head of department' => [UserRole::HeadOfDepartment, ['follow-schemes']],
    'teacher' => [UserRole::Teacher, []],
]);

test('a mark sheet is open to its examiner and to those who manage assessments', function () {
    $examiner = User::factory()->make(['id' => 'examiner', 'role' => UserRole::Teacher]);
    $colleague = User::factory()->make(['id' => 'colleague', 'role' => UserRole::Teacher]);
    $lead = User::factory()->make(['id' => 'lead', 'role' => UserRole::AcademicLead]);
    $sheet = new AssessmentSubject(['examiner_id' => 'examiner']);

    expect($examiner->can('enterMarks', $sheet))->toBeTrue()
        ->and($colleague->can('enterMarks', $sheet))->toBeFalse()
        ->and($lead->can('enterMarks', $sheet))->toBeTrue();
});

test('every page is told what the signed-in person may do', function () {
    $school = authSchool();
    $bursar = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Bursar]);

    $this->actingAs($bursar)
        ->get('http://gatea.ekol.test/fees')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('can.manage-fees', true)
            ->where('can.manage-students', false)
            ->where('can.manage-staff', false));
});
