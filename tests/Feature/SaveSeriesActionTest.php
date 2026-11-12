<?php

use App\Actions\SaveSeries;
use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Enums\SubjectDomain;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * @return array{school: School, year: AcademicYear, actor: User, form4: Level, form5: Level, physics: Subject, chemistry: Subject, biology: Subject}
 */
function seriesActionWorld(string $slug = 'series-action'): array
{
    $school = School::create([
        'name' => 'Series Academy '.$slug, 'code' => 'SA', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current,
    ]);
    $actor = User::factory()->create(['school_id' => $school->id]);
    $form4 = seriesActionLevel($school, 'Form 4', 4);
    $form5 = seriesActionLevel($school, 'Form 5', 5);
    $physics = seriesActionSubject($school, 'PHY', 'Physics', SubjectDomain::Science);
    $chemistry = seriesActionSubject($school, 'CHE', 'Chemistry', SubjectDomain::Science);
    $biology = seriesActionSubject($school, 'BIO', 'Biology', SubjectDomain::General);

    foreach ([$form4, $form5] as $level) {
        seriesActionOffer($school, $year, $level, [$physics, $chemistry, $biology]);
    }

    return compact('school', 'year', 'actor', 'form4', 'form5', 'physics', 'chemistry', 'biology');
}

function seriesActionLevel(School $school, string $name, int $ordinal, bool $usesSeries = true): Level
{
    return Level::create([
        'school_id' => $school->id, 'name' => $name, 'code' => 'F'.$ordinal, 'ordinal' => $ordinal,
        'cycle' => SchoolCycle::HighSchool, 'subsystem' => 'anglophone', 'uses_series' => $usesSeries,
    ]);
}

function seriesActionSubject(School $school, string $code, string $name, SubjectDomain $domain): Subject
{
    return Subject::create([
        'school_id' => $school->id, 'code' => $code, 'name' => $name,
        'department' => 'Sciences', 'domain' => $domain, 'weekly_periods' => 4,
    ]);
}

/**
 * @param  list<Subject>  $subjects
 */
function seriesActionOffer(School $school, AcademicYear $year, Level $level, array $subjects): void
{
    $class = SchoolClass::firstOrCreate(
        ['academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => $level->name.' A'],
        ['school_id' => $school->id, 'capacity' => 45],
    );

    foreach ($subjects as $subject) {
        ClassSubject::create(['school_id' => $school->id, 'school_class_id' => $class->id, 'subject_id' => $subject->id, 'weekly_periods' => 3]);
    }
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array{code: string, name: string, stream: string, min_subjects: int, max_subjects: int, level_ids: list<string>, core: list<string>, electives: list<string>}
 */
function seriesActionData(array $overrides = []): array
{
    return array_merge([
        'code' => ' s2 ', 'name' => ' Science 2 ', 'stream' => 'science',
        'min_subjects' => 2, 'max_subjects' => 5,
        'level_ids' => [], 'core' => [], 'electives' => [],
    ], $overrides);
}

/**
 * @return array<string, string>
 */
function seriesActionPivot(Series $series): array
{
    return $series->subjects()->orderBy('subjects.code')->get()->mapWithKeys(fn (Subject $subject) => [$subject->code => $subject->pivot->kind])->all();
}

test('creating a series saves its configuration, applies it to other levels and audits once', function () {
    $world = seriesActionWorld();

    $series = app(SaveSeries::class)->handle($world['school'], $world['actor'], $world['form4'], $world['year'], null, seriesActionData([
        'level_ids' => [$world['form4']->id, $world['form5']->id],
        'core' => [$world['physics']->id],
        'electives' => [$world['chemistry']->id, $world['biology']->id, $world['physics']->id],
    ]));

    $copy = Series::where('level_id', $world['form5']->id)->sole();

    expect($series->only(['level_id', 'code', 'name', 'stream', 'min_subjects', 'max_subjects']))
        ->toBe(['level_id' => $world['form4']->id, 'code' => 'S2', 'name' => 'Science 2', 'stream' => 'science', 'min_subjects' => 2, 'max_subjects' => 5])
        ->and(seriesActionPivot($series))->toBe(['BIO' => 'elective', 'CHE' => 'elective', 'PHY' => 'core'])
        ->and($copy->only(['code', 'name']))->toBe(['code' => 'S2', 'name' => 'Science 2'])
        ->and(seriesActionPivot($copy))->toBe(seriesActionPivot($series));

    $audit = AuditEvent::sole();
    expect($audit->only(['entity', 'entity_id', 'action', 'actor_id']))
        ->toBe(['entity' => 'series', 'entity_id' => $series->id, 'action' => 'created', 'actor_id' => $world['actor']->id]);
});

test('updating a series matches existing copies by code then name and keeps unselected levels and registrations', function () {
    $world = seriesActionWorld();
    $form6 = seriesActionLevel($world['school'], 'Upper Sixth', 7);
    seriesActionOffer($world['school'], $world['year'], $form6, [$world['physics'], $world['chemistry'], $world['biology']]);
    $lower = seriesActionLevel($world['school'], 'Lower Sixth', 6);

    $source = Series::create(['school_id' => $world['school']->id, 'level_id' => $world['form4']->id, 'code' => 'S2', 'name' => 'Science 2', 'stream' => 'science']);
    $byName = Series::create(['school_id' => $world['school']->id, 'level_id' => $world['form5']->id, 'code' => 'OLD', 'name' => 'Science 2', 'stream' => 'science']);
    $untouched = Series::create(['school_id' => $world['school']->id, 'level_id' => $lower->id, 'code' => 'S2', 'name' => 'Science 2', 'stream' => 'science', 'min_subjects' => 1]);
    $untouched->subjects()->sync([$world['biology']->id => ['kind' => 'core']]);

    $term = Term::create([
        'school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id, 'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19', 'week_count' => 16, 'is_current' => true,
    ]);
    $student = Student::create([
        'school_id' => $world['school']->id, 'admission_no' => 'SA-25-0001', 'full_name' => 'Ngwa Ruth', 'gender' => 'female',
        'date_of_birth' => '2009-01-01', 'guardian_name' => 'G', 'guardian_phone' => '+237600000001', 'admitted_on' => '2025-09-01',
    ]);
    $registration = StudentSeries::create(['student_id' => $student->id, 'term_id' => $term->id, 'series_id' => $source->id]);
    $registration->electives()->sync([$world['chemistry']->id]);

    app(SaveSeries::class)->handle($world['school'], $world['actor'], $world['form4'], $world['year'], $source, seriesActionData([
        'code' => 'S2', 'name' => 'Science 2', 'min_subjects' => 3,
        'level_ids' => [$world['form4']->id, $world['form5']->id, $form6->id],
        'core' => [$world['physics']->id], 'electives' => [$world['chemistry']->id],
    ]));

    expect(Series::count())->toBe(4)
        ->and($byName->fresh()->code)->toBe('S2')
        ->and(seriesActionPivot($byName))->toBe(['CHE' => 'elective', 'PHY' => 'core'])
        ->and(Series::where('level_id', $form6->id)->sole()->min_subjects)->toBe(3)
        ->and($untouched->fresh()->min_subjects)->toBe(1)
        ->and(seriesActionPivot($untouched))->toBe(['BIO' => 'core'])
        ->and($registration->fresh()->series_id)->toBe($source->id)
        ->and($registration->electives()->pluck('subjects.id')->all())->toBe([$world['chemistry']->id])
        ->and(AuditEvent::sole()->action)->toBe('configured');
});

test('the action rejects subjects outside General and the series domain', function () {
    $world = seriesActionWorld();
    $history = seriesActionSubject($world['school'], 'HIS', 'History', SubjectDomain::Arts);
    seriesActionOffer($world['school'], $world['year'], $world['form4'], [$history]);

    expect(fn () => app(SaveSeries::class)->handle($world['school'], $world['actor'], $world['form4'], $world['year'], null, seriesActionData([
        'level_ids' => [$world['form4']->id], 'electives' => [$history->id],
    ])))->toThrow(ValidationException::class);

    expect(Series::count())->toBe(0)->and(AuditEvent::count())->toBe(0);
});

test('the action rejects a selected level that does not offer the subjects or carry series', function (string $case) {
    $world = seriesActionWorld();
    $target = $case === 'missing subject'
        ? seriesActionLevel($world['school'], 'Lower Sixth', 6)
        : seriesActionLevel($world['school'], 'Form 3', 3, usesSeries: false);

    try {
        app(SaveSeries::class)->handle($world['school'], $world['actor'], $world['form4'], $world['year'], null, seriesActionData([
            'level_ids' => [$world['form4']->id, $target->id], 'core' => [$world['physics']->id],
        ]));
        $this->fail('The series was saved.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey('level_ids');
    }

    expect(Series::count())->toBe(0)->and(AuditEvent::count())->toBe(0);
})->with(['missing subject', 'without series']);

test('the action rejects levels and series from another school', function () {
    $world = seriesActionWorld();
    $other = seriesActionWorld('series-action-other');
    $foreign = Series::create(['school_id' => $other['school']->id, 'level_id' => $other['form4']->id, 'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science']);

    expect(fn () => app(SaveSeries::class)->handle($world['school'], $world['actor'], $other['form4'], $world['year'], null, seriesActionData()))
        ->toThrow(ValidationException::class)
        ->and(fn () => app(SaveSeries::class)->handle($world['school'], $world['actor'], $world['form4'], $world['year'], $foreign, seriesActionData()))
        ->toThrow(ValidationException::class)
        ->and(fn () => app(SaveSeries::class)->handle($world['school'], $world['actor'], $world['form4'], $world['year'], null, seriesActionData(['level_ids' => [$other['form5']->id]])))
        ->toThrow(ValidationException::class);

    expect(Series::where('school_id', $world['school']->id)->count())->toBe(0)
        ->and($foreign->fresh()->name)->toBe('Science 1');
});

test('a failure while auditing rolls back the series, its copies and subjects', function () {
    $world = seriesActionWorld();
    $source = Series::create(['school_id' => $world['school']->id, 'level_id' => $world['form4']->id, 'code' => 'S2', 'name' => 'Science 2', 'stream' => 'science']);
    $source->subjects()->sync([$world['biology']->id => ['kind' => 'core']]);
    AuditEvent::creating(fn () => throw new RuntimeException('Audit store unavailable.'));

    expect(fn () => app(SaveSeries::class)->handle($world['school'], $world['actor'], $world['form4'], $world['year'], $source, seriesActionData([
        'name' => 'Science Renamed', 'level_ids' => [$world['form4']->id, $world['form5']->id],
        'core' => [$world['physics']->id], 'electives' => [$world['chemistry']->id],
    ])))->toThrow(RuntimeException::class, 'Audit store unavailable.');

    expect($source->fresh()->name)->toBe('Science 2')
        ->and(seriesActionPivot($source))->toBe(['BIO' => 'core'])
        ->and(Series::count())->toBe(1);
});
