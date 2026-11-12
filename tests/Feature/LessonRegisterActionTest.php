<?php

use App\Actions\Attendance\SaveLessonRegister;
use App\Enums\AcademicYearStatus;
use App\Enums\AttendanceStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\TimetableStatus;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Attendance;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Level;
use App\Models\Period;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\TimetableChange;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Tuesday 7 October 2025, 10:28 in Douala. A class of two, a lesson
 * that started at 08:00 (`first`), one that starts at 10:40 (`later`)
 * and one on Wednesday (`wednesday`), all taught by `teacher`.
 *
 * @return array{school: School, teacher: User, version: TimetableVersion, class: SchoolClass, first: TimetableSlot, later: TimetableSlot, wednesday: TimetableSlot, achu: Student, bih: Student}
 */
function registerWorld(string $slug = 'register'): array
{
    test()->travelTo('2025-10-07 09:28:00');

    $school = School::create([
        'name' => 'Register Academy '.$slug, 'code' => 'RGA', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $teacher = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Teacher]);
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
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id,
        'name' => 'Form 5 A', 'capacity' => 45,
    ]);
    $subject = Subject::create([
        'school_id' => $school->id, 'code' => 'MAT', 'name' => 'Mathematics',
        'department' => 'Sciences', 'weekly_periods' => 5, 'coefficient' => 4,
    ]);
    $students = [];

    foreach (['Achu Brandon', 'Bih Glory'] as $index => $name) {
        $students[] = $student = Student::create([
            'school_id' => $school->id, 'admission_no' => 'RGA-25-000'.($index + 1),
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
    $slots = [];

    foreach (['first' => ['P1', '08:00', '08:45', 1], 'later' => ['P3', '10:40', '11:25', 1], 'wednesday' => ['P1', '08:00', '08:45', 2]] as $key => [$label, $from, $to, $weekday]) {
        $period = Period::firstOrCreate(
            ['school_id' => $school->id, 'label' => $label],
            ['ordinal' => count($slots) + 1, 'starts_at' => $from, 'ends_at' => $to, 'is_break' => false],
        );
        $slots[$key] = TimetableSlot::create([
            'school_id' => $school->id, 'term_id' => $term->id, 'timetable_version_id' => $version->id,
            'school_class_id' => $class->id, 'period_id' => $period->id, 'subject_id' => $subject->id,
            'staff_id' => $teacher->id, 'weekday' => $weekday,
        ]);
    }

    [$achu, $bih] = $students;

    return [...compact('school', 'teacher', 'version', 'class', 'achu', 'bih'), ...$slots];
}

/**
 * @param  array<string, mixed>  $world
 * @param  list<array{student_id: string, status: string, note?: string|null}>|null  $marks
 */
function saveRegister(array $world, ?TimetableSlot $lesson = null, ?array $marks = null, ?User $teacher = null, ?string $date = null): mixed
{
    return app(SaveLessonRegister::class)->handle(
        $world['school'],
        $teacher ?? $world['teacher'],
        $lesson ?? $world['first'],
        Carbon::parse($date ?? '2025-10-07', $world['school']->timezone),
        $marks ?? [
            ['student_id' => $world['achu']->id, 'status' => 'present'],
            ['student_id' => $world['bih']->id, 'status' => 'late', 'note' => '  Arrived 08:20  '],
        ],
    );
}

/**
 * @return array<string, string>
 */
function registerErrors(Closure $save): array
{
    try {
        $save();
    } catch (ValidationException $exception) {
        return array_map(fn (array $messages) => $messages[0], $exception->errors());
    }

    throw new RuntimeException('The register was saved.');
}

test('a register saves without request state and saving again updates it in place', function () {
    $world = registerWorld();

    $register = saveRegister($world);

    expect($register)->toHaveCount(2)
        ->and(Attendance::where('student_id', $world['bih']->id)->sole())
        ->status->toBe(AttendanceStatus::Late)
        ->note->toBe('Arrived 08:20')
        ->marked_by->toBe($world['teacher']->id)
        ->and(AuditEvent::sole())
        ->action->toBe('register_saved')
        ->actor_id->toBe($world['teacher']->id)
        ->diff->toBe(['date' => '2025-10-07', 'counts' => ['present' => 1, 'late' => 1]]);

    saveRegister($world, marks: [
        ['student_id' => $world['achu']->id, 'status' => 'absent'],
        ['student_id' => $world['bih']->id, 'status' => 'present', 'note' => ' '],
    ]);

    expect(Attendance::count())->toBe(2)
        ->and(Attendance::where('student_id', $world['achu']->id)->sole()->status)->toBe(AttendanceStatus::Absent)
        ->and(Attendance::where('student_id', $world['bih']->id)->sole()->note)->toBeNull()
        ->and(AuditEvent::pluck('action')->sort()->values()->all())->toBe(['register_changed', 'register_saved']);
});

test('only the teacher of the lesson, or her cover for the day, saves its register', function () {
    $world = registerWorld();
    $cover = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);
    $marks = [['student_id' => $world['achu']->id, 'status' => 'present'], ['student_id' => $world['bih']->id, 'status' => 'present']];

    expect(registerErrors(fn () => saveRegister($world, marks: $marks, teacher: $cover)))
        ->toBe(['marks' => 'That is not one of your lessons today.'])
        ->and(registerErrors(fn () => saveRegister($world, $world['wednesday'], $marks)))
        ->toBe(['marks' => 'That is not one of your lessons today.']);

    $change = fn (string $from, string $to) => TimetableChange::create([
        'school_id' => $world['school']->id, 'timetable_version_id' => $world['version']->id, 'kind' => 'cover',
        'starts_on' => $from, 'ends_on' => $to, 'timetable_slot_id' => $world['first']->id,
        'staff_id' => $cover->id, 'summary' => 'Cover',
    ]);

    $change('2025-09-30', '2025-10-06');

    expect(registerErrors(fn () => saveRegister($world, marks: $marks, teacher: $cover)))
        ->toBe(['marks' => 'That is not one of your lessons today.']);

    $change('2025-10-07', '2025-10-07');

    saveRegister($world, marks: $marks, teacher: $cover);

    expect(Attendance::pluck('marked_by')->unique()->all())->toBe([$cover->id]);

    $world['version']->update(['status' => TimetableStatus::Archived]);

    expect(registerErrors(fn () => saveRegister($world, marks: $marks)))
        ->toBe(['marks' => 'That is not one of your lessons today.']);
});

test('a register opens when the lesson starts and only on its day', function () {
    $world = registerWorld();

    expect(registerErrors(fn () => saveRegister($world, $world['later'])))
        ->toBe(['marks' => 'This lesson has not started. Its register opens at 10:40.'])
        ->and(registerErrors(fn () => saveRegister($world, date: '2025-10-06')))
        ->toBe(['marks' => 'A register can only be saved on the day of the lesson.'])
        ->and(registerErrors(fn () => saveRegister($world, date: '2025-10-14')))
        ->toBe(['marks' => 'A register can only be saved on the day of the lesson.']);

    $this->travelTo('2025-10-07 09:40:00');
    saveRegister($world, $world['later']);

    expect(Attendance::where('timetable_slot_id', $world['later']->id)->count())->toBe(2);
});

test('every student of the class is marked once, and no one else', function () {
    $world = registerWorld();
    $other = registerWorld('register-other');
    $achu = ['student_id' => $world['achu']->id, 'status' => 'present'];
    $bih = ['student_id' => $world['bih']->id, 'status' => 'present'];

    expect(registerErrors(fn () => saveRegister($world, marks: [$achu])))
        ->toBe(['marks' => 'Mark the last student before saving.'])
        ->and(registerErrors(fn () => saveRegister($world, marks: [])))
        ->toBe(['marks' => 'Mark the last 2 students before saving.'])
        ->and(registerErrors(fn () => saveRegister($world, marks: [$achu, $achu, $bih])))
        ->toHaveKey('marks.1.student_id')
        ->and(registerErrors(fn () => saveRegister($world, marks: [$achu, $bih, ['student_id' => $other['achu']->id, 'status' => 'present']])))
        ->toHaveKey('marks.2.student_id')
        ->and(registerErrors(fn () => saveRegister($world, marks: [$achu, [...$bih, 'status' => 'excused']])))
        ->toHaveKey('marks.1.status');

    Enrolment::where('student_id', $world['bih']->id)->update(['status' => EnrolmentStatus::Left]);
    saveRegister($world, marks: [$achu]);

    expect(Attendance::count())->toBe(1);
});

test('an absence the office excused stays excused when it is marked absent again', function () {
    $world = registerWorld();
    $marks = fn (string $achu) => [['student_id' => $world['achu']->id, 'status' => $achu], ['student_id' => $world['bih']->id, 'status' => 'present']];

    saveRegister($world, marks: $marks('absent'));
    $record = Attendance::where('student_id', $world['achu']->id)->sole();
    $record->update(['status' => AttendanceStatus::Excused, 'note' => 'Sick']);

    saveRegister($world, marks: $marks('absent'));

    expect($record->refresh())->status->toBe(AttendanceStatus::Excused)->note->toBe('Sick');

    saveRegister($world, marks: $marks('present'));

    expect($record->refresh())->status->toBe(AttendanceStatus::Present)->note->toBeNull();
});

test('register writes roll back when the audit event cannot be written', function () {
    $world = registerWorld();
    AuditEvent::creating(fn () => throw new RuntimeException('Audit is down.'));

    expect(fn () => saveRegister($world))->toThrow(RuntimeException::class, 'Audit is down.')
        ->and(Attendance::count())->toBe(0);
});

test('a register stays inside its school', function () {
    $world = registerWorld();
    $other = registerWorld('register-other');
    $marks = [['student_id' => $other['achu']->id, 'status' => 'present'], ['student_id' => $other['bih']->id, 'status' => 'present']];

    expect(fn () => saveRegister($world, $other['first'], $marks))
        ->toThrow(InvalidArgumentException::class, 'The lesson must belong to the school.')
        ->and(registerErrors(fn () => saveRegister($other, marks: $marks, teacher: $world['teacher'])))
        ->toBe(['marks' => 'That is not one of your lessons today.']);

    $this->actingAs($world['teacher'])
        ->post("http://register.ekol.test/attendance/{$other['first']->id}", ['marks' => $marks])
        ->assertSessionHasErrors(['marks' => 'That is not one of your lessons today.']);
    $this->actingAs($world['teacher'])
        ->post('http://register.ekol.test/attendance/not-a-lesson', ['marks' => $marks])
        ->assertSessionHasErrors(['marks' => 'That is not one of your lessons today.']);

    expect(Attendance::count())->toBe(0);
});
