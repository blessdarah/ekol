<?php

use App\Actions\Assessments\SaveMarkSheet;
use App\Enums\AcademicYearStatus;
use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\GradeBand;
use App\Models\Level;
use App\Models\Mark;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * An open Mathematics sheet marked out of 40 for a class of three, in
 * a school whose own scale has an A from 80% and an F below it.
 *
 * @return array{school: School, plan: AssessmentPlan, sheet: AssessmentSubject, teacher: User, students: list<Student>, bands: array<string, GradeBand>}
 */
function markSheetWorld(string $slug = 'marks-action'): array
{
    test()->travelTo('2025-10-01 09:00:00');

    $school = School::create([
        'name' => "Marks {$slug}", 'code' => 'MKA', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
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
        'school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 1 A', 'capacity' => 40,
    ]);
    $teacher = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Teacher]);
    $subject = Subject::create([
        'school_id' => $school->id, 'code' => 'MAT', 'name' => 'Mathematics',
        'department' => 'General', 'weekly_periods' => 4, 'coefficient' => 4,
    ]);
    ClassSubject::create([
        'school_id' => $school->id, 'school_class_id' => $class->id,
        'subject_id' => $subject->id, 'staff_id' => $teacher->id, 'weekly_periods' => 4,
    ]);

    $students = [];

    foreach (['Achu Brandon', 'Bih Glory', 'Che Emmanuel'] as $index => $name) {
        $students[] = $student = Student::create([
            'school_id' => $school->id, 'admission_no' => "{$slug}-{$index}",
            'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2013-01-01',
            'guardian_name' => 'G', 'guardian_phone' => '+23767000000'.$index, 'admitted_on' => '2025-09-01',
        ]);
        Enrolment::create([
            'student_id' => $student->id, 'academic_year_id' => $year->id,
            'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled,
        ]);
    }

    $bands = [
        'A' => GradeBand::create(['school_id' => $school->id, 'letter' => 'A', 'from_percent' => 80, 'to_percent' => 100, 'meaning' => 'Excellent', 'standard_remark' => 'Keep it up.', 'rank_order' => 1]),
        'F' => GradeBand::create(['school_id' => $school->id, 'letter' => 'F', 'from_percent' => 0, 'to_percent' => 79.99, 'meaning' => 'Weak', 'standard_remark' => 'Work harder.', 'rank_order' => 2]),
    ];

    $plan = AssessmentPlan::create([
        'school_id' => $school->id, 'term_id' => $term->id, 'kind' => 'sequence', 'name' => 'Sequence 1',
        'state' => AssessmentState::Scheduled, 'held_from' => '2025-09-15', 'held_until' => '2025-09-26',
        'window_starts_on' => '2025-09-15', 'window_ends_on' => '2025-10-08', 'level_ids' => [$level->id],
    ])->refreshState();
    $sheet = AssessmentSubject::whereHas('assessment', fn ($query) => $query->where('assessment_plan_id', $plan->id))->firstOrFail();
    $sheet->update(['max_score' => 40]);

    return ['school' => $school, 'plan' => $plan, 'sheet' => $sheet->refresh(), 'teacher' => $teacher, 'students' => $students, 'bands' => $bands];
}

/**
 * @param  list<Student>  $students
 * @param  array<int, array{score?: float|int|string|null, absent?: bool, remark?: string|null}>  $rows
 * @return list<array{student_id: string, score: float|int|string|null, absent: bool, remark: string|null}>
 */
function markRows(array $students, array $rows): array
{
    return array_map(fn (int $index) => [
        'student_id' => $students[$index]->id,
        'score' => $rows[$index]['score'] ?? null,
        'absent' => $rows[$index]['absent'] ?? false,
        'remark' => $rows[$index]['remark'] ?? null,
    ], array_keys($rows));
}

test('a draft save keeps empty marks and records rounded scores, bands, absences and remarks', function () {
    $world = markSheetWorld();

    app(SaveMarkSheet::class)->handle($world['school'], $world['sheet'], $world['teacher'], [
        'marks' => markRows($world['students'], [
            0 => ['score' => '34.456', 'remark' => '  Well done  '],
            1 => ['score' => 30, 'remark' => '   '],
            2 => ['score' => 12, 'absent' => true],
        ]),
    ]);

    $marks = Mark::where('assessment_subject_id', $world['sheet']->id)->get()->keyBy('student_id');
    $first = $marks->get($world['students'][0]->id);
    $second = $marks->get($world['students'][1]->id);
    $absent = $marks->get($world['students'][2]->id);

    expect((float) $first->score)->toBe(34.46)
        ->and($first->grade_band_id)->toBe($world['bands']['A']->id)
        ->and($first->remark)->toBe('Well done')
        ->and($first->entered_by)->toBe($world['teacher']->id)
        ->and($first->entered_at->toDateTimeString())->toBe('2025-10-01 09:00:00')
        ->and($second->grade_band_id)->toBe($world['bands']['F']->id)
        ->and($second->remark)->toBeNull()
        ->and($absent->score)->toBeNull()
        ->and($absent->is_absent)->toBeTrue()
        ->and($absent->grade_band_id)->toBeNull()
        ->and($world['sheet']->refresh()->submitted_at)->toBeNull();

    $this->assertDatabaseHas('audit_events', [
        'school_id' => $world['school']->id, 'actor_id' => $world['teacher']->id,
        'entity' => 'assessment_subject', 'entity_id' => $world['sheet']->id, 'action' => 'marks_saved',
    ]);
});

test('a draft save can leave students out entirely', function () {
    $world = markSheetWorld();

    app(SaveMarkSheet::class)->handle($world['school'], $world['sheet'], $world['teacher'], [
        'marks' => markRows($world['students'], [0 => ['score' => 20]]),
        'submit' => false,
    ]);

    expect(Mark::where('assessment_subject_id', $world['sheet']->id)->count())->toBe(1);
});

test('submitting needs a mark or absence for every student and writes nothing otherwise', function () {
    $world = markSheetWorld();

    expect(fn () => app(SaveMarkSheet::class)->handle($world['school'], $world['sheet'], $world['teacher'], [
        'marks' => markRows($world['students'], [0 => ['score' => 20], 1 => ['score' => null]]),
        'submit' => true,
    ]))->toThrow(ValidationException::class, 'Fill 2 empty marks before submitting, or mark the student absent.');

    expect($world['sheet']->refresh()->submitted_at)->toBeNull();
    $this->assertDatabaseCount('marks', 0);
    $this->assertDatabaseCount('audit_events', 0);
});

test('a complete sheet is handed in with its submitter', function () {
    $world = markSheetWorld();

    app(SaveMarkSheet::class)->handle($world['school'], $world['sheet'], $world['teacher'], [
        'marks' => markRows($world['students'], [0 => ['score' => 20], 1 => ['score' => 0], 2 => ['absent' => true]]),
        'submit' => true,
    ]);

    $sheet = $world['sheet']->refresh();

    expect($sheet->submitted_at->toDateTimeString())->toBe('2025-10-01 09:00:00')
        ->and($sheet->submitted_by)->toBe($world['teacher']->id);
    $this->assertDatabaseCount('marks', 3);
    $this->assertDatabaseHas('audit_events', ['entity_id' => $sheet->id, 'action' => 'marks_submitted']);
});

test('marks cannot change once the window is shut', function (Closure $shut, string $message) {
    $world = markSheetWorld();
    $shut($world['plan']);

    expect(fn () => app(SaveMarkSheet::class)->handle($world['school'], $world['sheet'], $world['teacher'], [
        'marks' => markRows($world['students'], [0 => ['score' => 20]]),
    ]))->toThrow(ValidationException::class, $message);

    $this->assertDatabaseCount('marks', 0);
    $this->assertDatabaseCount('audit_events', 0);
})->with([
    'closed' => [fn (AssessmentPlan $plan) => $plan->moveTo(AssessmentState::MarksClosed), 'Marks entry is closed for this assessment.'],
    'published' => [fn (AssessmentPlan $plan) => $plan->moveTo(AssessmentState::Published), 'These results are published. Ask for a correction instead.'],
    'window ended' => [fn () => test()->travelTo('2025-10-09 09:00:00'), 'The marks window ended on 8 Oct. Ask the school to extend it.'],
]);

test('a sheet from another school is rejected before writing', function () {
    $world = markSheetWorld();
    $other = School::create([
        'name' => 'Other school', 'code' => 'OTH', 'slug' => 'other-marks',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);

    expect(fn () => app(SaveMarkSheet::class)->handle($other, $world['sheet'], $world['teacher'], [
        'marks' => markRows($world['students'], [0 => ['score' => 20]]),
    ]))->toThrow(InvalidArgumentException::class);

    $this->assertDatabaseCount('marks', 0);
});

test('a student outside the class is rejected before writing', function () {
    $world = markSheetWorld();
    $outsider = markSheetWorld('marks-elsewhere')['students'][0];

    expect(fn () => app(SaveMarkSheet::class)->handle($world['school'], $world['sheet'], $world['teacher'], [
        'marks' => markRows([$outsider], [0 => ['score' => 20]]),
    ]))->toThrow(InvalidArgumentException::class);

    $this->assertDatabaseCount('marks', 0);
});

test('marks and the hand-in roll back when the audit event fails', function () {
    $world = markSheetWorld();
    AuditEvent::creating(fn () => throw new RuntimeException('Audit store unavailable.'));

    expect(fn () => app(SaveMarkSheet::class)->handle($world['school'], $world['sheet'], $world['teacher'], [
        'marks' => markRows($world['students'], [0 => ['score' => 20], 1 => ['score' => 10], 2 => ['absent' => true]]),
        'submit' => true,
    ]))->toThrow(RuntimeException::class, 'Audit store unavailable.');

    expect($world['sheet']->refresh()->submitted_at)->toBeNull();
    $this->assertDatabaseCount('marks', 0);
});
