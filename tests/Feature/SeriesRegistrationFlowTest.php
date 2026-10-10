<?php

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A series level with one class, two series over five subjects, and
 * three enrolled students.
 *
 * @return array<string, mixed>
 */
function seriesWorld(string $slug = 'seriesa'): array
{
    $school = School::create([
        'name' => "Academy {$slug}", 'code' => 'GBHS', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
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
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 4 A', 'capacity' => 45,
    ]);

    $subjects = [];

    foreach (['Physics', 'Chemistry', 'Biology', 'History', 'Geography'] as $name) {
        $subjects[$name] = Subject::create([
            'school_id' => $school->id, 'code' => strtoupper(substr($name, 0, 3)), 'name' => $name,
            'department' => 'General', 'weekly_periods' => 4,
        ]);
    }

    $science = Series::create([
        'school_id' => $school->id, 'level_id' => $level->id, 'code' => 'S1',
        'name' => 'Science 1', 'stream' => 'science', 'min_subjects' => 2, 'max_subjects' => 3,
    ]);
    $science->subjects()->sync([
        $subjects['Physics']->id => ['kind' => 'core'],
        $subjects['Chemistry']->id => ['kind' => 'elective'],
        $subjects['Biology']->id => ['kind' => 'elective'],
        $subjects['Geography']->id => ['kind' => 'elective'],
    ]);
    $arts = Series::create([
        'school_id' => $school->id, 'level_id' => $level->id, 'code' => 'A1',
        'name' => 'Arts 1', 'stream' => 'arts', 'min_subjects' => 1, 'max_subjects' => 4,
    ]);
    $arts->subjects()->sync([
        $subjects['History']->id => ['kind' => 'core'],
        $subjects['Geography']->id => ['kind' => 'elective'],
        $subjects['Biology']->id => ['kind' => 'elective'],
    ]);

    $students = [];

    foreach (['Achu Brandon', 'Bih Glory', 'Che Emmanuel'] as $index => $name) {
        $students[] = $student = Student::create([
            'school_id' => $school->id, 'admission_no' => 'GBHS-25-000'.($index + 1),
            'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2010-01-01',
            'guardian_name' => 'G', 'guardian_phone' => '+23760000000'.$index, 'admitted_on' => '2025-09-01',
        ]);
        Enrolment::create([
            'student_id' => $student->id, 'academic_year_id' => $year->id,
            'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled,
        ]);
    }

    return compact('school', 'admin', 'year', 'term', 'level', 'class', 'subjects', 'science', 'arts', 'students');
}

test('registering one student stores the series and electives and moves to the next', function () {
    $world = seriesWorld();
    [$achu, $bih] = $world['students'];

    $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/register', [
            'student_id' => $achu->id,
            'series_id' => $world['science']->id,
            'electives' => [$world['subjects']['Chemistry']->id],
            'next_id' => $bih->id,
        ])
        ->assertRedirect(route('series.one', ['level' => $world['level']->id, 'student' => $bih->id]))
        ->assertSessionHasNoErrors();

    $registration = StudentSeries::where('student_id', $achu->id)->firstOrFail();

    expect($registration->series_id)->toBe($world['science']->id)
        ->and($registration->term_id)->toBe($world['term']->id)
        ->and($registration->electives()->pluck('subjects.name')->all())->toBe(['Chemistry'])
        ->and($registration->chosen_by)->toBe($world['admin']->id);
});

test('electives must come from the pool and stay within the minimum and maximum', function () {
    $world = seriesWorld();
    [$achu] = $world['students'];
    $post = fn (array $electives) => $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/register', [
            'student_id' => $achu->id,
            'series_id' => $world['science']->id,
            'electives' => $electives,
        ]);

    $post([])->assertSessionHasErrors('electives');
    $post([$world['subjects']['History']->id])->assertSessionHasErrors('electives');
    $post([
        $world['subjects']['Chemistry']->id,
        $world['subjects']['Biology']->id,
        $world['subjects']['Geography']->id,
    ])->assertSessionHasErrors('electives');

    expect(StudentSeries::count())->toBe(0);

    $empty = Series::create([
        'school_id' => $world['school']->id, 'level_id' => $world['level']->id,
        'code' => 'A3', 'name' => 'Arts 3', 'stream' => 'arts',
    ]);

    $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/register', [
            'student_id' => $achu->id, 'series_id' => $empty->id, 'electives' => [],
        ])
        ->assertSessionHasErrors('series_id');
});

test('several students are registered at once and leave the queue', function () {
    $world = seriesWorld();
    [$achu, $bih, $che] = $world['students'];

    $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/bulk', [
            'student_ids' => [$achu->id, $bih->id],
            'series_id' => $world['arts']->id,
            'electives' => [$world['subjects']['Geography']->id],
        ])
        ->assertRedirect(route('series', ['level' => $world['level']->id]))
        ->assertSessionHasNoErrors();

    expect(StudentSeries::where('series_id', $world['arts']->id)->count())->toBe(2);

    $this->actingAs($world['admin'])
        ->get('http://seriesa.ekol.test/series')
        ->assertInertia(fn (Assert $page) => $page
            ->component('series/overview')
            ->where('levels.0.total', 3)
            ->where('levels.0.registered', 2)
            ->where('unassigned.total', 1)
            ->where('unassigned.preview.0.name', $che->full_name)
            ->where('series.0.code', 'A1')
            ->where('series.0.students', 2)
            ->where('series.0.core', ['History']));

    $this->actingAs($world['admin'])
        ->get('http://seriesa.ekol.test/series/bulk')
        ->assertInertia(fn (Assert $page) => $page
            ->component('series/bulk')
            ->has('students', 1));
});

test('the overview warns about chosen subjects with no teacher in the class', function () {
    $world = seriesWorld();
    [$achu] = $world['students'];
    ClassSubject::create([
        'school_id' => $world['school']->id, 'school_class_id' => $world['class']->id,
        'subject_id' => $world['subjects']['Physics']->id, 'staff_id' => $world['admin']->id,
        'weekly_periods' => 4,
    ]);

    $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/register', [
            'student_id' => $achu->id,
            'series_id' => $world['science']->id,
            'electives' => [$world['subjects']['Chemistry']->id],
        ]);

    $this->actingAs($world['admin'])
        ->get('http://seriesa.ekol.test/series')
        ->assertInertia(fn (Assert $page) => $page
            ->has('unstaffed', 1)
            ->where('unstaffed.0.name', 'Chemistry')
            ->where('unstaffed.0.students', 1));

    $this->actingAs($world['admin'])
        ->get("http://seriesa.ekol.test/series/register?student={$achu->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('series/register')
            ->where('tab', 'registered')
            ->where('student.series_id', $world['science']->id)
            ->where('student.electives', [$world['subjects']['Chemistry']->id])
            ->where('teachers.'.$world['subjects']['Physics']->id, $world['admin']->full_name));
});

test('changing series keeps what the new pool offers and needs a parent to agree', function () {
    $world = seriesWorld();
    [$achu] = $world['students'];

    $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/register', [
            'student_id' => $achu->id,
            'series_id' => $world['science']->id,
            'electives' => [$world['subjects']['Geography']->id, $world['subjects']['Chemistry']->id],
        ]);

    $change = fn (array $overrides = []) => $this->actingAs($world['admin'])
        ->post("http://seriesa.ekol.test/series/students/{$achu->id}/change", array_merge([
            'series_id' => $world['arts']->id,
            'reason' => "Student's request",
            'note' => 'Wants to focus on humanities.',
            'parent_agreed' => true,
        ], $overrides));

    $change(['parent_agreed' => false])->assertSessionHasErrors('parent_agreed');
    $change(['series_id' => $world['science']->id])->assertSessionHasErrors('series_id');

    $change()->assertRedirect(route('students.show', $achu->id))->assertSessionHasNoErrors();

    $registration = StudentSeries::where('student_id', $achu->id)->firstOrFail();

    expect($registration->series_id)->toBe($world['arts']->id)
        ->and($registration->change_reason)->toBe("Student's request")
        ->and($registration->parent_agreed)->toBeTrue()
        ->and($registration->electives()->pluck('subjects.name')->all())->toBe(['Geography'])
        ->and(AuditEvent::where('action', 'series_changed')->where('entity_id', $achu->id)->count())->toBe(1);
});

test('a student with no series is sent to register, and outsiders are refused', function () {
    $world = seriesWorld();
    $other = seriesWorld('otherser');
    [$achu] = $world['students'];
    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);

    $this->actingAs($world['admin'])
        ->get("http://seriesa.ekol.test/series/students/{$achu->id}/change")
        ->assertRedirect(route('series.one', ['student' => $achu->id]));

    $this->actingAs($teacher)->get('http://seriesa.ekol.test/series')->assertForbidden();

    $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/register', [
            'student_id' => $other['students'][0]->id,
            'series_id' => $world['science']->id,
            'electives' => [$world['subjects']['Chemistry']->id],
        ])
        ->assertSessionHasErrors('series_id');

    $this->actingAs($world['admin'])
        ->post('http://seriesa.ekol.test/series/register', [
            'student_id' => $achu->id,
            'series_id' => $other['science']->id,
            'electives' => [],
        ])
        ->assertSessionHasErrors('series_id');

    expect(StudentSeries::count())->toBe(0);
});

test('opening a student without naming the level lands on their level', function () {
    $world = seriesWorld();
    $lower = Level::create([
        'school_id' => $world['school']->id, 'name' => 'Aaa Lower Sixth', 'code' => 'L6', 'ordinal' => 1,
        'cycle' => SchoolCycle::HighSchool, 'subsystem' => 'anglophone', 'uses_series' => true,
    ]);
    [$achu] = $world['students'];

    $this->actingAs($world['admin'])
        ->get("http://seriesa.ekol.test/series/register?student={$achu->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('level.id', $world['level']->id)
            ->where('student.id', $achu->id)
            ->where('tab', 'unassigned'));

    expect($lower->ordinal)->toBeLessThan($world['level']->ordinal);
});
