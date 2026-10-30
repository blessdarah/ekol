<?php

use App\Enums\AcademicYearStatus;
use App\Enums\SchemeStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\Scheme;
use App\Models\SchemeItem;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\SyllabusTopic;
use App\Models\Term;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A school on 1 October 2025 (week 5 of a 15-week Term 1) with one
 * Form 5 class taking Physics (Science, Mr. Ngonda) and French
 * (Languages, no teacher yet), a Science head of department who
 * teaches Chemistry elsewhere, and a Languages one.
 *
 * @return array<string, mixed>
 */
function schemeWorld(): array
{
    test()->travelTo('2025-10-01 09:00:00');

    $school = School::create([
        'name' => 'Scheme Academy', 'code' => 'SCA', 'slug' => 'schemes',
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $user = fn (UserRole $role, string $name) => User::factory()->create(['school_id' => $school->id, 'role' => $role, 'full_name' => $name]);
    $principal = $user(UserRole::Principal, 'Mrs. Fonkem');
    $teacher = $user(UserRole::Teacher, 'Mr. Ngonda');
    $scienceHead = $user(UserRole::HeadOfDepartment, 'Dr. Ebot');
    $languagesHead = $user(UserRole::HeadOfDepartment, 'Mme Solange');
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-12', 'week_count' => 15, 'is_current' => true,
    ]);
    $nextTerm = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 2', 'sequence' => 2,
        'starts_on' => '2026-01-05', 'ends_on' => '2026-03-27', 'week_count' => 12,
    ]);
    $level = Level::create(['school_id' => $school->id, 'name' => 'Form 5', 'ordinal' => 5, 'cycle' => SchoolCycle::Secondary]);
    $class = SchoolClass::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => 'Form 5 A', 'capacity' => 40]);
    $other = SchoolClass::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => 'Form 5 B', 'capacity' => 40]);
    $subject = fn (string $code, string $name, string $department) => Subject::create([
        'school_id' => $school->id, 'code' => $code, 'name' => $name, 'department' => $department, 'weekly_periods' => 4,
    ]);
    $physics = $subject('PHY', 'Physics', 'Science');
    $french = $subject('FRE', 'French', 'Languages');
    $chemistry = $subject('CHE', 'Chemistry', 'Science');
    $physicsClass = ClassSubject::create(['school_id' => $school->id, 'school_class_id' => $class->id, 'subject_id' => $physics->id, 'staff_id' => $teacher->id, 'weekly_periods' => 4]);
    ClassSubject::create(['school_id' => $school->id, 'school_class_id' => $class->id, 'subject_id' => $french->id, 'staff_id' => null, 'weekly_periods' => 5]);
    ClassSubject::create(['school_id' => $school->id, 'school_class_id' => $other->id, 'subject_id' => $chemistry->id, 'staff_id' => $scienceHead->id, 'weekly_periods' => 4]);
    ClassSubject::create(['school_id' => $school->id, 'school_class_id' => $other->id, 'subject_id' => $french->id, 'staff_id' => $languagesHead->id, 'weekly_periods' => 5]);

    return compact('school', 'principal', 'teacher', 'scienceHead', 'languagesHead', 'term', 'nextTerm', 'level', 'physics', 'physicsClass');
}

/**
 * Physics Form 5, Term 1: two topics, the first in two sub-topics.
 */
function physicsSyllabus(array $world): void
{
    test()->actingAs($world['principal'])->post('http://schemes.ekol.test/classes/schemes/syllabus/topics', [
        'level_id' => $world['level']->id, 'subject_id' => $world['physics']->id,
        'name' => 'Measurement and units', 'term_sequence' => 1, 'week_from' => 1, 'week_to' => 1, 'periods' => 9,
        'subtopics' => [['name' => 'SI units', 'periods' => 2], ['name' => 'Errors', 'periods' => 2]],
    ])->assertSessionHasNoErrors();
    test()->post('http://schemes.ekol.test/classes/schemes/syllabus/topics', [
        'level_id' => $world['level']->id, 'subject_id' => $world['physics']->id,
        'name' => 'Vectors and scalars', 'term_sequence' => 1, 'week_from' => 2, 'periods' => 4, 'subtopics' => [],
    ])->assertSessionHasNoErrors();
}

function openSchemes(array $world, string $approval = 'head_of_department'): void
{
    test()->actingAs($world['principal'])->post('http://schemes.ekol.test/classes/schemes/open', [
        'due_on' => '2025-09-19', 'approval' => $approval, 'starts_from' => 'syllabus', 'free_changes' => false,
    ])->assertSessionHasNoErrors()->assertRedirect(route('schemes'));
}

function physicsScheme(array $world): Scheme
{
    return Scheme::where('class_subject_id', $world['physicsClass']->id)->with('items')->firstOrFail();
}

test('the syllabus keeps topics with their sub-topics, and only the school writes it', function () {
    $world = schemeWorld();
    physicsSyllabus($world);

    $topic = SyllabusTopic::where('name', 'Measurement and units')->with('subtopics')->firstOrFail();
    expect($topic->periods)->toBe(4)
        ->and($topic->subtopics->pluck('name')->all())->toBe(['SI units', 'Errors']);

    $kept = $topic->subtopics->first()->id;
    $this->patch("http://schemes.ekol.test/classes/schemes/syllabus/topics/{$topic->id}", [
        'name' => 'Measurement', 'term_sequence' => 1, 'week_from' => 1, 'periods' => 1,
        'subtopics' => [['id' => $kept, 'name' => 'SI units and prefixes', 'periods' => 3]],
    ])->assertSessionHasNoErrors();
    expect($topic->fresh()->subtopics->pluck('id')->all())->toBe([$kept])
        ->and($topic->fresh()->periods)->toBe(3);

    $this->get('http://schemes.ekol.test/classes/schemes/syllabus?level='.$world['level']->id.'&subject='.$world['physics']->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('schemes/syllabus')
            ->where('subjects.0.name', 'Chemistry')
            ->where('subjects.2.topics', 2)
            ->where('topics.1.name', 'Vectors and scalars'));

    $this->actingAs($world['teacher'])
        ->post('http://schemes.ekol.test/classes/schemes/syllabus/topics', ['level_id' => $world['level']->id, 'subject_id' => $world['physics']->id, 'name' => 'X', 'term_sequence' => 1, 'periods' => 1])
        ->assertForbidden();
});

test('opening a term makes one scheme per subject and class, from the syllabus and its weeks', function () {
    $world = schemeWorld();
    physicsSyllabus($world);

    $this->actingAs($world['principal'])
        ->get('http://schemes.ekol.test/classes/schemes/open')
        ->assertInertia(fn (Assert $page) => $page
            ->component('schemes/open')
            ->where('creates.schemes', 4)
            ->where('creates.with_teacher', 3)
            ->where('creates.without_teacher.0', 'French · Form 5 A')
            ->has('creates.empty_syllabus', 2));

    openSchemes($world);

    $scheme = physicsScheme($world);
    expect(Scheme::count())->toBe(4)
        ->and($scheme->status)->toBe(SchemeStatus::NotStarted)
        ->and($scheme->items->map(fn (SchemeItem $item) => [$item->label(), $item->week, $item->periods])->all())
        ->toBe([['SI units', 1, 2], ['Errors', 1, 2], ['Vectors and scalars', 2, 4]]);

    openSchemes($world);
    expect(Scheme::count())->toBe(4);
});

test('a teacher places sub-topics, adds their own and submits, and the right head approves', function () {
    $world = schemeWorld();
    physicsSyllabus($world);
    openSchemes($world);
    $scheme = physicsScheme($world);
    $vectors = $scheme->items->firstWhere('topic', 'Vectors and scalars');

    $this->actingAs($world['teacher'])
        ->get('http://schemes.ekol.test/my-scheme')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('schemes/mine')
            ->where('scheme.subject', 'Physics')
            ->has('scheme.weeks', 15)
            ->where('scheme.weeks.0.starts_on', '2025-09-01'));

    $this->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$vectors->id}", ['week' => 3])->assertSessionHasNoErrors();
    $this->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$vectors->id}", ['week' => 16])->assertSessionHasErrors('week');
    $this->post("http://schemes.ekol.test/my-scheme/{$scheme->id}/items", ['topic' => 'Physics in Cameroon', 'periods' => 2, 'week' => 4])->assertSessionHasNoErrors();
    expect($scheme->fresh()->status)->toBe(SchemeStatus::Draft)
        ->and($vectors->fresh()->week)->toBe(3);

    $this->post("http://schemes.ekol.test/my-scheme/{$scheme->id}/submit")->assertSessionHasNoErrors();
    expect($scheme->fresh()->status)->toBe(SchemeStatus::Submitted);

    $this->actingAs($world['languagesHead'])
        ->post("http://schemes.ekol.test/classes/schemes/{$scheme->id}/review", ['decision' => 'approve'])
        ->assertForbidden();

    $this->actingAs($world['scienceHead'])
        ->get("http://schemes.ekol.test/classes/schemes/{$scheme->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('schemes/show')
            ->where('canReview', true)
            ->where('checks.syllabus', 2)
            ->where('checks.placed', 2)
            ->where('checks.added', 1));

    $this->post("http://schemes.ekol.test/classes/schemes/{$scheme->id}/review", ['decision' => 'changes'])->assertSessionHasErrors('note');
    $this->post("http://schemes.ekol.test/classes/schemes/{$scheme->id}/review", ['decision' => 'changes', 'note' => 'Move vectors back to week 2.'])->assertRedirect();
    expect($scheme->fresh()->status)->toBe(SchemeStatus::ChangesRequested);

    $this->actingAs($world['teacher'])
        ->get('http://schemes.ekol.test/my-scheme')
        ->assertInertia(fn (Assert $page) => $page->where('scheme.last_note.note', 'Move vectors back to week 2.'));
    $this->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$vectors->id}", ['week' => 2]);
    $this->post("http://schemes.ekol.test/my-scheme/{$scheme->id}/submit");

    $this->actingAs($world['scienceHead'])->post("http://schemes.ekol.test/classes/schemes/{$scheme->id}/review", ['decision' => 'approve']);
    expect($scheme->fresh()->status)->toBe(SchemeStatus::Approved)
        ->and($scheme->fresh()->approved_by)->toBe($world['scienceHead']->id);
});

test('progress follows what is ticked against the weeks gone, and a change needs approval again', function () {
    $world = schemeWorld();
    physicsSyllabus($world);
    openSchemes($world, 'none');
    $scheme = physicsScheme($world);

    $this->actingAs($world['teacher'])->post("http://schemes.ekol.test/my-scheme/{$scheme->id}/submit");
    expect($scheme->fresh()->status)->toBe(SchemeStatus::Approved);

    [$units, $errors] = [$scheme->items[0], $scheme->items[1]];
    $this->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$units->id}/taught", ['taught' => true])->assertSessionHasNoErrors();

    $this->actingAs($world['principal'])
        ->get('http://schemes.ekol.test/classes/schemes?state=behind&scheme='.$scheme->id)
        ->assertInertia(fn (Assert $page) => $page
            ->component('schemes/index')
            ->where('week', 5)
            ->where('totals.behind', 1)
            ->where('rows.0.id', $scheme->id)
            ->where('rows.0.progress.taught', 1)
            ->where('rows.0.progress.planned', 3)
            ->where('rows.0.late', 2)
            ->where('rows.0.taught_total', 1)
            ->where('states.behind', 1)
            ->where('picked.late', 2)
            ->where('picked.items.0.state', 'taught'));

    $csv = $this->actingAs($world['principal'])
        ->get('http://schemes.ekol.test/classes/schemes/export?state=behind&columns=subject,class,state,taught')
        ->assertDownload()
        ->streamedContent();

    expect($csv)->toContain('Status: Behind')
        ->and($csv)->toContain('Behind');

    $this->actingAs($world['principal'])
        ->get('http://schemes.ekol.test/classes/schemes?state=on_track')
        ->assertInertia(fn (Assert $page) => $page->where('paged.total', 0));

    $this->actingAs($world['teacher'])->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$errors->id}/taught", ['taught' => true]);
    $this->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$scheme->items[2]->id}/taught", ['taught' => true]);
    expect(physicsScheme($world)->followState(5))->toBe('on_track');

    $this->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$errors->id}", ['week' => 6]);
    expect($scheme->fresh()->status)->toBe(SchemeStatus::Draft)
        ->and($scheme->fresh()->events()->where('action', 'reopened')->exists())->toBeTrue();
});

test('closing the term locks schemes, reports coverage and carries untaught topics over', function () {
    $world = schemeWorld();
    physicsSyllabus($world);
    openSchemes($world, 'none');
    $scheme = physicsScheme($world);
    $this->actingAs($world['teacher'])->post("http://schemes.ekol.test/my-scheme/{$scheme->id}/submit");
    $this->patch("http://schemes.ekol.test/my-scheme/{$scheme->id}/items/{$scheme->items[0]->id}/taught", ['taught' => true]);

    $this->actingAs($world['principal'])
        ->post('http://schemes.ekol.test/classes/schemes/close', ['open_next' => true])
        ->assertSessionHasErrors('open_next');

    $this->travelTo('2025-12-08 09:00:00');
    $this->get('http://schemes.ekol.test/classes/schemes/close?show=all')
        ->assertInertia(fn (Assert $page) => $page
            ->component('schemes/close')
            ->where('canClose', true)
            ->where('totals.carry', 2)
            ->where('rows.0.coverage', 0));

    $report = $this->get('http://schemes.ekol.test/classes/schemes/close/report')->assertOk()->streamedContent();
    expect($report)->toContain('Physics,"Form 5 A","Mr. Ngonda",1,3,33');

    $this->post('http://schemes.ekol.test/classes/schemes/close', ['open_next' => true])->assertSessionHasNoErrors();

    expect($scheme->fresh()->status)->toBe(SchemeStatus::Closed);
    $next = Scheme::where('term_id', $world['nextTerm']->id)->where('class_subject_id', $world['physicsClass']->id)->with('items')->firstOrFail();
    expect($next->items->where('carried_over', true)->map(fn (SchemeItem $item) => $item->label())->values()->all())->toBe(['Errors', 'Vectors and scalars'])
        ->and($next->items->first()->week)->toBe(1);

    $this->actingAs($world['teacher'])
        ->post("http://schemes.ekol.test/my-scheme/{$scheme->id}/items", ['topic' => 'Late', 'periods' => 1])
        ->assertSessionHasErrors('scheme');
});
