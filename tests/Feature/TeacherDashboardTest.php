<?php

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\TimetableStatus;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\Period;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Tuesday 7 October 2025, 10:28 in Douala: a Mathematics teacher with
 * two lessons today in a class of two, on a published timetable, and
 * one mark sheet open.
 *
 * @return array<string, mixed>
 */
function teacherWorld(): array
{
    test()->travelTo('2025-10-07 09:28:00');

    $school = School::create([
        'name' => 'Academy teacha', 'code' => 'GBHS', 'slug' => 'teacha',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala', 'school_days' => 31,
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $teacher = User::factory()->create([
        'school_id' => $school->id, 'role' => UserRole::Teacher,
        'full_name' => 'Peter Tanjong', 'family_name' => 'Tanjong', 'given_name' => 'Peter', 'gender' => 'male',
    ]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19', 'week_count' => 16, 'is_current' => true,
    ]);
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 5', 'code' => 'F5', 'ordinal' => 5,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    $room = Room::create(['school_id' => $school->id, 'code' => '12', 'name' => '12', 'capacity' => 45, 'kind' => 'classroom']);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id,
        'name' => 'Form 5 A', 'capacity' => 45, 'home_room_id' => $room->id,
    ]);
    $subject = Subject::create([
        'school_id' => $school->id, 'code' => 'MAT', 'name' => 'Mathematics',
        'department' => 'Sciences', 'weekly_periods' => 5, 'coefficient' => 4,
    ]);
    ClassSubject::create([
        'school_id' => $school->id, 'school_class_id' => $class->id,
        'subject_id' => $subject->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5,
    ]);

    foreach (['Achu Brandon', 'Bih Glory'] as $index => $name) {
        $student = Student::create([
            'school_id' => $school->id, 'admission_no' => 'GBHS-25-000'.($index + 1),
            'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2010-01-01',
            'guardian_name' => 'G', 'guardian_phone' => '+23767000000'.$index, 'admitted_on' => '2025-09-01',
        ]);
        Enrolment::create([
            'student_id' => $student->id, 'academic_year_id' => $year->id,
            'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled,
        ]);
    }

    $version = TimetableVersion::create([
        'school_id' => $school->id, 'term_id' => $term->id, 'number' => 1, 'status' => TimetableStatus::Live,
    ]);

    foreach ([['P1', '08:00', '08:45', 1], ['P3', '10:40', '11:25', 1], ['P1', '08:00', '08:45', 2]] as $index => [$label, $from, $to, $weekday]) {
        $period = Period::firstOrCreate(
            ['school_id' => $school->id, 'label' => $label],
            ['ordinal' => $index + 1, 'starts_at' => $from, 'ends_at' => $to, 'is_break' => false],
        );
        TimetableSlot::create([
            'school_id' => $school->id, 'term_id' => $term->id, 'timetable_version_id' => $version->id,
            'school_class_id' => $class->id, 'period_id' => $period->id, 'subject_id' => $subject->id,
            'staff_id' => $teacher->id, 'room_id' => $room->id, 'weekday' => $weekday,
        ]);
    }

    return compact('school', 'admin', 'teacher', 'term', 'level', 'class', 'subject');
}

test('a teacher lands on her day, with the next lesson and open mark sheets', function () {
    $world = teacherWorld();

    $this->actingAs($world['admin'])
        ->post('http://teacha.ekol.test/assessments', [
            'name' => 'Sequence 1', 'kind' => 'sequence', 'term_id' => $world['term']->id,
            'held_from' => '2025-09-29', 'held_until' => '2025-10-03',
            'window_starts_on' => '2025-09-29', 'window_ends_on' => '2025-10-08',
            'level_ids' => [$world['level']->id], 'schedule' => true,
        ])
        ->assertSessionHasNoErrors();

    expect(AssessmentPlan::count())->toBe(1);

    $this->actingAs($world['teacher'])
        ->get('http://teacha.ekol.test/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teacher/today')
            ->where('shellUser.portal', 'teacher')
            ->where('date', 'Tuesday 7 October')
            ->where('greeting', 'Good morning')
            ->where('name', 'Mr. Tanjong')
            ->where('hasTimetable', true)
            ->has('lessons', 2)
            ->where('lessons.0.state', 'done')
            ->where('lessons.1.state', 'next')
            ->where('next.class', 'Form 5 A')
            ->where('next.subject', 'Mathematics')
            ->where('next.room', '12')
            ->where('next.students', 2)
            ->where('next.in_minutes', 12)
            ->where('next.starts_at', '10:40')
            ->where('openSheets', 1)
            ->where('closesOn', '2025-10-08')
            ->where('sheets.0.plan', 'Sequence 1')
            ->where('sheets.0.entered', 0)
            ->where('sheets.0.students', 2));
});

test('the day is empty but friendly without a published timetable', function () {
    $world = teacherWorld();
    TimetableVersion::query()->update(['status' => TimetableStatus::Draft]);

    $this->actingAs($world['teacher'])
        ->get('http://teacha.ekol.test/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teacher/today')
            ->where('hasTimetable', false)
            ->where('lessons', [])
            ->where('next', null)
            ->where('sheets', []));
});

test('administrators keep the school dashboard and teacher placeholders render', function () {
    $world = teacherWorld();

    $this->actingAs($world['admin'])
        ->get('http://teacha.ekol.test/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('dashboard')->where('shellUser.portal', 'admin'));

    foreach (['/attendance', '/teaching-log', '/lesson-notes', '/question-bank'] as $uri) {
        $this->actingAs($world['teacher'])
            ->get("http://teacha.ekol.test{$uri}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('shell/stub'));
    }
});

test('my timetable shows the week from the live version with the summary', function () {
    $world = teacherWorld();

    $this->actingAs($world['teacher'])
        ->get('http://teacha.ekol.test/my-timetable')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teacher/timetable')
            ->where('week.number', 6)
            ->where('week.start', '2025-10-06')
            ->where('week.label', 'Mon 6 – Fri 10 October')
            ->where('week.isCurrent', true)
            ->where('week.previous', '2025-09-29')
            ->where('version.number', 1)
            ->where('summary.periods', 3)
            ->where('summary.classes', 1)
            ->where('summary.subjects', 1)
            ->where('summary.free', 7)
            ->has('days', 5)
            ->where('days.1.today', true)
            ->has('periods', 2)
            ->has('cells', 3));

    $this->actingAs($world['teacher'])
        ->get('http://teacha.ekol.test/my-timetable?week=2024-01-01')
        ->assertInertia(fn (Assert $page) => $page->where('week.number', 1)->where('week.previous', null));
});

test('logged changes show on the week they apply to', function () {
    $world = teacherWorld();
    $live = TimetableVersion::firstOrFail();
    $cover = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher, 'full_name' => 'Grace Tebo']);
    $slot = TimetableSlot::where('weekday', 2)->firstOrFail();
    $newRoom = Room::create(['school_id' => $world['school']->id, 'code' => 'Lab 1', 'name' => 'Lab 1', 'capacity' => 30, 'kind' => 'laboratory']);
    $tuesday = TimetableSlot::where('weekday', 1)->orderBy('id')->firstOrFail();

    $this->actingAs($world['admin'])->post('http://teacha.ekol.test/timetable/changes', [
        'kind' => 'cover', 'date' => '2025-10-08', 'covers' => [['slot_id' => $slot->id, 'staff_id' => $cover->id]],
    ])->assertSessionHasNoErrors();
    $this->actingAs($world['admin'])->post('http://teacha.ekol.test/timetable/changes', [
        'kind' => 'room', 'date' => '2025-10-07', 'slot_id' => $tuesday->id, 'room_id' => $newRoom->id,
    ])->assertSessionHasNoErrors();

    $key = "2|{$slot->period_id}";

    $this->actingAs($world['teacher'])
        ->get('http://teacha.ekol.test/my-timetable')
        ->assertInertia(fn (Assert $page) => $page
            ->where("cells.{$key}.0.tone", 'away')
            ->where("cells.{$key}.0.note", 'Covered by Grace Tebo')
            ->where("cells.1|{$tuesday->period_id}.0.room", 'Lab 1')
            ->where("cells.1|{$tuesday->period_id}.0.note", 'Room changed'));

    $this->actingAs($cover)
        ->get('http://teacha.ekol.test/my-timetable')
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.periods', 0)
            ->where("cells.{$key}.0.tone", 'cover')
            ->where("cells.{$key}.0.note", 'Cover for Peter Tanjong'));

    $this->actingAs($world['teacher'])
        ->get('http://teacha.ekol.test/my-timetable?week=2025-10-13')
        ->assertInertia(fn (Assert $page) => $page->where("cells.{$key}.0.tone", 'lesson')->where("cells.{$key}.0.note", null));

    expect($live->changes()->count())->toBe(2);
});

test('my timetable explains itself when nothing is published', function () {
    $world = teacherWorld();
    TimetableVersion::query()->update(['status' => TimetableStatus::Draft]);

    $this->actingAs($world['teacher'])
        ->get('http://teacha.ekol.test/my-timetable')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('teacher/timetable')->where('week', null)->where('termLabel', 'Term 1'));
});
