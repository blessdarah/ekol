<?php

use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\ClassSubject;
use App\Models\Coefficient;
use App\Models\Level;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Subject;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A school with a current year, two secondary levels and three classes.
 *
 * @return array{school: School, admin: User, year: AcademicYear, levels: array<int, Level>, classes: array<int, SchoolClass>}
 */
function subjectWorld(string $slug = 'subjecta'): array
{
    $school = School::create([
        'name' => "Academy {$slug}", 'code' => 'SU', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);

    $levels = [];
    $classes = [];

    foreach ([['Form 1', 'F1', ['A', 'B']], ['Form 2', 'F2', ['A']]] as $index => [$name, $code, $letters]) {
        $levels[] = $level = Level::create([
            'school_id' => $school->id, 'name' => $name, 'code' => $code,
            'ordinal' => $index + 1, 'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone',
        ]);

        foreach ($letters as $letter) {
            $classes[] = SchoolClass::create([
                'school_id' => $school->id, 'academic_year_id' => $year->id,
                'level_id' => $level->id, 'name' => "{$name} {$letter}", 'capacity' => 45,
            ]);
        }
    }

    return compact('school', 'admin', 'year', 'levels', 'classes');
}

function subjectTeacher(School $school, string $given, string $family): User
{
    return User::factory()->create([
        'school_id' => $school->id, 'given_name' => $given,
        'family_name' => $family, 'full_name' => "{$given} {$family}",
    ]);
}

function subjectPayload(array $classes, array $overrides = []): array
{
    return array_merge([
        'name' => 'Mathematics',
        'code' => 'math-101',
        'coefficient' => 4,
        'department' => 'Sciences',
        'note' => null,
        'mode' => 'register',
        'classes' => $classes,
    ], $overrides);
}

test('registering a subject stores each class with its teacher and periods', function () {
    $world = subjectWorld();
    $teacher = subjectTeacher($world['school'], 'Gabriel', 'Ngonda');
    [$form1a, $form1b, $form2a] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([
            ['class_id' => $form1a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5],
            ['class_id' => $form2a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 6],
        ]))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $subject = Subject::where('code', 'MATH-101')->firstOrFail();

    expect((float) $subject->coefficient)->toBe(4.0)
        ->and($subject->classSubjects()->count())->toBe(2)
        ->and((int) $subject->classSubjects()->sum('weekly_periods'))->toBe(11)
        ->and(ClassSubject::where('school_class_id', $form1b->id)->exists())->toBeFalse()
        ->and(Coefficient::where('subject_id', $subject->id)->count())->toBe(2)
        ->and((float) Coefficient::where('subject_id', $subject->id)->value('exam_coeff'))->toBe(4.0)
        ->and($teacher->subjects()->pluck('name')->all())->toBe(['Mathematics']);
});

test('registering needs a teacher for every class, a draft does not', function () {
    $world = subjectWorld();
    [$form1a] = $world['classes'];
    $rows = [['class_id' => $form1a->id, 'staff_id' => null, 'weekly_periods' => 5]];

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload($rows))
        ->assertSessionHasErrors('classes');

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([]))
        ->assertSessionHasErrors('classes');

    expect(Subject::count())->toBe(0);

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload($rows, ['mode' => 'draft']))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect(Subject::count())->toBe(1);
});

test('editing a subject replaces its classes and updates the coefficient', function () {
    $world = subjectWorld();
    $teacher = subjectTeacher($world['school'], 'Mary', 'Tebo');
    [$form1a, $form1b] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([
            ['class_id' => $form1a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5],
        ]));

    $subject = Subject::firstOrFail();

    $this->actingAs($world['admin'])
        ->patch("http://subjecta.ekol.test/classes/subjects/{$subject->id}", subjectPayload([
            ['class_id' => $form1b->id, 'staff_id' => $teacher->id, 'weekly_periods' => 4],
        ], ['coefficient' => 3]))
        ->assertRedirect(route('classes.subjects.show', $subject->id));

    expect($subject->classSubjects()->pluck('school_class_id')->all())->toBe([$form1b->id])
        ->and((float) $subject->fresh()->coefficient)->toBe(3.0)
        ->and((float) Coefficient::where('subject_id', $subject->id)->value('sequence_coeff'))->toBe(3.0);

    $this->actingAs($world['admin'])
        ->get("http://subjecta.ekol.test/classes/subjects/{$subject->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('subjects/record')
            ->where('subject.rows.0.class', 'Form 1 B')
            ->where('subject.rows.0.teacher', 'Mary Tebo')
            ->where('subject.not_offered', ['Form 1 A'])
            ->where('subject.unstaffed', 0));
});

test('the roster counts, filters by needs teacher and searches by teacher', function () {
    $world = subjectWorld();
    $teacher = subjectTeacher($world['school'], 'Gabriel', 'Ngonda');
    [$form1a] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([
            ['class_id' => $form1a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5],
        ]));
    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([
            ['class_id' => $form1a->id, 'staff_id' => null, 'weekly_periods' => 2],
        ], ['name' => 'Civic Education', 'code' => 'CIV-140', 'department' => 'General', 'mode' => 'draft']));

    $this->actingAs($world['admin'])
        ->get('http://subjecta.ekol.test/classes/subjects')
        ->assertInertia(fn (Assert $page) => $page
            ->component('subjects/roster')
            ->where('counts.total', 2)
            ->where('counts.departments', 2)
            ->where('counts.needs_teacher', 1)
            ->where('subjects.rows.0.code', 'CIV-140')
            ->where('subjects.rows.1.levels', ['F1'])
            ->where('subjects.rows.1.periods', 5));

    $this->actingAs($world['admin'])
        ->get('http://subjecta.ekol.test/classes/subjects?needs=1')
        ->assertInertia(fn (Assert $page) => $page
            ->has('subjects.rows', 1)
            ->where('subjects.rows.0.name', 'Civic Education'));

    $this->actingAs($world['admin'])
        ->get('http://subjecta.ekol.test/classes/subjects?q=ngonda')
        ->assertInertia(fn (Assert $page) => $page
            ->has('subjects.rows', 1)
            ->where('subjects.rows.0.name', 'Mathematics'));
});

test('a template creates the chosen subjects and skips ones already registered', function () {
    $world = subjectWorld();
    $teacher = subjectTeacher($world['school'], 'Gabriel', 'Ngonda');
    [$form1a] = $world['classes'];
    Subject::create([
        'school_id' => $world['school']->id, 'code' => 'MATH-101', 'name' => 'Mathematics',
        'department' => 'Sciences', 'weekly_periods' => 5, 'coefficient' => 4,
    ]);

    $this->actingAs($world['admin'])
        ->get('http://subjecta.ekol.test/classes/subjects/templates')
        ->assertInertia(fn (Assert $page) => $page
            ->component('subjects/templates')
            ->has('sets', 4)
            ->where('sets.0.subjects.0.registered', true)
            ->where('sets.0.subjects.1.levels_label', 'F1–F2'));

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects/templates', [
            'set' => 'core',
            'subjects' => [
                ['code' => 'MATH-101', 'classes' => []],
                ['code' => 'ENG-102', 'classes' => [
                    ['class_id' => $form1a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5],
                ]],
                ['code' => 'HIS-205', 'classes' => [
                    ['class_id' => $form1a->id, 'staff_id' => null, 'weekly_periods' => 2],
                ]],
                ['code' => 'NOT-IN-SET', 'classes' => []],
            ],
        ])
        ->assertRedirect(route('classes.subjects'))
        ->assertSessionHasNoErrors();

    expect(Subject::orderBy('code')->pluck('code')->all())->toBe(['ENG-102', 'HIS-205', 'MATH-101'])
        ->and((float) Subject::where('code', 'ENG-102')->value('coefficient'))->toBe(4.0)
        ->and(ClassSubject::whereNull('staff_id')->count())->toBe(1);
});

test('subjects cannot use another school classes or staff, and teachers are kept out', function () {
    $world = subjectWorld();
    $other = subjectWorld('othersub');
    $teacher = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Teacher]);

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([
            ['class_id' => $other['classes'][0]->id, 'staff_id' => $other['admin']->id, 'weekly_periods' => 5],
        ]))
        ->assertSessionHasErrors(['classes.0.class_id', 'classes.0.staff_id']);

    $this->actingAs($teacher)->get('http://subjecta.ekol.test/classes/subjects')->assertForbidden();
    $this->actingAs($teacher)
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([]))
        ->assertForbidden();

    $foreign = Subject::create([
        'school_id' => $other['school']->id, 'code' => 'X-1', 'name' => 'Foreign',
        'department' => 'Arts', 'weekly_periods' => 1,
    ]);

    $this->actingAs($world['admin'])
        ->get("http://subjecta.ekol.test/classes/subjects/{$foreign->id}")
        ->assertNotFound();
});

test('a series subject a class of its level does not take counts as needing a teacher', function () {
    $world = subjectWorld();
    $teacher = subjectTeacher($world['school'], 'Gabriel', 'Ngonda');
    [$form1a, $form1b, $form2a] = $world['classes'];

    $this->actingAs($world['admin'])
        ->post('http://subjecta.ekol.test/classes/subjects', subjectPayload([
            ['class_id' => $form1a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5],
        ]));
    $maths = Subject::firstOrFail();

    $this->actingAs($world['admin'])
        ->get('http://subjecta.ekol.test/classes/subjects?needs=1')
        ->assertInertia(fn (Assert $page) => $page->where('counts.needs_teacher', 0)->has('subjects.rows', 0));

    $series = Series::create([
        'school_id' => $world['school']->id, 'level_id' => $world['levels'][1]->id,
        'code' => 'S1', 'name' => 'Science 1', 'stream' => 'science',
    ]);
    $series->subjects()->sync([$maths->id => ['kind' => 'core']]);

    $this->actingAs($world['admin'])
        ->get('http://subjecta.ekol.test/classes/subjects?needs=1')
        ->assertInertia(fn (Assert $page) => $page
            ->where('counts.needs_teacher', 1)
            ->has('subjects.rows', 1)
            ->where('subjects.rows.0.name', 'Mathematics')
            ->where('subjects.rows.0.not_taught', ['Form 2 A']));

    $this->actingAs($world['admin'])
        ->patch("http://subjecta.ekol.test/classes/subjects/{$maths->id}", subjectPayload([
            ['class_id' => $form1a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5],
            ['class_id' => $form2a->id, 'staff_id' => $teacher->id, 'weekly_periods' => 5],
        ]))
        ->assertSessionHasNoErrors();

    $this->actingAs($world['admin'])
        ->get('http://subjecta.ekol.test/classes/subjects?needs=1')
        ->assertInertia(fn (Assert $page) => $page->where('counts.needs_teacher', 0)->has('subjects.rows', 0));

    expect($form1b->id)->not->toBe($form2a->id);
});
