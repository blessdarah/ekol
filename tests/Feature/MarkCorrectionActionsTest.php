<?php

use App\Actions\Assessments\DecideMarkCorrection;
use App\Actions\Assessments\RequestMarkCorrection;
use App\Enums\AcademicYearStatus;
use App\Enums\AssessmentState;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\Coefficient;
use App\Models\Level;
use App\Models\Mark;
use App\Models\MarkCorrection;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * One published English sheet out of 20 with a single mark of 10.
 *
 * @return array{school: School, plan: AssessmentPlan, mark: Mark, teacher: User, principal: User}
 */
function correctionWorld(string $slug = 'correction-actions', AssessmentState $state = AssessmentState::Published): array
{
    $school = School::create([
        'name' => 'Correction Academy '.$slug, 'code' => 'CRA', 'slug' => $slug,
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
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone',
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 1 A', 'capacity' => 40,
    ]);
    $subject = Subject::create([
        'school_id' => $school->id, 'code' => 'ENG', 'name' => 'English',
        'department' => 'General', 'weekly_periods' => 4, 'coefficient' => 2,
    ]);
    $coefficient = Coefficient::create([
        'subject_id' => $subject->id, 'level_id' => $level->id, 'sequence_coeff' => 2, 'exam_coeff' => 2,
    ]);
    $teacher = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Teacher]);
    $principal = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $plan = AssessmentPlan::create([
        'school_id' => $school->id, 'term_id' => $term->id, 'kind' => 'sequence', 'name' => 'Sequence 1',
        'state' => $state, 'level_ids' => [$level->id],
    ]);
    $assessment = Assessment::create([
        'school_id' => $school->id, 'term_id' => $term->id, 'school_class_id' => $class->id,
        'assessment_plan_id' => $plan->id, 'kind' => 'sequence', 'name' => 'Sequence 1',
        'state' => 'published', 'sequence_weight' => 1, 'exam_weight' => 0, 'total_max' => 20,
    ]);
    $sheet = AssessmentSubject::create([
        'assessment_id' => $assessment->id, 'subject_id' => $subject->id, 'coefficient_id' => $coefficient->id,
        'max_score' => 20, 'examiner_id' => $teacher->id,
    ]);
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => 'CRA-25-0001', 'full_name' => 'Achu Brandon',
        'gender' => 'male', 'date_of_birth' => '2013-01-01', 'guardian_name' => 'G',
        'guardian_phone' => '+237670000000', 'admitted_on' => '2025-09-01',
    ]);
    $mark = Mark::create(['assessment_subject_id' => $sheet->id, 'student_id' => $student->id, 'score' => 10]);

    return compact('school', 'plan', 'mark', 'teacher', 'principal');
}

/**
 * @param  array<string, mixed>  $world
 */
function askCorrection(array $world, float|int $score = 16, ?Mark $mark = null): MarkCorrection
{
    return app(RequestMarkCorrection::class)->handle($world['school'], $mark ?? $world['mark'], $world['teacher'], [
        'new_score' => $score, 'reason' => '  Question 4 marked twice  ',
    ]);
}

test('a correction request records the published score and audits it', function () {
    $world = correctionWorld();

    $correction = askCorrection($world, 16.456);

    expect($correction->only(['reference', 'status', 'reason', 'requested_by', 'school_id']))->toBe([
        'reference' => 'C-001', 'status' => 'pending', 'reason' => 'Question 4 marked twice',
        'requested_by' => $world['teacher']->id, 'school_id' => $world['school']->id,
    ])
        ->and((float) $correction->old_score)->toBe(10.0)
        ->and((float) $correction->new_score)->toBe(16.46)
        ->and((float) $world['mark']->fresh()->score)->toBe(10.0);

    $audit = AuditEvent::sole();
    expect($audit->only(['entity', 'entity_id', 'action', 'actor_id']))->toBe([
        'entity' => 'mark_correction', 'entity_id' => $correction->id,
        'action' => 'requested', 'actor_id' => $world['teacher']->id,
    ]);
});

test('a correction request is refused for an unpublished mark, an out-of-range score or the same score', function (AssessmentState $state, float $score) {
    $world = correctionWorld(state: $state);

    expect(fn () => askCorrection($world, $score))->toThrow(ValidationException::class);
    expect(MarkCorrection::count())->toBe(0)
        ->and(AuditEvent::count())->toBe(0);
})->with([
    'marks still open' => [AssessmentState::MarksOpen, 16],
    'above the sheet maximum' => [AssessmentState::Published, 20.5],
    'unchanged score' => [AssessmentState::Published, 10.0004],
]);

test('a mark with a pending correction cannot be asked about again', function () {
    $world = correctionWorld();
    askCorrection($world);

    expect(fn () => askCorrection($world, 15))->toThrow(ValidationException::class, 'already waiting for the principal');
    expect(MarkCorrection::count())->toBe(1)
        ->and(AuditEvent::count())->toBe(1);
});

test('a declined correction leaves the mark and allows a new request', function () {
    $world = correctionWorld();
    $correction = askCorrection($world);

    app(DecideMarkCorrection::class)->handle($world['school'], $correction, $world['principal'], ['decision' => 'decline', 'note' => ' Score was right ']);

    expect($correction->refresh()->only(['status', 'decided_by', 'note']))->toBe([
        'status' => 'declined', 'decided_by' => $world['principal']->id, 'note' => 'Score was right',
    ])
        ->and($correction->decided_at)->not->toBeNull()
        ->and((float) $world['mark']->fresh()->score)->toBe(10.0)
        ->and(AuditEvent::where('action', 'declined')->where('entity_id', $correction->id)->exists())->toBeTrue();

    expect(askCorrection($world, 15)->reference)->toBe('C-002');
});

test('an approved correction updates the mark once and clears absence', function () {
    $world = correctionWorld();
    $world['mark']->update(['score' => null, 'is_absent' => true]);
    $correction = askCorrection($world);
    $decide = fn (string $decision) => app(DecideMarkCorrection::class)
        ->handle($world['school'], $correction, $world['principal'], ['decision' => $decision]);

    $decide('approve');

    $mark = $world['mark']->fresh();
    expect((float) $mark->score)->toBe(16.0)
        ->and($mark->is_absent)->toBeFalse()
        ->and($correction->refresh()->status)->toBe('approved')
        ->and($correction->note)->toBeNull();

    $mark->update(['score' => 12]);

    expect(fn () => $decide('approve'))->toThrow(ValidationException::class, 'already been decided');
    expect(fn () => $decide('decline'))->toThrow(ValidationException::class, 'already been decided');
    expect((float) $mark->fresh()->score)->toBe(12.0)
        ->and($correction->refresh()->status)->toBe('approved')
        ->and(AuditEvent::where('entity_id', $correction->id)->pluck('action')->sort()->values()->all())->toBe(['approved', 'requested']);
});

test('correction actions refuse records and actors from another school', function () {
    $world = correctionWorld();
    $other = correctionWorld('correction-actions-other');
    $correction = askCorrection($world);

    expect(fn () => app(RequestMarkCorrection::class)->handle($other['school'], $world['mark'], $other['teacher'], ['new_score' => 15, 'reason' => 'x']))
        ->toThrow(InvalidArgumentException::class);
    expect(fn () => app(RequestMarkCorrection::class)->handle($world['school'], $world['mark'], $other['teacher'], ['new_score' => 15, 'reason' => 'x']))
        ->toThrow(InvalidArgumentException::class);
    expect(fn () => app(DecideMarkCorrection::class)->handle($other['school'], $correction, $other['principal'], ['decision' => 'approve']))
        ->toThrow(InvalidArgumentException::class);
    expect(fn () => app(DecideMarkCorrection::class)->handle($world['school'], $correction, $other['principal'], ['decision' => 'approve']))
        ->toThrow(InvalidArgumentException::class);

    expect($correction->refresh()->status)->toBe('pending')
        ->and((float) $world['mark']->fresh()->score)->toBe(10.0)
        ->and(MarkCorrection::count())->toBe(1);
});
