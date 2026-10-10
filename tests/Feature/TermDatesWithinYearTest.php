<?php

use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Models\AcademicYear;
use App\Models\School;
use App\Models\Term;
use Illuminate\Validation\ValidationException;

test('term dates must fall inside its academic year', function () {
    $school = School::create([
        'name' => 'Year Bounds School',
        'code' => 'YBS',
        'slug' => 'year-bounds',
        'cycle' => SchoolCycle::Secondary,
        'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);

    $year = AcademicYear::create([
        'school_id' => $school->id,
        'label' => '2025/26',
        'starts_on' => '2025-09-01',
        'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);

    expect(fn () => Term::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'label' => 'Term 0',
        'sequence' => 1,
        'starts_on' => '2025-08-15',
        'ends_on' => '2025-12-12',
        'week_count' => 15,
    ]))->toThrow(ValidationException::class);

    expect(fn () => Term::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'label' => 'Term 9',
        'sequence' => 2,
        'starts_on' => '2026-01-05',
        'ends_on' => '2026-08-15',
        'week_count' => 12,
    ]))->toThrow(ValidationException::class);

    $term = Term::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'label' => 'Term 1',
        'sequence' => 1,
        'starts_on' => '2025-09-01',
        'ends_on' => '2025-12-12',
        'week_count' => 15,
    ]);

    expect($term->academicYear->id)->toBe($year->id);
});
