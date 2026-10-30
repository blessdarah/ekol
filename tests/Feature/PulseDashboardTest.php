<?php

use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Livewire\Pulse\SchoolExceptions as SchoolExceptionsCard;
use App\Models\School;
use App\Models\User;
use App\Pulse\Recorders\SchoolExceptions;
use Illuminate\Support\Facades\DB;
use Laravel\Pulse\Facades\Pulse;
use Livewire\Livewire;

function pulseSchool(string $slug = 'pulse-school'): School
{
    return School::create(['name' => 'Pulse High School', 'code' => 'PHS', 'slug' => $slug, 'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
}

test('only a signed-in super-admin opens the health dashboard, on the admin site', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin, 'school_id' => null]);
    $admin->forceFill(['is_platform_admin' => true])->save();
    $staff = User::factory()->create(['school_id' => pulseSchool()->id, 'role' => UserRole::Principal]);

    $this->get('http://admin.ekol.test/platform/pulse')->assertRedirect('/platform/login');
    $this->actingAs($staff)->get('http://admin.ekol.test/platform/pulse')->assertRedirect('/platform/login');
    $this->actingAs($admin, 'platform')->get('http://pulse-school.ekol.test/platform/pulse')->assertNotFound();
    $this->actingAs($admin, 'platform')->get('http://admin.ekol.test/platform/pulse')->assertOk();
});

test('errors are counted against the school they happen in and listed by school', function () {
    Pulse::startRecording();
    $school = pulseSchool();
    $recorder = app(SchoolExceptions::class);

    $recorder->record(new RuntimeException('Outside any school'));
    app()->instance('currentSchool', $school);
    $recorder->record(new RuntimeException('Marks failed to save'));
    $recorder->record(new RuntimeException('Marks failed to save'));
    Pulse::ingest();

    expect(DB::table('pulse_entries')->where('type', 'school_exception')->pluck('key')->all())
        ->toBe([$school->id, $school->id]);

    Livewire::test(SchoolExceptionsCard::class, ['lazy' => false])
        ->assertSee('Pulse High School')
        ->assertSee('pulse-school');
});
