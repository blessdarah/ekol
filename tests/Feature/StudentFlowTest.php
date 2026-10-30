<?php

use App\Enums\AcademicYearStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentSeries;
use App\Models\Term;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A school with a current year and term, a series level and two classes.
 *
 * @return array{school: School, admin: User, year: AcademicYear, term: Term, level: Level, classes: array<int, SchoolClass>}
 */
function studentWorld(string $slug = 'studenta'): array
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
    $classes = [];

    foreach (['A' => 45, 'B' => 1] as $letter => $seats) {
        $classes[] = SchoolClass::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id,
            'level_id' => $level->id, 'name' => "Form 4 {$letter}", 'capacity' => $seats,
        ]);
    }

    return compact('school', 'admin', 'year', 'term', 'level', 'classes');
}

function studentPayload(SchoolClass $class, array $overrides = []): array
{
    return array_merge([
        'surname' => 'Tabi Nkwain',
        'given_names' => 'Grace Ayuk',
        'date_of_birth' => '2010-03-14',
        'gender' => 'female',
        'place_of_birth' => 'Bamenda',
        'religion' => 'Presbyterian',
        'has_disability' => true,
        'disability_types' => ['Visual'],
        'disability_support' => 'Sits in the front row',
        'transferred' => true,
        'previous_school' => 'GBHS Wum',
        'previous_class' => 'Form 3',
        'previous_year_left' => 2024,
        'transfer_certificate_received' => true,
        'last_report_received' => false,
        'on_whatsapp' => true,
        'lives_with' => 'Both parents',
        'class_id' => $class->id,
        'series_id' => null,
        'guardians' => [
            ['relation' => 'father', 'name' => 'Tabi Nkwain', 'phone' => '+237 670 14 52 08', 'occupation' => 'Trader'],
            ['relation' => 'mother', 'name' => 'Ngum Beatrice', 'phone' => '+237 655 48 20 91', 'occupation' => 'Nurse'],
        ],
        'main_contact' => 'father',
        'link_sibling_id' => null,
    ], $overrides);
}

test('registering a student gives a matricule, a class place and parents', function () {
    $this->travelTo('2025-10-01');
    $world = studentWorld();
    [$form4a] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $student = Student::firstOrFail();

    expect($student->admission_no)->toBe('GBHS-25-0001')
        ->and($student->full_name)->toBe('Tabi Nkwain Grace Ayuk')
        ->and($student->guardian_name)->toBe('Tabi Nkwain')
        ->and($student->guardian_phone)->toBe('+237 670 14 52 08')
        ->and($student->disability_types)->toBe(['Visual'])
        ->and($student->guardians()->count())->toBe(2)
        ->and($student->guardians()->where('is_main', true)->value('relation'))->toBe('father');

    $enrolment = Enrolment::where('student_id', $student->id)->firstOrFail();

    expect($enrolment->school_class_id)->toBe($form4a->id)
        ->and($enrolment->status)->toBe(EnrolmentStatus::Enrolled);

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, [
            'surname' => 'Achu', 'given_names' => 'Brandon Che', 'another' => true,
        ]))
        ->assertRedirect(route('students.create'));

    expect(Student::where('surname', 'Achu')->value('admission_no'))->toBe('GBHS-25-0002');
});

test('a full class, a duplicate and a main contact without a phone are refused', function () {
    $world = studentWorld();
    [$form4a, $form4b] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4b))
        ->assertSessionHasNoErrors();

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4b, ['surname' => 'Mbah']))
        ->assertSessionHasErrors('class_id');

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a))
        ->assertSessionHasErrors('duplicate');

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, ['allow_duplicate' => true]))
        ->assertSessionHasNoErrors();

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, [
            'surname' => 'Kum', 'main_contact' => 'guardian',
        ]))
        ->assertSessionHasErrors('main_contact');

    expect(Student::count())->toBe(2);
});

test('a series chosen at registration is recorded and must match the level', function () {
    $world = studentWorld();
    [$form4a] = $world['classes'];
    $series = Series::create([
        'school_id' => $world['school']->id, 'level_id' => $world['level']->id,
        'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science',
    ]);
    $otherLevel = Level::create([
        'school_id' => $world['school']->id, 'name' => 'Form 5', 'code' => 'F5', 'ordinal' => 5,
        'cycle' => SchoolCycle::HighSchool, 'subsystem' => 'anglophone', 'uses_series' => true,
    ]);
    $foreign = Series::create([
        'school_id' => $world['school']->id, 'level_id' => $otherLevel->id,
        'code' => 'A1', 'name' => 'Arts 1', 'stream' => 'arts',
    ]);

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, ['series_id' => $foreign->id]))
        ->assertSessionHasErrors('series_id');

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, ['series_id' => $series->id]))
        ->assertSessionHasNoErrors();

    expect(StudentSeries::where('series_id', $series->id)->where('term_id', $world['term']->id)->count())->toBe(1);
});

test('admission issues the level fee plan as installments', function () {
    $world = studentWorld();
    [$form4a] = $world['classes'];
    FeePlan::create([
        'school_id' => $world['school']->id, 'level_id' => $world['level']->id,
        'academic_year_id' => $world['year']->id, 'annual_amount' => '65000', 'currency' => 'XAF',
    ]);

    foreach ([45, 33, 22] as $index => $percent) {
        FeeInstallmentTemplate::create([
            'school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id,
            'seq' => $index + 1, 'percent' => $percent,
        ]);
    }

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a))
        ->assertSessionHasNoErrors();

    $invoice = Invoice::firstOrFail();

    expect((float) $invoice->amount_due)->toBe(65000.0)
        ->and($invoice->installments()->count())->toBe(3)
        ->and((float) $invoice->installments()->sum('amount'))->toBe(65000.0);

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students')
        ->assertInertia(fn (Assert $page) => $page
            ->component('students/roster')
            ->where('students.rows.0.fees', 'due')
            ->where('students.rows.0.balance', 65000));
});

test('the roster filters by no series, searches, and stays inside the school', function () {
    $world = studentWorld();
    $other = studentWorld('otherstu');
    [$form4a] = $world['classes'];
    $series = Series::create([
        'school_id' => $world['school']->id, 'level_id' => $world['level']->id,
        'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science',
    ]);

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, ['series_id' => $series->id]));
    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, [
            'surname' => 'Achu', 'given_names' => 'Brandon',
        ]));
    $this->actingAs($other['admin'])
        ->post('http://otherstu.ekol.test/students', studentPayload($other['classes'][0], ['surname' => 'Hidden']));

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students')
        ->assertInertia(fn (Assert $page) => $page
            ->where('counts.total', 2)
            ->where('counts.no_series', 1)
            ->has('students.rows', 2)
            ->where('students.rows.0.name', 'Achu Brandon')
            ->where('students.rows.0.needs_series', true)
            ->where('students.rows.1.series.code', 'S1'));

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students?series=none')
        ->assertInertia(fn (Assert $page) => $page->has('students.rows', 1));

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students?q=GBHS-'.today()->format('y').'-0001')
        ->assertInertia(fn (Assert $page) => $page
            ->has('students.rows', 1)
            ->where('students.rows.0.name', 'Tabi Nkwain Grace Ayuk'));

    $foreign = Student::where('surname', 'Hidden')->firstOrFail();

    $this->actingAs($world['admin'])
        ->get("http://studenta.ekol.test/students/{$foreign->id}")
        ->assertNotFound();
});

test('the roster combines filters, sorts, pages and exports what it shows to the audit log', function () {
    $world = studentWorld();
    [$form4a] = $world['classes'];
    $series = Series::create([
        'school_id' => $world['school']->id, 'level_id' => $world['level']->id,
        'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science',
    ]);

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, ['series_id' => $series->id]));
    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, [
            'surname' => 'Achu', 'given_names' => 'Brandon', 'gender' => 'male',
        ]));
    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, [
            'surname' => 'Bih', 'given_names' => 'Clarisse',
        ]));

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students?series=S1,none&gender=female&sort=-name&per_page=50')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.series', ['S1', 'none'])
            ->where('filters.sort', '-name')
            ->where('students.perPage', 50)
            ->has('students.rows', 2)
            ->where('students.rows.0.name', 'Tabi Nkwain Grace Ayuk')
            ->where('students.rows.1.name', 'Bih Clarisse'));

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students?per_page=7')
        ->assertInertia(fn (Assert $page) => $page->where('students.perPage', 25));

    $csv = $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students/export?gender=female&columns=name,class')
        ->assertOk()
        ->assertDownload()
        ->streamedContent();

    expect($csv)->toContain('Gender: Girls')
        ->and($csv)->toContain('Tabi Nkwain Grace Ayuk')
        ->and($csv)->toContain('Bih Clarisse')
        ->and($csv)->not->toContain('Achu Brandon')
        ->and($csv)->not->toContain('Guardian');

    $achu = Student::where('surname', 'Achu')->firstOrFail();

    $this->actingAs($world['admin'])
        ->get("http://studenta.ekol.test/students/export?format=print&ids={$achu->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('tables/print')
            ->has('rows', 1)
            ->where('rows.0.name', 'Achu Brandon'));

    $audit = AuditEvent::where('entity', 'export')->get()->keyBy(fn (AuditEvent $event) => $event->diff['format']);

    expect($audit)->toHaveCount(2)
        ->and($audit['csv']->diff['rows'])->toBe(2)
        ->and($audit['csv']->diff['columns'])->toBe(['name', 'class'])
        ->and($audit['print']->diff['rows'])->toBe(1);
});

test('a registrar manages students but never sees or overwrites private details', function () {
    $world = studentWorld();
    [$form4a] = $world['classes'];
    $registrar = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Registrar]);
    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a));

    $student = Student::firstOrFail();

    $this->actingAs($teacher)->get('http://studenta.ekol.test/students')->assertForbidden();

    $this->actingAs($registrar)
        ->get("http://studenta.ekol.test/students/{$student->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('students/record')
            ->where('canSeePrivate', false)
            ->where('student.religion', null)
            ->where('student.disability', null));

    $this->actingAs($registrar)
        ->patch("http://studenta.ekol.test/students/{$student->id}", studentPayload($form4a, [
            'place_of_birth' => 'Kumbo', 'religion' => null,
            'has_disability' => false, 'disability_types' => [],
        ]))
        ->assertSessionHasNoErrors();

    $student->refresh();

    expect($student->place_of_birth)->toBe('Kumbo')
        ->and($student->religion)->toBe('Presbyterian')
        ->and($student->has_disability)->toBeTrue();
});

test('a shared parent phone is offered as a possible sibling and can be linked', function () {
    $world = studentWorld();
    [$form4a] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a));

    $first = Student::firstOrFail();

    $this->actingAs($world['admin'])
        ->getJson('http://studenta.ekol.test/students/sibling-check?phone='.urlencode('670145208'))
        ->assertJsonPath('sibling.id', $first->id);

    $this->actingAs($world['admin'])
        ->getJson('http://studenta.ekol.test/students/sibling-check?phone=699000000')
        ->assertJsonPath('sibling', null);

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, [
            'given_names' => 'Junior', 'link_sibling_id' => $first->id,
        ]))
        ->assertSessionHasNoErrors();

    $second = Student::where('given_names', 'Junior')->firstOrFail();

    expect($second->family_id)->not->toBeNull()
        ->and($first->fresh()->family_id)->toBe($second->family_id);
});

test('a spreadsheet is matched, checked and only its clean rows are imported', function () {
    Storage::fake('local');
    $world = studentWorld();
    [$form4a] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students', studentPayload($form4a, [
            'surname' => 'Tebo', 'given_names' => 'Larissa', 'date_of_birth' => '2011-05-02',
        ]));

    $csv = implode("\n", [
        'Student name,Born on,Sex,Class,Parent,Parent phone',
        'Fomum Brice Tamfu,2011-01-20,Boy,Form 4 A,Mr Fomum,+237 677 05 62 31',
        'Ebot Divine Takor,,Boy,Form 4 A,Mr Ebot,+237 677 05 62 32',
        'Njoh Clarisse Ayuk,14/03/2011,Girl,Form 9 Z,Mrs Njoh,+237 654 11 79 20',
        'Tebo Larissa,2011-05-02,Girl,Form 4 A,Mrs Tebo,+237 699 43 17 62',
        'Nji Walter Fon,2011-02-02,Boy,Form 4 A,Mr Nji,12345',
        'Kum Sandrine Lum,03/04/2011,F,form 4 a,Mrs Kum,+237 651 26 84 90',
    ]);

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students/import', [
            'file' => UploadedFile::fake()->createWithContent('intake.csv', $csv),
        ])
        ->assertRedirect(route('students.import'));

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students/import')
        ->assertInertia(fn (Assert $page) => $page
            ->component('students/import')
            ->where('step', 'match')
            ->where('file.rows', 6)
            ->where('guess.full_name', 0)
            ->where('guess.date_of_birth', 1)
            ->where('guess.guardian_phone', 5));

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students/import/mapping', [
            'mapping' => [
                'full_name' => 0, 'date_of_birth' => 1, 'gender' => 2, 'class' => 3,
                'guardian_name' => 4, 'guardian_phone' => 5, 'place_of_birth' => null,
            ],
        ])
        ->assertRedirect(route('students.import'));

    $this->actingAs($world['admin'])
        ->get('http://studenta.ekol.test/students/import')
        ->assertInertia(fn (Assert $page) => $page
            ->where('step', 'check')
            ->where('report.rows', 6)
            ->where('report.ready', 2)
            ->where('report.fix', 3)
            ->where('report.duplicates', 1)
            ->where('report.problems.0.problem', 'Date of birth is missing')
            ->where('report.problems.1.problem', 'Class "Form 9 Z" does not exist'));

    $this->actingAs($world['admin'])
        ->post('http://studenta.ekol.test/students/import/run')
        ->assertRedirect(route('students'));

    expect(Student::count())->toBe(3)
        ->and(Student::where('full_name', 'Kum Sandrine Lum')->value('gender')->value)->toBe('female')
        ->and(Enrolment::where('school_class_id', $form4a->id)->count())->toBe(3);
});

test('a student record offers the students before and after it on the roster', function () {
    $world = studentWorld();
    $class = $world['classes'][0];
    $students = [];

    foreach (['Bih Glory', 'Achu Brandon', 'Che Emmanuel'] as $index => $name) {
        $students[$name] = $student = Student::create([
            'school_id' => $world['school']->id, 'admission_no' => 'NB-25-000'.($index + 1),
            'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2013-01-01',
            'guardian_name' => 'Mr. Guardian', 'guardian_phone' => '+23767000010'.$index, 'admitted_on' => '2025-09-01',
        ]);
        Enrolment::create([
            'student_id' => $student->id, 'academic_year_id' => $world['year']->id,
            'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled,
        ]);
    }

    $host = "http://{$world['school']->slug}.ekol.test";

    $this->actingAs($world['admin'])
        ->get("{$host}/students/{$students['Bih Glory']->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('neighbours.previous.name', 'Achu Brandon')
            ->where('neighbours.next.name', 'Che Emmanuel')
            ->where('neighbours.position', 2)
            ->where('neighbours.total', 3)
            ->where('neighbours.next.class', $class->name));

    $other = Student::create([
        'school_id' => $world['school']->id, 'admission_no' => 'NB-25-0009',
        'full_name' => 'Abang Rose', 'gender' => 'female', 'date_of_birth' => '2013-01-01',
        'guardian_name' => 'Mr. Guardian', 'guardian_phone' => '+237670000109', 'admitted_on' => '2025-09-01',
    ]);
    Enrolment::create([
        'student_id' => $other->id, 'academic_year_id' => $world['year']->id,
        'school_class_id' => $world['classes'][1]->id, 'status' => EnrolmentStatus::Enrolled,
    ]);

    $this->actingAs($world['admin'])
        ->get("{$host}/students/{$students['Che Emmanuel']->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('neighbours.next.name', 'Abang Rose')
            ->where('neighbours.next.class', $world['classes'][1]->name)
            ->where('neighbours.total', 4));

    $this->actingAs($world['admin'])
        ->get("{$host}/students/{$students['Achu Brandon']->id}/academics")
        ->assertInertia(fn (Assert $page) => $page
            ->where('neighbours.previous', null)
            ->where('neighbours.next.name', 'Bih Glory'));
});
