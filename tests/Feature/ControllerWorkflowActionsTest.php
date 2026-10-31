<?php

use App\Actions\Admissions\DecideApplication;
use App\Actions\Students\ImportStudents;
use App\Enums\AcademicYearStatus;
use App\Enums\ApplicationStage;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * @return array{school: School, year: AcademicYear, class: SchoolClass, actor: User}
 */
function studentWorkflowWorld(string $slug = 'workflow-students'): array
{
    $school = School::create([
        'name' => 'Workflow Academy '.$slug, 'code' => 'WFA', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2026/27',
        'starts_on' => '2026-09-01', 'ends_on' => '2027-07-31',
        'status' => AcademicYearStatus::Planned,
    ]);
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone',
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 1A', 'capacity' => 2,
    ]);
    $actor = User::factory()->create(['school_id' => $school->id]);

    return compact('school', 'year', 'class', 'actor');
}

/**
 * @return array{name: string, class_id: string, date_of_birth: string, gender: string, guardian_name: string, guardian_phone: string, place_of_birth: string|null}
 */
function studentWorkflowImportRow(SchoolClass $class, string $name): array
{
    return [
        'name' => $name,
        'class_id' => $class->id,
        'date_of_birth' => '2014-03-14',
        'gender' => 'female',
        'guardian_name' => 'Tabi Nkwain',
        'guardian_phone' => '+237 670 14 52 08',
        'place_of_birth' => 'Bamenda',
    ];
}

test('student import runs without request tenant state and audits its committed students', function () {
    $this->travelTo('2026-10-01');
    $world = studentWorkflowWorld();
    $rows = [
        studentWorkflowImportRow($world['class'], 'Tabi Grace'),
        studentWorkflowImportRow($world['class'], 'Tabi Esther'),
    ];

    $imported = app(ImportStudents::class)->handle($world['school'], $world['year'], null, $world['actor'], $rows, 'students.csv');

    expect($imported)->toBe(2);
    expect(Student::orderBy('full_name')->pluck('full_name')->all())->toBe(['Tabi Esther', 'Tabi Grace']);
    expect(Enrolment::where('school_class_id', $world['class']->id)->count())->toBe(2);
    expect(AuditEvent::sole()->diff)->toBe(['file' => 'students.csv', 'students' => 2]);
    expect(AuditEvent::sole()->actor_id)->toBe($world['actor']->id);
});

test('student import rolls back the batch when capacity shrinks after preview', function () {
    $this->travelTo('2026-10-01');
    $world = studentWorkflowWorld();
    $rows = [
        studentWorkflowImportRow($world['class'], 'Tabi Grace'),
        studentWorkflowImportRow($world['class'], 'Tabi Esther'),
    ];
    $world['class']->update(['capacity' => 1]);

    expect(fn () => app(ImportStudents::class)->handle($world['school'], $world['year'], null, $world['actor'], $rows, 'students.csv'))
        ->toThrow(ValidationException::class);

    expect(Student::count())->toBe(0);
    expect(Enrolment::count())->toBe(0);
    expect(AuditEvent::count())->toBe(0);
});

test('student import rejects a duplicate created after preview without importing earlier rows', function () {
    $this->travelTo('2026-10-01');
    $world = studentWorkflowWorld();
    $rows = [
        studentWorkflowImportRow($world['class'], 'Tabi Grace'),
        studentWorkflowImportRow($world['class'], 'Tabi Esther'),
    ];
    $existing = Student::register($world['school'], [
        'full_name' => 'Tabi Esther', 'date_of_birth' => '2014-03-14', 'gender' => 'female',
    ], [['relation' => 'guardian', 'name' => 'Tabi Nkwain', 'phone' => '670145208', 'occupation' => null, 'is_main' => true]], today());

    expect(fn () => app(ImportStudents::class)->handle($world['school'], $world['year'], null, $world['actor'], $rows, 'students.csv'))
        ->toThrow(ValidationException::class);

    expect(Student::pluck('id')->all())->toBe([$existing->id]);
    expect(Enrolment::count())->toBe(0);
    expect(AuditEvent::count())->toBe(0);
});

test('student import rejects another schools year outside request tenant middleware', function () {
    $world = studentWorkflowWorld();
    $foreign = studentWorkflowWorld('workflow-other');

    expect(fn () => app(ImportStudents::class)->handle($world['school'], $foreign['year'], null, $world['actor'], [], 'students.csv'))
        ->toThrow(NotFoundHttpException::class);

    expect(Student::count())->toBe(0);
    expect(AuditEvent::count())->toBe(0);
});

test('application admission outside a request creates an unplaced student only once', function () {
    $this->travelTo('2026-07-01');
    $world = studentWorkflowWorld();
    $application = Application::create([
        'school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id,
        'level_id' => $world['class']->level_id, 'reference' => 'APP-26-0001',
        'surname' => 'Tabi', 'given_names' => 'Grace', 'full_name' => 'Tabi Grace',
        'date_of_birth' => '2014-03-14', 'gender' => 'female', 'transferred' => false,
        'guardians' => [['relation' => 'guardian', 'name' => 'Tabi Nkwain', 'phone' => '670145208', 'occupation' => null, 'is_main' => true]],
        'documents' => [], 'stage' => ApplicationStage::ToReview,
    ]);
    $action = app(DecideApplication::class);

    $action->handle($world['school'], $world['year'], $application, $world['actor'], ApplicationStage::Admitted, 'Bring birth certificate');

    expect($application->refresh()->stage)->toBe(ApplicationStage::Admitted);
    expect($application->condition)->toBe('Bring birth certificate');
    expect(Student::sole()->admission_no)->toBe('WFA-26-0001');
    expect(Enrolment::sole()->status)->toBe(EnrolmentStatus::Admitted);
    expect(Enrolment::sole()->school_class_id)->toBeNull();
    expect(Invoice::count())->toBe(0);
    expect(AuditEvent::sole()->action)->toBe('admitted');

    expect(fn () => $action->handle($world['school'], $world['year'], $application, $world['actor'], ApplicationStage::Admitted))
        ->toThrow(ValidationException::class);
    expect(Student::count())->toBe(1);
    expect(AuditEvent::count())->toBe(1);
});
