<?php

use App\Enums\AcademicYearStatus;
use App\Enums\RoomKind;
use App\Enums\SchoolCycle;
use App\Enums\SubjectDomain;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function structureSchool(array $overrides = []): School
{
    return School::create(array_merge([
        'name' => 'Structure Academy',
        'code' => 'ST',
        'slug' => 'structa',
        'cycle' => SchoolCycle::Secondary,
        'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ], $overrides));
}

function structureAdmin(School $school, UserRole $role = UserRole::Admin): User
{
    return User::factory()->create(['school_id' => $school->id, 'role' => $role]);
}

function structureYear(School $school): AcademicYear
{
    return AcademicYear::create([
        'school_id' => $school->id,
        'label' => '2025/26',
        'starts_on' => '2025-09-01',
        'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
}

function structureLevel(School $school, array $overrides = []): Level
{
    return Level::create(array_merge([
        'school_id' => $school->id,
        'name' => 'Form 4',
        'code' => 'F4',
        'ordinal' => 4,
        'cycle' => SchoolCycle::HighSchool,
        'subsystem' => 'anglophone',
        'uses_series' => true,
    ], $overrides));
}

function structureClass(School $school, AcademicYear $year, Level $level, string $name = 'Form 4 A'): SchoolClass
{
    return SchoolClass::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'level_id' => $level->id,
        'name' => $name,
        'capacity' => 45,
    ]);
}

function structureSubject(School $school, string $code, string $name): Subject
{
    return Subject::create([
        'school_id' => $school->id, 'code' => $code, 'name' => $name,
        'department' => 'Sciences', 'domain' => SubjectDomain::General, 'weekly_periods' => 4,
    ]);
}

test('adding a level creates its classes named A, B, C', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);

    $this->actingAs($admin)
        ->post('http://structa.ekol.test/classes/levels', [
            'name' => 'Form 1 Technical',
            'code' => 'f1t',
            'cycle' => 'secondary',
            'subsystem' => 'anglophone',
            'uses_series' => false,
            'class_count' => 3,
        ])
        ->assertRedirect();

    $level = Level::where('name', 'Form 1 Technical')->firstOrFail();

    expect($level->code)->toBe('F1T')
        ->and(SchoolClass::where('level_id', $level->id)->where('academic_year_id', $year->id)->orderBy('name')->pluck('name')->all())
        ->toBe(['Form 1 Technical A', 'Form 1 Technical B', 'Form 1 Technical C']);
});

test('series can only be turned on for GCE high school levels', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    structureYear($school);
    $secondary = structureLevel($school, [
        'name' => 'Form 2', 'code' => 'F2', 'ordinal' => 2,
        'cycle' => SchoolCycle::Secondary, 'uses_series' => false,
    ]);

    $this->actingAs($admin)
        ->post('http://structa.ekol.test/classes/levels', [
            'name' => 'Première', 'code' => 'PRE', 'cycle' => 'high_school',
            'subsystem' => 'francophone', 'uses_series' => true, 'class_count' => 0,
        ])
        ->assertSessionHasErrors('uses_series');

    $this->actingAs($admin)
        ->patch("http://structa.ekol.test/classes/levels/{$secondary->id}", ['uses_series' => true])
        ->assertSessionHasErrors('uses_series');

    expect($secondary->fresh()->uses_series)->toBeFalse()
        ->and(Level::where('name', 'Première')->exists())->toBeFalse();
});

test('a class can be added, given a form master and home room, and renamed', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    structureClass($school, $year, $level, 'Form 4A');
    $teacher = structureAdmin($school, UserRole::Teacher);

    $this->actingAs($admin)
        ->post("http://structa.ekol.test/classes/levels/{$level->id}/classes")
        ->assertRedirect();

    $added = SchoolClass::where('name', 'Form 4B')->firstOrFail();

    $this->actingAs($admin)
        ->post('http://structa.ekol.test/classes/rooms', ['code' => 'A5', 'capacity' => 45])
        ->assertRedirect();

    $room = Room::where('code', 'A5')->firstOrFail();

    $this->actingAs($admin)
        ->patch("http://structa.ekol.test/classes/classes/{$added->id}", [
            'name' => 'Form 4 Blue',
            'capacity' => 40,
            'form_master_id' => $teacher->id,
            'home_room_id' => $room->id,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $added->refresh();

    expect($added->name)->toBe('Form 4 Blue')
        ->and($added->capacity)->toBe(40)
        ->and($added->home_room_id)->toBe($room->id)
        ->and($room->kind)->toBe(RoomKind::Classroom)
        ->and($teacher->fresh()->is_form_master)->toBeTrue();

    $this->actingAs($admin)
        ->patch("http://structa.ekol.test/classes/classes/{$added->id}", [
            'name' => 'Form 4 Blue', 'capacity' => 40,
            'form_master_id' => null, 'home_room_id' => $room->id,
        ]);

    expect($teacher->fresh()->is_form_master)->toBeFalse();
});

test('a home room and a class name cannot be shared', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $first = structureClass($school, $year, $level, 'Form 4A');
    $second = structureClass($school, $year, $level, 'Form 4B');
    $room = Room::create([
        'school_id' => $school->id, 'code' => 'A4', 'name' => 'A4',
        'capacity' => 45, 'kind' => RoomKind::Classroom,
    ]);
    $first->update(['home_room_id' => $room->id]);

    $this->actingAs($admin)
        ->patch("http://structa.ekol.test/classes/classes/{$second->id}", [
            'name' => 'Form 4 A', 'capacity' => 45,
            'form_master_id' => null, 'home_room_id' => $room->id,
        ])
        ->assertSessionHasErrors(['name', 'home_room_id']);
});

test('a class with students cannot be removed, an empty one can', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $busy = structureClass($school, $year, $level, 'Form 4 A');
    $empty = structureClass($school, $year, $level, 'Form 4 B');
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => 'ADM-1',
        'full_name' => 'Placed Student', 'gender' => 'female',
        'date_of_birth' => '2010-01-01', 'guardian_name' => 'G',
        'guardian_phone' => '+237600000002', 'admitted_on' => '2025-09-01',
    ]);
    Enrolment::create([
        'student_id' => $student->id, 'academic_year_id' => $year->id,
        'school_class_id' => $busy->id, 'status' => 'enrolled',
    ]);

    $this->actingAs($admin)
        ->delete("http://structa.ekol.test/classes/classes/{$busy->id}")
        ->assertSessionHasErrors('class');

    $this->actingAs($admin)
        ->delete("http://structa.ekol.test/classes/classes/{$empty->id}")
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect(SchoolClass::whereKey($busy->id)->exists())->toBeTrue()
        ->and(SchoolClass::withTrashed()->whereKey($empty->id)->exists())->toBeFalse();
});

test('the levels page lists classes with student counts and series ranges', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    structureClass($school, $year, $level);

    foreach (['S1', 'S2', 'A1'] as $code) {
        Series::create([
            'school_id' => $school->id, 'level_id' => $level->id,
            'code' => $code, 'name' => "Series {$code}",
            'stream' => str_starts_with($code, 'S') ? 'science' : 'arts',
        ]);
    }

    $this->actingAs($admin)
        ->get('http://structa.ekol.test/classes')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('structure/levels')
            ->where('levels.0.code', 'F4')
            ->where('levels.0.series_allowed', true)
            ->where('levels.0.series.0.label', 'S1–S2')
            ->where('levels.0.series.1.label', 'A1')
            ->where('levels.0.classes.0.name', 'Form 4 A')
            ->where('levels.0.classes.0.students', 0));
});

test('configuring a series saves core and electives and spreads to other levels', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $form4 = structureLevel($school);
    $form5 = structureLevel($school, ['name' => 'Form 5', 'code' => 'F5', 'ordinal' => 5]);
    $physics = structureSubject($school, 'PHY', 'Physics');
    $chemistry = structureSubject($school, 'CHE', 'Chemistry');
    $biology = structureSubject($school, 'BIO', 'Biology');
    structureOfferSubjects($school, $year, $form4, [$physics, $chemistry, $biology]);
    structureOfferSubjects($school, $year, $form5, [$physics, $chemistry, $biology]);

    $this->actingAs($admin)
        ->post('http://structa.ekol.test/classes/series', [
            'level_id' => $form4->id,
            'code' => 's2',
            'name' => 'Science 2',
            'stream' => 'science',
            'min_subjects' => 2,
            'max_subjects' => 5,
            'level_ids' => [$form4->id, $form5->id],
            'core' => [$physics->id],
            'electives' => [$chemistry->id, $biology->id, $physics->id],
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $series = Series::where('level_id', $form4->id)->where('code', 'S2')->firstOrFail();
    $copy = Series::where('level_id', $form5->id)->where('code', 'S2')->firstOrFail();

    expect($series->subjects()->wherePivot('kind', 'core')->pluck('subjects.id')->all())->toBe([$physics->id])
        ->and($series->subjects()->wherePivot('kind', 'elective')->count())->toBe(2)
        ->and($copy->subjects()->count())->toBe(3);

    $this->actingAs($admin)
        ->patch("http://structa.ekol.test/classes/series/{$series->id}", [
            'code' => 'S2', 'name' => 'Science 2', 'stream' => 'science',
            'min_subjects' => 3, 'max_subjects' => 2,
            'level_ids' => [$form4->id], 'core' => [], 'electives' => [],
        ])
        ->assertSessionHasErrors('max_subjects');

    $this->actingAs($admin)
        ->get("http://structa.ekol.test/classes/series?level={$form4->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('structure/series')
            ->where('series.0.code', 'S2')
            ->where('series.0.core', ['Physics'])
            ->where('series.0.electives', 2));
});

test('structure is closed to teachers and to other schools', function () {
    $school = structureSchool();
    $other = structureSchool(['name' => 'Other Academy', 'code' => 'OA', 'slug' => 'othera']);
    $admin = structureAdmin($school);
    $teacher = structureAdmin($school, UserRole::Teacher);
    $foreignLevel = structureLevel($other);
    $foreignClass = structureClass($other, structureYear($other), $foreignLevel);

    $this->actingAs($teacher)->get('http://structa.ekol.test/classes')->assertForbidden();
    $this->actingAs($teacher)->get('http://structa.ekol.test/classes/series')->assertForbidden();

    $this->actingAs($admin)
        ->patch("http://structa.ekol.test/classes/levels/{$foreignLevel->id}", ['uses_series' => false])
        ->assertNotFound();
    $this->actingAs($admin)
        ->delete("http://structa.ekol.test/classes/classes/{$foreignClass->id}")
        ->assertNotFound();
});

test('a standard structure creates its levels and classes and skips existing ones', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    structureLevel($school, [
        'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'uses_series' => false,
    ]);

    $this->actingAs($admin)
        ->get('http://structa.ekol.test/classes/levels/templates')
        ->assertInertia(fn (Assert $page) => $page
            ->component('structure/level-templates')
            ->has('sets', 3)
            ->where('sets.0.levels.0.exists', true)
            ->where('sets.0.levels.1.exists', false));

    $this->actingAs($admin)
        ->post('http://structa.ekol.test/classes/levels/templates', [
            'set' => 'anglophone_full',
            'levels' => [
                ['code' => 'F1', 'class_count' => 4],
                ['code' => 'F2', 'class_count' => 2],
                ['code' => 'U6', 'class_count' => 1],
            ],
        ])
        ->assertRedirect(route('classes'))
        ->assertSessionHasNoErrors();

    $form2 = Level::where('name', 'Form 2')->firstOrFail();
    $upper = Level::where('name', 'Upper Sixth')->firstOrFail();

    expect(Level::where('school_id', $school->id)->orderBy('ordinal')->pluck('name')->all())
        ->toBe(['Form 1', 'Form 2', 'Upper Sixth'])
        ->and(SchoolClass::where('level_id', $form2->id)->orderBy('name')->pluck('name')->all())
        ->toBe(['Form 2A', 'Form 2B'])
        ->and(SchoolClass::where('academic_year_id', $year->id)->count())->toBe(3)
        ->and($upper->uses_series)->toBeTrue()
        ->and($form2->uses_series)->toBeFalse()
        ->and($upper->cycle)->toBe(SchoolCycle::HighSchool);
});

test('a standard structure needs an active year before it can create classes', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);

    $this->actingAs($admin)
        ->post('http://structa.ekol.test/classes/levels/templates', [
            'set' => 'francophone',
            'levels' => [['code' => '6E', 'class_count' => 2]],
        ])
        ->assertSessionHasErrors('levels');

    $this->actingAs($admin)
        ->post('http://structa.ekol.test/classes/levels/templates', [
            'set' => 'francophone',
            'levels' => [['code' => '6E', 'class_count' => 0]],
        ])
        ->assertRedirect();

    expect(Level::where('name', 'Sixième')->value('subsystem'))->toBe('francophone');
});

test('the series form receives core and elective ids as plain lists', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $biology = structureSubject($school, 'BIO', 'Biology');
    $physics = structureSubject($school, 'PHY', 'Physics');
    structureOfferSubjects($school, $year, $level, [$physics, $biology]);
    $series = Series::create([
        'school_id' => $school->id, 'level_id' => $level->id,
        'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science',
    ]);
    // Alphabetically the elective comes first, so the core subject is not at position 0.
    $series->subjects()->sync([
        $biology->id => ['kind' => 'elective'],
        $physics->id => ['kind' => 'core'],
    ]);

    $this->actingAs($admin)
        ->get("http://structa.ekol.test/classes/series/{$series->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('structure/series-edit')
            ->where('series.core', [$physics->id])
            ->where('series.electives', [$biology->id]));
});

test('existing class names join the letter to the level number, word levels keep the space', function () {
    $school = structureSchool();
    $year = structureYear($school);
    $level = structureLevel($school);
    $numbered = structureClass($school, $year, $level, 'Form 1 A');
    $worded = structureClass($school, $year, $level, 'Lower Sixth A');
    $migration = require database_path('migrations/2026_10_30_123736_join_class_letters_to_level_numbers.php');

    $migration->up();

    expect($numbered->fresh()->name)->toBe('Form 1A')
        ->and($worded->fresh()->name)->toBe('Lower Sixth A')
        ->and(SchoolClass::nameFor('Form 2', 'C'))->toBe('Form 2C')
        ->and(SchoolClass::nameFor('Upper Sixth', 'B'))->toBe('Upper Sixth B');
});

/** @param list<Subject> $subjects */
function structureOfferSubjects(School $school, AcademicYear $year, Level $level, array $subjects): void
{
    $class = structureClass($school, $year, $level, $level->name.' A');
    foreach ($subjects as $subject) {
        ClassSubject::create(['school_id' => $school->id, 'school_class_id' => $class->id, 'subject_id' => $subject->id, 'weekly_periods' => 3]);
    }
}

test('series forms only offer subjects assigned to the current level and year', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $other = structureLevel($school, ['name' => 'Form 5', 'code' => 'F5', 'ordinal' => 5]);
    $physics = structureSubject($school, 'PHY', 'Physics');
    $biology = structureSubject($school, 'BIO', 'Biology');
    structureOfferSubjects($school, $year, $level, [$physics]);
    structureOfferSubjects($school, $year, $other, [$biology]);
    structureSubject($school, 'CHE', 'Unassigned chemistry');
    $old = AcademicYear::create(['school_id' => $school->id, 'label' => '2024/25', 'starts_on' => '2024-09-01', 'ends_on' => '2025-07-31', 'status' => 'closed']);
    structureOfferSubjects($school, $old, $level, [structureSubject($school, 'HIS', 'Old history')]);
    $this->actingAs($admin)->get('http://structa.ekol.test/classes/series/new?level='.$level->id)
        ->assertOk()->assertInertia(fn (Assert $page) => $page->has('subjects', 1)->where('subjects.0.id', $physics->id)->where('subjects.0.teachers', 0));

    $series = Series::create(['school_id' => $school->id, 'level_id' => $level->id, 'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science']);
    $series->subjects()->sync([$physics->id => ['kind' => 'core'], $biology->id => ['kind' => 'elective']]);
    $this->get('http://structa.ekol.test/classes/series/'.$series->id)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('subjects', 1)->where('series.core', [$physics->id])->where('series.electives', [])->where('unavailableSubjects', ['Biology']));
    expect($series->subjects()->count())->toBe(2);
    $payload = ['code' => 'S1', 'name' => 'Science 1', 'stream' => 'science', 'min_subjects' => 1, 'max_subjects' => 5, 'level_ids' => [$level->id], 'core' => [$biology->id], 'electives' => [], 'level_id' => $other->id];
    $this->patch('http://structa.ekol.test/classes/series/'.$series->id, $payload)->assertSessionHasErrors('core.0');
    expect($series->subjects()->count())->toBe(2);
    $payload['core'] = [$physics->id];
    $this->patch('http://structa.ekol.test/classes/series/'.$series->id, $payload)->assertSessionHasNoErrors();
    expect($series->subjects()->pluck('subjects.id')->all())->toBe([$physics->id]);
});

test('series saves reject subjects outside the selected level', function (string $field, string $assignment) {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $subjectSchool = $assignment === 'foreign school' ? structureSchool(['name' => 'Other Academy', 'slug' => 'foreign', 'code' => 'OTHER']) : $school;
    $subject = structureSubject($subjectSchool, 'PHY', 'Physics');
    if ($assignment === 'other level') {
        $other = structureLevel($school, ['name' => 'Form 5', 'code' => 'F5', 'ordinal' => 5]);
        structureOfferSubjects($school, $year, $other, [$subject]);
    } elseif ($assignment === 'previous year') {
        $old = AcademicYear::create(['school_id' => $school->id, 'label' => '2024/25', 'starts_on' => '2024-09-01', 'ends_on' => '2025-07-31', 'status' => 'closed']);
        structureOfferSubjects($school, $old, $level, [$subject]);
    }
    $data = ['level_id' => $level->id, 'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science', 'min_subjects' => 1, 'max_subjects' => 5, 'level_ids' => [$level->id], 'core' => [], 'electives' => []];
    $data[$field] = [$subject->id];
    $this->actingAs($admin)->post('http://structa.ekol.test/classes/series', $data)->assertSessionHasErrors($field.'.0');
    expect(Series::count())->toBe(0);
})->with(['core', 'electives'])->with(['other level', 'previous year', 'unassigned', 'foreign school']);

test('spreading a series rejects a level that does not offer its subjects', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $other = structureLevel($school, ['name' => 'Form 5', 'code' => 'F5', 'ordinal' => 5]);
    $subject = structureSubject($school, 'PHY', 'Physics');
    structureOfferSubjects($school, $year, $level, [$subject]);
    $this->actingAs($admin)->post('http://structa.ekol.test/classes/series', ['level_id' => $level->id, 'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science', 'min_subjects' => 1, 'max_subjects' => 5, 'level_ids' => [$level->id, $other->id], 'core' => [$subject->id], 'electives' => []])->assertSessionHasErrors('level_ids');
    expect(Series::count())->toBe(0);
});

test('series accept general subjects and their own domain', function (string $stream, string $domain) {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $subject = structureSubject($school, 'ELIG', 'Eligible subject');
    $subject->update(['domain' => $domain]);
    structureOfferSubjects($school, $year, $level, [$subject]);

    $this->actingAs($admin)->post('http://structa.ekol.test/classes/series', [
        'level_id' => $level->id, 'code' => 'S1', 'name' => 'Series 1', 'stream' => $stream,
        'min_subjects' => 1, 'max_subjects' => 5, 'level_ids' => [$level->id],
        'core' => [$subject->id], 'electives' => [],
    ])->assertSessionHasNoErrors()->assertRedirect();

    expect(Series::sole()->stream)->toBe($stream);
    expect(Series::sole()->subjects()->pluck('subjects.id')->all())->toBe([$subject->id]);
})->with([
    'science general' => ['science', 'general'],
    'science own' => ['science', 'science'],
    'arts general' => ['arts', 'general'],
    'arts own' => ['arts', 'arts'],
    'commercial general' => ['commercial', 'general'],
    'commercial own' => ['commercial', 'commercial'],
]);

test('science series reject other domains and unclassified subjects', function (string $field, ?string $domain) {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $subject = structureSubject($school, 'WRONG', 'Ineligible subject');
    $subject->update(['domain' => $domain]);
    structureOfferSubjects($school, $year, $level, [$subject]);
    $data = [
        'level_id' => $level->id, 'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science',
        'min_subjects' => 1, 'max_subjects' => 5, 'level_ids' => [$level->id], 'core' => [], 'electives' => [],
    ];
    $data[$field] = [$subject->id];

    $this->actingAs($admin)->post('http://structa.ekol.test/classes/series', $data)
        ->assertSessionHasErrors([$field.'.0' => 'Choose a subject assigned to this level for the current academic year.']);

    expect(Series::count())->toBe(0);
})->with(['core', 'electives'])->with(['arts' => ['arts'], 'commercial' => ['commercial'], 'unclassified' => [null]]);

test('series editing exposes all classified domains but excludes incompatible initial selections', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $general = structureSubject($school, 'GEN', 'General subject');
    $science = structureSubject($school, 'SCI', 'Science subject');
    $science->update(['domain' => SubjectDomain::Science]);
    $arts = structureSubject($school, 'ART', 'Arts subject');
    $arts->update(['domain' => SubjectDomain::Arts]);
    $commercial = structureSubject($school, 'COM', 'Commercial subject');
    $commercial->update(['domain' => SubjectDomain::Commercial]);
    $unclassified = structureSubject($school, 'OLD', 'Unclassified subject');
    $unclassified->update(['domain' => null]);
    structureOfferSubjects($school, $year, $level, [$general, $science, $arts, $commercial, $unclassified]);
    $series = Series::create(['school_id' => $school->id, 'level_id' => $level->id, 'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science']);
    $series->subjects()->sync([
        $general->id => ['kind' => 'core'], $science->id => ['kind' => 'elective'],
        $arts->id => ['kind' => 'core'], $unclassified->id => ['kind' => 'elective'],
    ]);

    $this->actingAs($admin)->get('http://structa.ekol.test/classes/series/'.$series->id)
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('subjects', 4)
        ->where('subjects.0.domain', 'arts')
        ->where('subjects.1.domain', 'commercial')
        ->where('subjects.2.domain', 'general')
        ->where('subjects.3.domain', 'science')
        ->where('series.core', [$general->id])
        ->where('series.electives', [$science->id])
        ->where('unavailableSubjects', fn ($names) => collect($names)->sort()->values()->all() === ['Arts subject', 'Unclassified subject']));

    expect($series->subjects()->count())->toBe(4);
});

test('changing a series stream rejects subjects left over from the previous domain', function () {
    $school = structureSchool();
    $admin = structureAdmin($school);
    $year = structureYear($school);
    $level = structureLevel($school);
    $subject = structureSubject($school, 'PHY', 'Physics');
    $subject->update(['domain' => SubjectDomain::Science]);
    structureOfferSubjects($school, $year, $level, [$subject]);
    $series = Series::create(['school_id' => $school->id, 'level_id' => $level->id, 'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science']);
    $series->subjects()->sync([$subject->id => ['kind' => 'core']]);

    $this->actingAs($admin)->patch('http://structa.ekol.test/classes/series/'.$series->id, [
        'code' => 'S1', 'name' => 'Science 1', 'stream' => 'arts',
        'min_subjects' => 1, 'max_subjects' => 5, 'level_ids' => [$level->id],
        'core' => [$subject->id], 'electives' => [],
    ])->assertSessionHasErrors('core.0');

    expect($series->fresh()->stream)->toBe('science');
    expect($series->subjects()->pluck('subjects.id')->all())->toBe([$subject->id]);
});
