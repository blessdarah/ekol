<?php

use App\Actions\Students\AdmitStudent;
use App\Actions\Students\UpdateStudent;
use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Term;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * A school with a current year and term, two Form 4 classes, a series and
 * one admitted student whose private details are on record.
 *
 * @return array{school: School, year: AcademicYear, term: Term, classes: array<int, SchoolClass>, series: Series, admin: User, registrar: User, student: Student}
 */
function updateStudentWorld(string $slug = 'update-students'): array
{
    $school = School::create([
        'name' => "Update Academy {$slug}", 'code' => 'UPA', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19',
        'week_count' => 16, 'is_current' => true,
    ]);
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 4', 'code' => 'F4', 'ordinal' => 4,
        'cycle' => SchoolCycle::HighSchool, 'subsystem' => 'anglophone', 'uses_series' => true,
    ]);
    $classes = array_map(fn (string $letter) => SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => "Form 4 {$letter}", 'capacity' => 2,
    ]), ['A', 'B']);
    $series = Series::create([
        'school_id' => $school->id, 'level_id' => $level->id,
        'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $registrar = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Registrar]);
    $student = app(AdmitStudent::class)->handle(
        $school, $year, $term, $classes[0], updateStudentProfile(), updateStudentGuardians(), $admin, $series,
    );

    return compact('school', 'year', 'term', 'classes', 'series', 'admin', 'registrar', 'student');
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function updateStudentProfile(array $overrides = []): array
{
    return array_merge([
        'surname' => 'Tabi', 'given_names' => 'Grace', 'full_name' => 'Tabi Grace',
        'date_of_birth' => '2010-03-14', 'gender' => 'female', 'place_of_birth' => 'Bamenda',
        'transferred' => false, 'on_whatsapp' => true,
        'religion' => 'Presbyterian', 'has_disability' => true,
        'disability_types' => ['Visual'], 'disability_support' => 'Sits in the front row',
    ], $overrides);
}

/**
 * @return list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}>
 */
function updateStudentGuardians(string $name = 'Tabi Nkwain'): array
{
    return [['relation' => 'father', 'name' => $name, 'phone' => '+237 670 14 52 08', 'occupation' => 'Trader', 'is_main' => true]];
}

test('a student update saves the profile, parents, class, series, sibling link and audit together', function () {
    $world = updateStudentWorld();
    $sibling = app(AdmitStudent::class)->handle(
        $world['school'], $world['year'], $world['term'], $world['classes'][0],
        updateStudentProfile(['given_names' => 'Junior', 'full_name' => 'Tabi Junior']), updateStudentGuardians(), $world['admin'],
    );

    $student = app(UpdateStudent::class)->handle(
        $world['school'], $world['admin'], $world['year'], $world['term'], $world['student'], $world['classes'][1],
        updateStudentProfile(['place_of_birth' => 'Kumbo', 'religion' => 'Catholic', 'has_disability' => false, 'disability_types' => null, 'disability_support' => null]),
        [
            ['relation' => 'mother', 'name' => 'Ngum Beatrice', 'phone' => '+237 655 48 20 91', 'occupation' => 'Nurse', 'is_main' => true],
            ['relation' => 'father', 'name' => 'Tabi Nkwain', 'phone' => null, 'occupation' => null, 'is_main' => false],
        ],
        $world['series'], $sibling->id,
    );

    $student->refresh();

    expect($student->place_of_birth)->toBe('Kumbo')
        ->and($student->religion)->toBe('Catholic')
        ->and($student->has_disability)->toBeFalse()
        ->and($student->guardians()->pluck('name', 'relation')->all())->toEqualCanonicalizing(['mother' => 'Ngum Beatrice', 'father' => 'Tabi Nkwain'])
        ->and($student->guardians()->where('is_main', true)->value('relation'))->toBe('mother')
        ->and(Enrolment::where('student_id', $student->id)->sole()->school_class_id)->toBe($world['classes'][1]->id)
        ->and(StudentSeries::where('student_id', $student->id)->where('term_id', $world['term']->id)->value('series_id'))->toBe($world['series']->id)
        ->and($student->family_id)->not->toBeNull()
        ->and($sibling->fresh()->family_id)->toBe($student->family_id);

    $audit = AuditEvent::where('action', 'updated')->sole();
    expect($audit->entity_id)->toBe($student->id)
        ->and($audit->actor_id)->toBe($world['admin']->id)
        ->and($audit->diff)->toBe(['class_id' => $world['classes'][1]->id]);
});

test('a student update without a series clears only the current term series', function () {
    $world = updateStudentWorld();
    $nextTerm = Term::create([
        'school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id,
        'label' => 'Term 2', 'sequence' => 2,
        'starts_on' => '2026-01-05', 'ends_on' => '2026-03-27', 'week_count' => 12,
    ]);
    StudentSeries::create(['student_id' => $world['student']->id, 'term_id' => $nextTerm->id, 'series_id' => $world['series']->id]);

    app(UpdateStudent::class)->handle(
        $world['school'], $world['admin'], $world['year'], $world['term'], $world['student'], $world['classes'][0],
        updateStudentProfile(), updateStudentGuardians(),
    );

    expect(StudentSeries::where('student_id', $world['student']->id)->pluck('term_id')->all())->toBe([$nextTerm->id]);
});

test('a student update without a current year or term leaves the class and series alone', function () {
    $world = updateStudentWorld();

    app(UpdateStudent::class)->handle(
        $world['school'], $world['admin'], null, null, $world['student'], $world['classes'][1],
        updateStudentProfile(['place_of_birth' => 'Wum']), updateStudentGuardians('Tabi Paul'),
    );

    expect($world['student']->fresh()->place_of_birth)->toBe('Wum')
        ->and($world['student']->guardians()->value('name'))->toBe('Tabi Paul')
        ->and(Enrolment::where('student_id', $world['student']->id)->sole()->school_class_id)->toBe($world['classes'][0]->id)
        ->and(StudentSeries::where('student_id', $world['student']->id)->value('series_id'))->toBe($world['series']->id);
});

test('restricted and system actors cannot overwrite private student details', function (string $who) {
    $world = updateStudentWorld();
    $actor = $who === 'registrar' ? $world['registrar'] : null;

    app(UpdateStudent::class)->handle(
        $world['school'], $actor, $world['year'], $world['term'], $world['student'], $world['classes'][0],
        updateStudentProfile(['place_of_birth' => 'Kumbo', 'religion' => null, 'has_disability' => false, 'disability_types' => null, 'disability_support' => null]),
        updateStudentGuardians(),
    );

    $student = $world['student']->fresh();

    expect($student->place_of_birth)->toBe('Kumbo')
        ->and($student->religion)->toBe('Presbyterian')
        ->and($student->has_disability)->toBeTrue()
        ->and($student->disability_types)->toBe(['Visual'])
        ->and($student->disability_support)->toBe('Sits in the front row');
})->with(['registrar', 'system']);

test('a student update refuses records from another school', function (string $foreign) {
    $world = updateStudentWorld();
    $other = updateStudentWorld('other-update-students');
    $args = [
        'student' => $world['student'], 'class' => $world['classes'][0], 'year' => $world['year'],
        'term' => $world['term'], 'series' => $world['series'], 'actor' => $world['admin'],
    ];
    $args[$foreign] = match ($foreign) {
        'student' => $other['student'],
        'class' => $other['classes'][0],
        'actor' => $other['admin'],
        default => $other[$foreign],
    };

    expect(fn () => app(UpdateStudent::class)->handle(
        $world['school'], $args['actor'], $args['year'], $args['term'], $args['student'], $args['class'],
        updateStudentProfile(['place_of_birth' => 'Kumbo']), updateStudentGuardians(), $args['series'],
    ))->toThrow(NotFoundHttpException::class);

    expect(Student::where('place_of_birth', 'Kumbo')->exists())->toBeFalse()
        ->and(AuditEvent::where('action', 'updated')->exists())->toBeFalse();
})->with(['student', 'class', 'year', 'term', 'series', 'actor']);

test('a sibling from another school rolls the whole update back', function () {
    $world = updateStudentWorld();
    $other = updateStudentWorld('sibling-elsewhere');

    expect(fn () => app(UpdateStudent::class)->handle(
        $world['school'], $world['admin'], $world['year'], $world['term'], $world['student'], $world['classes'][1],
        updateStudentProfile(['place_of_birth' => 'Kumbo']), updateStudentGuardians('Tabi Paul'), null, $other['student']->id,
    ))->toThrow(ModelNotFoundException::class);

    $student = $world['student']->fresh();

    expect($student->place_of_birth)->toBe('Bamenda')
        ->and($student->family_id)->toBeNull()
        ->and($other['student']->fresh()->family_id)->toBeNull()
        ->and($student->guardians()->value('name'))->toBe('Tabi Nkwain')
        ->and(Enrolment::where('student_id', $student->id)->sole()->school_class_id)->toBe($world['classes'][0]->id)
        ->and(StudentSeries::where('student_id', $student->id)->value('series_id'))->toBe($world['series']->id)
        ->and(AuditEvent::where('action', 'updated')->exists())->toBeFalse();
});

test('a student update refuses a full class and an unconfirmed duplicate', function () {
    $world = updateStudentWorld();
    $admit = app(AdmitStudent::class);

    foreach (['Ayuk', 'Bih'] as $name) {
        $admit->handle($world['school'], $world['year'], $world['term'], $world['classes'][1],
            updateStudentProfile(['given_names' => $name, 'full_name' => "Tabi {$name}"]), updateStudentGuardians(), $world['admin']);
    }

    $update = fn (SchoolClass $class, array $profile, bool $allowDuplicate = false) => app(UpdateStudent::class)->handle(
        $world['school'], $world['admin'], $world['year'], $world['term'], $world['student'], $class,
        updateStudentProfile($profile), updateStudentGuardians(), null, null, $allowDuplicate,
    );

    expect(fn () => $update($world['classes'][1], []))->toThrow(ValidationException::class)
        ->and(fn () => $update($world['classes'][0], ['given_names' => 'Ayuk', 'full_name' => 'Tabi Ayuk']))->toThrow(ValidationException::class);

    $update($world['classes'][0], ['given_names' => 'Ayuk', 'full_name' => 'Tabi Ayuk'], true);

    expect($world['student']->fresh()->full_name)->toBe('Tabi Ayuk');
});
