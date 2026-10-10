<?php

use App\Enums\AcademicYearStatus;
use App\Enums\RoomKind;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
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
        'department' => 'Sciences', 'weekly_periods' => 4,
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
    structureClass($school, $year, $level, 'Form 4 A');
    $teacher = structureAdmin($school, UserRole::Teacher);

    $this->actingAs($admin)
        ->post("http://structa.ekol.test/classes/levels/{$level->id}/classes")
        ->assertRedirect();

    $added = SchoolClass::where('name', 'Form 4 B')->firstOrFail();

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
    $first = structureClass($school, $year, $level, 'Form 4 A');
    $second = structureClass($school, $year, $level, 'Form 4 B');
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
    structureYear($school);
    $form4 = structureLevel($school);
    $form5 = structureLevel($school, ['name' => 'Form 5', 'code' => 'F5', 'ordinal' => 5]);
    $physics = structureSubject($school, 'PHY', 'Physics');
    $chemistry = structureSubject($school, 'CHE', 'Chemistry');
    $biology = structureSubject($school, 'BIO', 'Biology');

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
        ->toBe(['Form 2 A', 'Form 2 B'])
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
    structureYear($school);
    $level = structureLevel($school);
    $biology = structureSubject($school, 'BIO', 'Biology');
    $physics = structureSubject($school, 'PHY', 'Physics');
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
