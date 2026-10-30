<?php

use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Http\SchoolContext;
use App\Models\AcademicYear;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function contextSchool(string $slug): School
{
    return School::create([
        'name' => "Context $slug", 'code' => strtoupper($slug), 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
}

function contextYear(School $school, int $start, AcademicYearStatus $status = AcademicYearStatus::Current): AcademicYear
{
    return $school->academicYears()->create([
        'label' => "$start/".($start + 1), 'starts_on' => "$start-09-01",
        'ends_on' => ($start + 1).'-07-31', 'status' => $status,
    ]);
}

test('school context remembers each calendar lookup including missing results', function (bool $hasCalendar) {
    $school = contextSchool('contexta');
    $year = $hasCalendar ? contextYear($school, 2025) : null;
    $next = $hasCalendar ? contextYear($school, 2026, AcademicYearStatus::Planned) : null;
    $term = $year ? $school->terms()->create([
        'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19', 'week_count' => 16, 'is_current' => true,
    ]) : null;
    $context = app(SchoolContext::class);
    $context->bind($school);
    DB::enableQueryLog();
    DB::flushQueryLog();

    try {
        foreach (range(1, 3) as $attempt) {
            expect($context->year()?->id)->toBe($year?->id)
                ->and($context->term()?->id)->toBe($term?->id)
                ->and($context->nextYear()?->id)->toBe($next?->id);
        }

        expect(DB::getQueryLog())->toHaveCount(3);
    } finally {
        DB::disableQueryLog();
        DB::flushQueryLog();
    }
})->with([true, false]);

test('the next year is the earliest planned year after the current year', function () {
    $school = contextSchool('contexta');
    $other = contextSchool('contextb');
    contextYear($school, 2025);
    contextYear($school, 2024, AcademicYearStatus::Planned);
    contextYear($school, 2028, AcademicYearStatus::Planned);
    $next = contextYear($school, 2026, AcademicYearStatus::Planned);
    contextYear($other, 2025);
    contextYear($other, 2026, AcademicYearStatus::Planned);
    $context = app(SchoolContext::class);
    $context->bind($school);

    expect($context->nextYear()?->id)->toBe($next->id);
});

test('calendar lookups can be refreshed after a change within the request', function () {
    $school = contextSchool('contexta');
    $context = app(SchoolContext::class);
    $context->bind($school);
    expect($context->year())->toBeNull();
    $year = contextYear($school, 2025);
    expect($context->year())->toBeNull();

    $context->refresh();

    expect($context->year()?->id)->toBe($year->id);
});

test('cached controllers receive the school and calendar of each successive request', function () {
    $first = contextSchool('contexta');
    $second = contextSchool('contextb');
    contextYear($first, 2025);
    contextYear($second, 2027);
    $firstAdmin = User::factory()->create(['school_id' => $first->id, 'role' => UserRole::Admin]);
    $secondAdmin = User::factory()->create(['school_id' => $second->id, 'role' => UserRole::Admin]);

    $this->actingAs($firstAdmin)->get('http://contexta.ekol.test/students')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('yearLabel', '2025/2026'));
    expect(app(SchoolContext::class)->hasSchool())->toBeFalse();
    $this->actingAs($secondAdmin)->get('http://contextb.ekol.test/students')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('yearLabel', '2027/2028'));
    expect(app(SchoolContext::class)->hasSchool())->toBeFalse();
    $this->get('http://ekol.test/students')->assertNotFound();
});

test('a rejected cross-school request clears its tenant context', function () {
    $first = contextSchool('contexta');
    $second = contextSchool('contextb');
    contextYear($first, 2025);
    $admin = User::factory()->create(['school_id' => $first->id, 'role' => UserRole::Admin]);

    $this->actingAs($admin)->get('http://contextb.ekol.test/students')->assertForbidden();

    expect(app(SchoolContext::class)->hasSchool())->toBeFalse()
        ->and(app()->bound('currentSchool'))->toBeFalse();
    $this->get('http://contexta.ekol.test/students')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('yearLabel', '2025/2026'));
});
