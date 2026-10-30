<?php

use App\Enums\AcademicYearStatus;
use App\Enums\ApplicationStage;
use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentGuardian;
use App\Models\Term;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A school in 2025/26 with 2026/27 planned: Form 1 → Form 2 → Form 3,
 * one class in each level this year, and two Form 1 students.
 *
 * @return array<string, mixed>
 */
function enrolmentWorld(string $slug = 'enrola'): array
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
    $next = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2026/27',
        'starts_on' => '2026-09-07', 'ends_on' => '2027-07-30',
        'status' => AcademicYearStatus::Planned,
    ]);

    $levels = [];
    $classes = [];

    foreach ([1, 2, 3] as $ordinal) {
        $levels[$ordinal] = Level::create([
            'school_id' => $school->id, 'name' => "Form {$ordinal}", 'code' => "F{$ordinal}", 'ordinal' => $ordinal,
            'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
        ]);
        $classes[$ordinal] = SchoolClass::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id,
            'level_id' => $levels[$ordinal]->id, 'name' => "Form {$ordinal}A", 'capacity' => 40,
        ]);
    }

    $students = [];

    foreach (['Achu Brandon', 'Bih Glory'] as $index => $name) {
        $students[] = $student = Student::create([
            'school_id' => $school->id, 'admission_no' => 'GBHS-25-000'.($index + 1),
            'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2013-01-01',
            'guardian_name' => 'G', 'guardian_phone' => '+23767000000'.$index, 'admitted_on' => '2025-09-01',
        ]);
        Enrolment::create([
            'student_id' => $student->id, 'academic_year_id' => $year->id,
            'school_class_id' => $classes[1]->id, 'status' => EnrolmentStatus::Enrolled,
        ]);
    }

    return compact('school', 'admin', 'year', 'next', 'levels', 'classes', 'students');
}

/**
 * @return array<string, mixed>
 */
function applicationPayload(array $world, array $overrides = []): array
{
    return array_merge([
        'surname' => 'Tabi',
        'given_names' => 'Nkwain Esther',
        'date_of_birth' => '2012-08-14',
        'gender' => 'female',
        'place_of_birth' => 'Bamenda',
        'religion' => 'Presbyterian',
        'disability' => null,
        'level_id' => $world['levels'][2]->id,
        'transferred' => true,
        'previous_school' => 'GBHS Wum',
        'previous_class' => 'Form 1',
        'reason' => 'Family moved to Bamenda',
        'guardians' => [
            ['relation' => 'father', 'name' => 'Tabi Nkwain', 'phone' => '+237 670 14 52 08', 'occupation' => 'Trader'],
        ],
        'main_contact' => 'father',
        'documents' => ['birth_certificate'],
    ], $overrides);
}

function enrolmentCurrent(array $world, int $student): Enrolment
{
    return Enrolment::where('student_id', $world['students'][$student]->id)
        ->where('academic_year_id', $world['year']->id)
        ->firstOrFail();
}

test('the overview explains itself when no next year is planned', function () {
    $world = enrolmentWorld();
    $world['next']->delete();

    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('enrolment/overview')
            ->where('enrolment', null)
            ->where('currentLabel', '2025/26'));

    $this->actingAs($world['admin'])
        ->get('http://enrolb.ekol.test/enrolment/placement')
        ->assertNotFound();
    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment/placement')
        ->assertRedirect(route('enrolment'));
});

test('the overview counts applications, continuing students and seats', function () {
    $world = enrolmentWorld();

    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('enrolment/overview')
            ->where('enrolment.year', '2026/27')
            ->where('enrolment.undecided', 2)
            ->where('enrolment.ready', false)
            ->where('continuing.total', 2)
            ->where('copyable', 3)
            ->has('levels', 3));
});

test('only roles that manage students open enrolment', function () {
    $world = enrolmentWorld();
    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);
    $registrar = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Registrar]);

    $this->actingAs($teacher)->get('http://enrola.ekol.test/enrolment')->assertForbidden();
    $this->actingAs($registrar)->get('http://enrola.ekol.test/enrolment')->assertOk();
});

test('this year\'s classes can be copied into the coming year once', function () {
    $world = enrolmentWorld();

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/classes')
        ->assertSessionHasNoErrors();

    expect(SchoolClass::where('academic_year_id', $world['next']->id)->pluck('name')->sort()->values()->all())
        ->toBe(['Form 1A', 'Form 2A', 'Form 3A']);

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/classes')
        ->assertSessionHasErrors('classes');

    $this->actingAs($world['admin'])
        ->post("http://enrola.ekol.test/enrolment/levels/{$world['levels'][2]->id}/classes")
        ->assertSessionHasNoErrors();

    expect(SchoolClass::where('academic_year_id', $world['next']->id)->where('name', 'Form 2B')->exists())->toBeTrue();
});

test('an application gets a reference and waits for review', function () {
    $world = enrolmentWorld();

    $response = $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/applications', applicationPayload($world))
        ->assertSessionHasNoErrors();

    $application = Application::firstOrFail();
    $response->assertRedirect(route('enrolment.applications.show', $application->id));

    expect($application->reference)->toBe('APP-26-0001')
        ->and($application->stage)->toBe(ApplicationStage::ToReview)
        ->and($application->full_name)->toBe('Tabi Nkwain Esther')
        ->and($application->guardians[0]['is_main'])->toBeTrue()
        ->and($application->missingDocuments())->toBe(['transfer_certificate', 'last_report', 'passport_photo']);

    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment/applications?stage=to_review')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('enrolment/applications')
            ->where('counts.all', 1)
            ->where('counts.to_review', 1)
            ->where('applications.rows.0.reference', 'APP-26-0001')
            ->where('applications.rows.0.missing', 3));

    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment/applications?stage=admitted,declined')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.stage', ['admitted', 'declined'])
            ->where('applications.total', 0));

    $csv = $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment/applications/export?stage=to_review&columns=name,reference,stage')
        ->assertDownload()
        ->streamedContent();

    expect($csv)->toContain('Tabi Nkwain Esther')
        ->and($csv)->toContain('APP-26-0001')
        ->and($csv)->toContain('Stage: To review');
});

test('an application needs a main contact with a phone', function () {
    $world = enrolmentWorld();

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/applications', applicationPayload($world, [
            'guardians' => [['relation' => 'father', 'name' => 'Tabi Nkwain', 'phone' => '']],
        ]))
        ->assertSessionHasErrors('main_contact');

    expect(Application::count())->toBe(0);
});

test('documents can be marked as received', function () {
    $world = enrolmentWorld();
    $this->actingAs($world['admin'])->post('http://enrola.ekol.test/enrolment/applications', applicationPayload($world));
    $application = Application::firstOrFail();

    $this->actingAs($world['admin'])
        ->patch("http://enrola.ekol.test/enrolment/applications/{$application->id}/documents", [
            'documents' => ['birth_certificate', 'last_report'],
        ])
        ->assertSessionHasNoErrors();

    expect($application->refresh()->missingDocuments())->toBe(['transfer_certificate', 'passport_photo']);
});

test('admitting creates the student, links a sibling and queues them for placement', function () {
    $world = enrolmentWorld();
    $sibling = $world['students'][0];
    StudentGuardian::create([
        'student_id' => $sibling->id, 'relation' => 'father', 'name' => 'Tabi Nkwain',
        'phone' => '+237670145208', 'is_main' => true,
    ]);

    $this->actingAs($world['admin'])->post('http://enrola.ekol.test/enrolment/applications', applicationPayload($world));
    $this->actingAs($world['admin'])->post('http://enrola.ekol.test/enrolment/applications', applicationPayload($world, [
        'given_names' => 'Second Child', 'guardians' => [['relation' => 'mother', 'name' => 'Ngum', 'phone' => '+237 655 48 20 91']],
        'main_contact' => 'mother',
    ]));
    [$first, $second] = Application::orderBy('reference')->get()->all();

    $this->actingAs($world['admin'])
        ->get("http://enrola.ekol.test/enrolment/applications/{$first->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('enrolment/application-review')
            ->where('sibling.name', 'Achu Brandon')
            ->where('nextMatricule', 'GBHS-26-0001')
            ->where('hasNext', true));

    $this->actingAs($world['admin'])
        ->post("http://enrola.ekol.test/enrolment/applications/{$first->id}/decision", [
            'decision' => 'admit',
            'condition' => 'Bring the last report card by 15 August',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('enrolment.applications.show', $second->id));

    $first->refresh();
    $student = Student::whereKey($first->student_id)->firstOrFail();
    $enrolment = Enrolment::where('student_id', $student->id)->firstOrFail();

    expect($first->stage)->toBe(ApplicationStage::Admitted)
        ->and($first->condition)->toBe('Bring the last report card by 15 August')
        ->and($student->admission_no)->toBe('GBHS-26-0001')
        ->and($student->guardian_phone)->toBe('+237 670 14 52 08')
        ->and($student->transferred)->toBeTrue()
        ->and($student->family_id)->not->toBeNull()
        ->and($sibling->refresh()->family_id)->toBe($student->family_id)
        ->and($enrolment->academic_year_id)->toBe($world['next']->id)
        ->and($enrolment->level_id)->toBe($world['levels'][2]->id)
        ->and($enrolment->school_class_id)->toBeNull()
        ->and($enrolment->status)->toBe(EnrolmentStatus::Admitted);

    $this->actingAs($world['admin'])
        ->post("http://enrola.ekol.test/enrolment/applications/{$first->id}/decision", ['decision' => 'decline'])
        ->assertSessionHasErrors('decision');
});

test('waitlisting and declining create no student', function () {
    $world = enrolmentWorld();
    $this->actingAs($world['admin'])->post('http://enrola.ekol.test/enrolment/applications', applicationPayload($world));
    $application = Application::firstOrFail();

    $this->actingAs($world['admin'])
        ->post("http://enrola.ekol.test/enrolment/applications/{$application->id}/decision", ['decision' => 'waitlist'])
        ->assertRedirect(route('enrolment.applications'));

    expect($application->refresh()->stage)->toBe(ApplicationStage::Waitlist)
        ->and(Student::count())->toBe(2);

    $this->actingAs($world['admin'])
        ->post("http://enrola.ekol.test/enrolment/applications/{$application->id}/decision", ['decision' => 'decline']);

    expect($application->refresh()->stage)->toBe(ApplicationStage::Declined);
});

test('a decision keeps the coming year\'s row in step', function () {
    $world = enrolmentWorld();
    $achu = enrolmentCurrent($world, 0);
    $decide = fn (?string $decision) => $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/re-enrolment', ['enrolment_id' => $achu->id, 'decision' => $decision])
        ->assertSessionHasNoErrors();
    $coming = fn () => Enrolment::where('student_id', $achu->student_id)
        ->where('academic_year_id', $world['next']->id)
        ->first();

    $decide('promote');
    expect($achu->refresh()->decision)->toBe(EnrolmentDecision::Promote)
        ->and($coming()->level_id)->toBe($world['levels'][2]->id)
        ->and($coming()->status)->toBe(EnrolmentStatus::Admitted);

    $decide('repeat');
    expect($coming()->level_id)->toBe($world['levels'][1]->id);

    $decide('leaving');
    expect($coming())->toBeNull();

    $decide(null);
    expect($achu->refresh()->decision)->toBeNull();
});

test('final year students are not decided', function () {
    $world = enrolmentWorld();
    $leaver = Student::create([
        'school_id' => $world['school']->id, 'admission_no' => 'GBHS-23-0001',
        'full_name' => 'Che Final', 'gender' => 'male', 'date_of_birth' => '2011-01-01',
        'guardian_name' => 'G', 'guardian_phone' => '+237670000009', 'admitted_on' => '2023-09-01',
    ]);
    $enrolment = Enrolment::create([
        'student_id' => $leaver->id, 'academic_year_id' => $world['year']->id,
        'school_class_id' => $world['classes'][3]->id, 'status' => EnrolmentStatus::Enrolled,
    ]);

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/re-enrolment', ['enrolment_id' => $enrolment->id, 'decision' => 'promote'])
        ->assertSessionHasErrors('decision');

    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment/re-enrolment')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('enrolment/re-enrolment')
            ->where('enrolment.undecided', 2)
            ->where('graduating', ['Form 3'])
            ->where('level.name', 'Form 1')
            ->where('level.next', 'Form 2')
            ->where('class.name', 'Form 1A')
            ->has('students', 2));
});

test('the undecided of a class can be promoted together', function () {
    $world = enrolmentWorld();
    enrolmentCurrent($world, 0)->update(['decision' => EnrolmentDecision::Leaving]);

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/re-enrolment/promote', ['class_id' => $world['classes'][1]->id])
        ->assertSessionHasNoErrors();

    expect(enrolmentCurrent($world, 0)->decision)->toBe(EnrolmentDecision::Leaving)
        ->and(enrolmentCurrent($world, 1)->decision)->toBe(EnrolmentDecision::Promote)
        ->and(Enrolment::where('academic_year_id', $world['next']->id)->count())->toBe(1);
});

test('students are placed within a class\'s seats', function () {
    $world = enrolmentWorld();
    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/re-enrolment/promote', ['class_id' => $world['classes'][1]->id]);
    $class = SchoolClass::create([
        'school_id' => $world['school']->id, 'academic_year_id' => $world['next']->id,
        'level_id' => $world['levels'][2]->id, 'name' => 'Form 2A', 'capacity' => 1,
    ]);
    $waiting = Enrolment::where('academic_year_id', $world['next']->id)->pluck('id')->all();

    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment/placement')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('enrolment/placement')
            ->where('level.name', 'Form 2')
            ->where('levels.0.over', true)
            ->where('waiting.0.kind', 'promoted')
            ->where('waiting.0.from', 'Form 1A')
            ->has('waiting', 2)
            ->where('classes.0.placed', 0));

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/placement', ['class_id' => $class->id, 'enrolment_ids' => $waiting])
        ->assertSessionHasErrors('class_id');

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/placement', ['class_id' => $class->id, 'enrolment_ids' => [$waiting[0]]])
        ->assertSessionHasNoErrors();

    $placed = Enrolment::whereKey($waiting[0])->firstOrFail();
    expect($placed->school_class_id)->toBe($class->id)
        ->and($placed->status)->toBe(EnrolmentStatus::Placed);

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/placement/clear', ['class_id' => $class->id])
        ->assertSessionHasNoErrors();

    expect($placed->refresh()->school_class_id)->toBeNull()
        ->and($placed->status)->toBe(EnrolmentStatus::Admitted);
});

test('automatic placement spreads students across classes', function () {
    $world = enrolmentWorld();
    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/re-enrolment/promote', ['class_id' => $world['classes'][1]->id]);

    foreach (['A', 'B'] as $letter) {
        SchoolClass::create([
            'school_id' => $world['school']->id, 'academic_year_id' => $world['next']->id,
            'level_id' => $world['levels'][2]->id, 'name' => "Form 2 {$letter}", 'capacity' => 40,
        ]);
    }

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/placement/all', ['level_id' => $world['levels'][2]->id])
        ->assertSessionHasNoErrors();

    $perClass = Enrolment::where('academic_year_id', $world['next']->id)
        ->whereNotNull('school_class_id')
        ->get()
        ->countBy('school_class_id')
        ->values()
        ->all();

    expect($perClass)->toBe([1, 1]);
});

test('enrolment is confirmed only when every check passes', function () {
    $world = enrolmentWorld();
    $term = Term::create([
        'school_id' => $world['school']->id, 'academic_year_id' => $world['next']->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2026-09-07', 'ends_on' => '2026-12-18',
        'week_count' => 15, 'is_current' => false,
    ]);
    FeePlan::create([
        'school_id' => $world['school']->id, 'level_id' => $world['levels'][2]->id,
        'academic_year_id' => $world['next']->id, 'annual_amount' => '60000.00',
        'currency' => 'XAF', 'is_active' => true,
    ]);

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/confirm')
        ->assertSessionHasErrors('confirm');

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/re-enrolment/promote', ['class_id' => $world['classes'][1]->id]);
    $this->actingAs($world['admin'])->post('http://enrola.ekol.test/enrolment/classes');
    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/placement/all', ['level_id' => $world['levels'][2]->id]);

    $this->actingAs($world['admin'])
        ->get('http://enrola.ekol.test/enrolment/confirm')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('enrolment/confirm')
            ->where('enrolment.ready', true)
            ->where('enrolment.has_fee_plan', true)
            ->where('who.promoted', 2)
            ->where('who.new', 0));

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/confirm')
        ->assertSessionHasNoErrors();

    expect($world['next']->refresh()->enrolment_confirmed_at)->not->toBeNull()
        ->and(Enrolment::where('academic_year_id', $world['next']->id)->where('status', EnrolmentStatus::Enrolled)->count())->toBe(2)
        ->and(Invoice::where('term_id', $term->id)->count())->toBe(2)
        ->and(enrolmentCurrent($world, 0)->status)->toBe(EnrolmentStatus::Enrolled);

    $this->actingAs($world['admin'])
        ->post('http://enrola.ekol.test/enrolment/confirm')
        ->assertSessionHasErrors('confirm');
});
