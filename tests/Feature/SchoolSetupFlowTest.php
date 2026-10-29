<?php

use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\Coefficient;
use App\Models\FeeInstallmentTemplate;
use App\Models\Level;
use App\Models\Mark;
use App\Models\Period;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function setupSchool(array $overrides = []): School
{
    return School::create(array_merge([
        'name' => 'Setup Academy',
        'code' => 'SA',
        'slug' => 'setupa',
        'cycle' => SchoolCycle::Secondary,
        'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ], $overrides));
}

function setupAdmin(School $school): User
{
    return User::create([
        'school_id' => $school->id,
        'staff_code' => 'STF-0001',
        'full_name' => 'Setup Admin',
        'initials' => 'SA',
        'email' => 'setup-admin@example.com',
        'role' => UserRole::Admin,
        'phone' => '+237600000001',
        'password' => 'password123',
    ]);
}

function setupYear(School $school): AcademicYear
{
    return AcademicYear::create([
        'school_id' => $school->id,
        'label' => '2025/26',
        'starts_on' => '2025-09-01',
        'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
}

test('profile autosaves and rejects crafted slug writes', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/profile', [
            'name' => 'Renamed Academy',
            'motto' => 'Knowledge, Discipline and Service',
            'town' => 'Bamenda',
        ])
        ->assertRedirect();

    expect($school->fresh()->name)->toBe('Renamed Academy')
        ->and($school->fresh()->motto)->toBe('Knowledge, Discipline and Service');

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/profile', [
            'slug' => 'hijacked',
        ])
        ->assertSessionHasErrors('slug');

    expect($school->fresh()->slug)->toBe('setupa');

    expect(AuditEvent::where('entity', 'school')->count())->toBe(1);
});

test('logo upload validates, replaces, and deletes the old file', function () {
    Storage::fake('public');
    $school = setupSchool();
    $admin = setupAdmin($school);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/profile', [
            'logo' => UploadedFile::fake()->image('logo.png', 256, 256),
        ])
        ->assertRedirect();

    $first = $school->fresh()->logo_path;
    expect($first)->not->toBeNull();
    Storage::disk('public')->assertExists($first);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/profile', [
            'logo' => UploadedFile::fake()->image('logo2.png', 300, 300),
        ])
        ->assertRedirect();

    expect($school->fresh()->logo_path)->not->toBe($first);
    Storage::disk('public')->assertMissing($first);
});

test('undersized logos and svg pass as designed', function () {
    Storage::fake('public');
    $school = setupSchool();
    $admin = setupAdmin($school);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/profile', [
            'logo' => UploadedFile::fake()->image('tiny.png', 100, 100),
        ])
        ->assertSessionHasErrors('logo');

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/profile', [
            'logo' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml'),
        ])
        ->assertRedirect();
});

test('installment templates require a full hundred percent', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/installments', [
            'templates' => [
                ['seq' => 1, 'percent' => 45],
                ['seq' => 2, 'percent' => 33],
                ['seq' => 3, 'percent' => 22],
            ],
        ])
        ->assertRedirect();

    expect(FeeInstallmentTemplate::where('school_id', $school->id)->count())->toBe(3);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/installments', [
            'templates' => [
                ['seq' => 1, 'percent' => 45],
                ['seq' => 2, 'percent' => 30],
            ],
        ])
        ->assertSessionHasErrors('templates');

    expect(FeeInstallmentTemplate::where('school_id', $school->id)->count())->toBe(3);
});

test('locked terms reject hand-crafted date edits', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 4', 'ordinal' => 4,
        'cycle' => SchoolCycle::Secondary,
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 4A', 'capacity' => 60,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-12',
        'week_count' => 15,
    ]);
    $subject = Subject::create([
        'school_id' => $school->id, 'code' => 'MATH', 'name' => 'Mathematics',
        'department' => 'Science', 'weekly_periods' => 5,
    ]);
    $coefficient = Coefficient::create([
        'subject_id' => $subject->id, 'level_id' => $level->id,
        'sequence_coeff' => '1.0', 'exam_coeff' => '1.5',
    ]);
    $student = Student::create([
        'school_id' => $school->id, 'admission_no' => 'ADM-1',
        'full_name' => 'Marked Student', 'gender' => 'male',
        'date_of_birth' => '2012-01-01', 'guardian_name' => 'G',
        'guardian_phone' => '+237600000002', 'admitted_on' => '2025-09-01',
    ]);
    $node = AssessmentSubject::create([
        'assessment_id' => Assessment::create([
            'school_id' => $school->id, 'term_id' => $term->id,
            'school_class_id' => $class->id, 'kind' => 'sequence',
            'name' => 'Seq 1', 'state' => 'marks_open',
            'sequence_weight' => '1.0', 'exam_weight' => '0.0',
        ])->id,
        'subject_id' => $subject->id,
        'coefficient_id' => $coefficient->id,
        'max_score' => '20.0',
    ]);
    Mark::create([
        'assessment_subject_id' => $node->id, 'student_id' => $student->id,
        'score' => '15.0', 'entered_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/terms', [
            'terms' => [[
                'id' => $term->id, 'label' => 'Term 1', 'sequence' => 1,
                'starts_on' => '2025-09-08', 'ends_on' => '2025-12-12',
                'week_count' => 14,
            ]],
        ])
        ->assertSessionHasErrors('starts_on');

    expect($term->fresh()->starts_on->toDateString())->toBe('2025-09-01');
});

/**
 * The times of the school's periods, in the order they run.
 *
 * @return list<string>
 */
function periodTimes(School $school): array
{
    return Period::where('school_id', $school->id)->orderBy('starts_at')->get()
        ->map(fn (Period $period) => $period->label.' '.substr($period->starts_at, 0, 5).'-'.substr($period->ends_at, 0, 5))
        ->all();
}

test('period times are worked out from the day start and the default length', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/schoolday', [
            'day_starts_at' => '07:30',
            'period_minutes' => 55,
            'periods' => [
                ['label' => 'P1', 'custom_minutes' => null],
                ['label' => 'P2', 'custom_minutes' => null],
                ['label' => 'BREAK', 'is_break' => true, 'custom_minutes' => 20],
                ['label' => 'P3', 'custom_minutes' => 40],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect(periodTimes($school))->toBe(['P1 07:30-08:25', 'P2 08:25-09:20', 'BREAK 09:20-09:40', 'P3 09:40-10:20']);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/schoolday', ['day_starts_at' => '08:00', 'period_minutes' => 45])
        ->assertSessionHasNoErrors();

    expect(periodTimes($school))->toBe(['P1 08:00-08:45', 'P2 08:45-09:30', 'BREAK 09:30-09:50', 'P3 09:50-10:30'])
        ->and($school->fresh()->period_minutes)->toBe(45);

    $this->actingAs($admin)
        ->get('http://setupa.ekol.test/setup')
        ->assertInertia(fn (Assert $page) => $page
            ->where('school.day_starts_at', '08:00')
            ->where('school.period_minutes', 45)
            ->where('periods.0.custom_minutes', null)
            ->where('periods.3.custom_minutes', 40));
});

test('the order the periods are sent in is the order they run', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $this->actingAs($admin)->patch('http://setupa.ekol.test/setup/schoolday', [
        'periods' => [
            ['label' => 'P1', 'custom_minutes' => null],
            ['label' => 'P2', 'custom_minutes' => null],
            ['label' => 'BREAK', 'is_break' => true, 'custom_minutes' => 20],
        ],
    ]);
    $ids = Period::where('school_id', $school->id)->orderBy('starts_at')->pluck('id', 'label');

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/schoolday', [
            'periods' => [
                ['id' => $ids['P1'], 'label' => 'P1', 'custom_minutes' => null],
                ['id' => $ids['BREAK'], 'label' => 'BREAK', 'is_break' => true, 'custom_minutes' => 20],
                ['id' => $ids['P2'], 'label' => 'P2', 'custom_minutes' => null],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect(periodTimes($school))->toBe(['P1 07:30-08:25', 'BREAK 08:25-08:45', 'P2 08:45-09:40']);
});

test('a school day cannot run past midnight and a break needs a length', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/schoolday', [
            'day_starts_at' => '22:00',
            'periods' => [
                ['label' => 'P1', 'custom_minutes' => 90],
                ['label' => 'P2', 'custom_minutes' => 90],
            ],
        ])
        ->assertSessionHasErrors('periods');
    expect(Period::count())->toBe(0);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/schoolday', [
            'periods' => [['label' => 'BREAK', 'is_break' => true, 'custom_minutes' => null]],
        ])
        ->assertSessionHasErrors('periods.0.custom_minutes');
});

test('schoolday refuses to delete a period on the timetable', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);
    $period = Period::create([
        'school_id' => $school->id, 'label' => 'P1', 'ordinal' => 1,
        'starts_at' => '07:30', 'ends_at' => '08:25',
    ]);
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 4', 'ordinal' => 4,
        'cycle' => SchoolCycle::Secondary,
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 4A', 'capacity' => 60,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-12',
        'week_count' => 15,
    ]);
    TimetableSlot::create([
        'school_id' => $school->id, 'term_id' => $term->id,
        'school_class_id' => $class->id, 'period_id' => $period->id,
        'weekday' => 1,
    ]);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/schoolday', [
            'school_days' => 63,
            'periods' => [[
                'id' => $period->id, 'label' => 'P1', 'custom_minutes' => null,
                '_delete' => true,
            ]],
        ])
        ->assertSessionHasErrors('periods');

    expect(Period::find($period->id))->not->toBeNull();
});

test('setup page renders all zones with live data', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);

    $this->actingAs($admin)
        ->get('http://setupa.ekol.test/setup')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('setup')
            ->where('school.slug', 'setupa')
            ->where('year.label', '2025/26'));
});

test('setting a term active moves the single current flag', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);
    $first = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19',
        'week_count' => 16, 'is_current' => true,
    ]);
    $second = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 2', 'sequence' => 2,
        'starts_on' => '2026-01-05', 'ends_on' => '2026-03-27',
        'week_count' => 12,
    ]);

    $this->actingAs($admin)
        ->patch("http://setupa.ekol.test/setup/terms/{$second->id}/active")
        ->assertRedirect();

    expect($second->fresh()->is_current)->toBeTrue()
        ->and($first->fresh()->is_current)->toBeFalse()
        ->and(AuditEvent::where('entity', 'term')->where('action', 'activated')->count())->toBe(1);
});

test('terms outside the current year or school cannot be made active', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    setupYear($school);
    $planned = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2026/27',
        'starts_on' => '2026-09-01', 'ends_on' => '2027-07-31',
        'status' => AcademicYearStatus::Planned,
    ]);
    $future = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $planned->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2026-09-01', 'ends_on' => '2026-12-18',
        'week_count' => 16,
    ]);

    $other = setupSchool(['name' => 'Other Academy', 'code' => 'OA', 'slug' => 'othera']);
    $foreign = Term::create([
        'school_id' => $other->id, 'academic_year_id' => setupYear($other)->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19',
        'week_count' => 16,
    ]);

    $this->actingAs($admin)
        ->patch("http://setupa.ekol.test/setup/terms/{$future->id}/active")
        ->assertSessionHasErrors('term');

    $this->actingAs($admin)
        ->patch("http://setupa.ekol.test/setup/terms/{$foreign->id}/active")
        ->assertNotFound();

    expect($future->fresh()->is_current)->toBeFalse()
        ->and($foreign->fresh()->is_current)->toBeFalse();
});

test('installment templates keep their due dates', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);

    $this->actingAs($admin)
        ->patch('http://setupa.ekol.test/setup/installments', [
            'templates' => [
                ['seq' => 1, 'percent' => 60, 'due_on' => '2025-09-15'],
                ['seq' => 2, 'percent' => 40, 'due_on' => null],
            ],
        ])
        ->assertRedirect();

    $this->actingAs($admin)
        ->get('http://setupa.ekol.test/setup')
        ->assertInertia(fn (Assert $page) => $page
            ->where('templates.0.due_on', '2025-09-15')
            ->where('templates.1.due_on', null));
});

test('setup page sends form-ready dates, times and grouped windows', function () {
    $this->travelTo('2025-10-01');
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19',
        'week_count' => 16, 'is_current' => true,
    ]);
    Period::create([
        'school_id' => $school->id, 'label' => 'P1', 'ordinal' => 1,
        'starts_at' => '07:30', 'ends_at' => '08:25',
    ]);
    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 4', 'ordinal' => 4,
        'cycle' => SchoolCycle::Secondary,
    ]);

    foreach (['Form 4A', 'Form 4B'] as $name) {
        Assessment::create([
            'school_id' => $school->id, 'term_id' => $term->id,
            'school_class_id' => SchoolClass::create([
                'school_id' => $school->id, 'academic_year_id' => $year->id,
                'level_id' => $level->id, 'name' => $name, 'capacity' => 60,
            ])->id,
            'kind' => 'sequence', 'name' => 'Sequence 2', 'state' => 'marks_open',
            'sequence_weight' => '1.0', 'exam_weight' => '0.0',
            'window_starts_on' => '2025-09-29', 'window_ends_on' => '2025-10-08',
        ]);
    }

    $this->actingAs($admin)
        ->get('http://setupa.ekol.test/setup')
        ->assertInertia(fn (Assert $page) => $page
            ->where('year.starts_on', '2025-09-01')
            ->where('terms.0.ends_on', '2025-12-19')
            ->where('periods.0.starts_at', '07:30')
            ->has('assessments', 1)
            ->has('assessments.0.ids', 2)
            ->where('assessments.0.window_status', 'open'));
});

test('an academic year can be edited but not shrunk past its terms', function () {
    $school = setupSchool();
    $admin = setupAdmin($school);
    $year = setupYear($school);
    Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19',
        'week_count' => 16,
    ]);

    $this->actingAs($admin)
        ->patch("http://setupa.ekol.test/setup/years/{$year->id}", [
            'label' => '2025/2026', 'starts_on' => '2025-09-01', 'ends_on' => '2026-06-30',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($year->fresh()->label)->toBe('2025/2026')
        ->and($year->fresh()->ends_on->toDateString())->toBe('2026-06-30');

    $this->actingAs($admin)
        ->patch("http://setupa.ekol.test/setup/years/{$year->id}", [
            'label' => '2025/2026', 'starts_on' => '2025-10-01', 'ends_on' => '2026-06-30',
        ])
        ->assertSessionHasErrors('starts_on');

    expect($year->fresh()->starts_on->toDateString())->toBe('2025-09-01');
});

test('making a year active closes the old one and moves the active term', function () {
    $this->travelTo('2026-10-10');
    $school = setupSchool();
    $admin = setupAdmin($school);
    $old = setupYear($school);
    $oldTerm = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $old->id,
        'label' => 'Term 3', 'sequence' => 3,
        'starts_on' => '2026-04-13', 'ends_on' => '2026-06-26',
        'week_count' => 11, 'is_current' => true,
    ]);
    $next = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2026/27',
        'starts_on' => '2026-09-01', 'ends_on' => '2027-07-31',
        'status' => AcademicYearStatus::Planned,
    ]);
    $nextTerm = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $next->id,
        'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2026-09-01', 'ends_on' => '2026-12-18',
        'week_count' => 16,
    ]);

    $this->actingAs($admin)
        ->patch("http://setupa.ekol.test/setup/years/{$next->id}/active")
        ->assertRedirect();

    expect($next->fresh()->status)->toBe(AcademicYearStatus::Current)
        ->and($old->fresh()->status)->toBe(AcademicYearStatus::Closed)
        ->and($nextTerm->fresh()->is_current)->toBeTrue()
        ->and($oldTerm->fresh()->is_current)->toBeFalse();
});
