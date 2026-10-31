<?php

use App\Actions\CloseTermSchemes;
use App\Actions\OpenTermSchemes;
use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Models\AcademicYear;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\Term;
use Illuminate\Validation\ValidationException;

/**
 * @return array{school: School, term: Term}
 */
function academicActionTerm(): array
{
    $school = School::create([
        'name' => 'Academic actions', 'code' => 'ACA', 'slug' => 'academic-actions',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-12', 'week_count' => 15, 'is_current' => true,
    ]);

    return compact('school', 'term');
}

test('rejected opening leaves the closed term settings unchanged without a request', function () {
    $this->travelTo('2025-12-12 09:00:00');
    ['school' => $school, 'term' => $term] = academicActionTerm();
    $opening = SchemeOpening::create([
        'school_id' => $school->id, 'term_id' => $term->id, 'due_on' => '2025-09-19',
        'approval' => 'head_of_department', 'starts_from' => 'syllabus', 'free_changes' => false,
        'closed_at' => now(),
    ]);

    expect(fn () => app(OpenTermSchemes::class)->handle($school, $term, null, [
        'due_on' => '2025-10-01', 'approval' => 'principal', 'starts_from' => 'syllabus', 'free_changes' => true,
    ]))->toThrow(ValidationException::class);

    $this->assertDatabaseHas('scheme_openings', [
        'id' => $opening->id, 'due_on' => '2025-09-19 00:00:00',
        'approval' => 'head_of_department', 'free_changes' => false,
    ]);
    $this->assertDatabaseCount('schemes', 0);
    $this->assertDatabaseCount('scheme_events', 0);
});

test('scheme actions reject a term from another school before writing', function (string $action) {
    ['school' => $school, 'term' => $term] = academicActionTerm();
    $other = School::create([
        'name' => 'Other school', 'code' => 'OTH', 'slug' => 'other-actions',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);

    $operation = $action === 'open'
        ? fn () => app(OpenTermSchemes::class)->handle($other, $term, null, ['due_on' => '2025-09-19', 'approval' => 'principal', 'starts_from' => 'syllabus', 'free_changes' => false])
        : fn () => app(CloseTermSchemes::class)->handle($other, $term, null, false);

    expect($operation)->toThrow(ValidationException::class);

    $this->assertDatabaseCount('scheme_openings', 0);
    $this->assertDatabaseCount('schemes', 0);
})->with(['open', 'close']);
