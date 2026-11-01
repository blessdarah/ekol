<?php

use App\Enums\AcademicYearStatus;
use App\Enums\SchemeStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Http\SchemePageData;
use App\Models\AcademicYear;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\Scheme;
use App\Models\SchemeItem;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/** @return array{school: School, admin: User, term: Term, opening: SchemeOpening, level: Level, class: SchoolClass} */
function schemeListWorld(string $slug = 'scheme-lists'): array
{
    test()->travelTo('2025-10-01 09:00:00');
    $school = School::create([
        'name' => 'Scheme List Academy '.$slug, 'code' => $slug === 'scheme-lists' ? 'SLA' : 'OTHER', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $year = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26', 'starts_on' => '2025-09-01',
        'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current,
    ]);
    $term = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1,
        'starts_on' => '2025-09-01', 'ends_on' => '2025-12-12', 'week_count' => 15, 'is_current' => true,
    ]);
    $opening = SchemeOpening::create([
        'school_id' => $school->id, 'term_id' => $term->id, 'due_on' => '2025-09-19',
        'approval' => SchemeOpening::HEAD_OF_DEPARTMENT, 'starts_from' => 'syllabus', 'free_changes' => false,
    ]);
    $level = Level::create(['school_id' => $school->id, 'name' => 'Form 5', 'ordinal' => 5, 'cycle' => SchoolCycle::Secondary]);
    $class = SchoolClass::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => 'Form 5 A', 'capacity' => 40]);

    return compact('school', 'admin', 'term', 'opening', 'level', 'class');
}

/** @param array{school: School, term: Term, class: SchoolClass} $world */
function schemeListRecord(array $world, string $name, SchemeStatus $status, ?User $teacher, string $department = 'Sciences'): Scheme
{
    $subject = Subject::create([
        'school_id' => $world['school']->id, 'code' => $name, 'name' => $name,
        'department' => $department, 'weekly_periods' => 4,
    ]);
    $classSubject = ClassSubject::create([
        'school_id' => $world['school']->id, 'subject_id' => $subject->id,
        'school_class_id' => $world['class']->id, 'staff_id' => $teacher?->id, 'weekly_periods' => 4,
    ]);

    return Scheme::create([
        'school_id' => $world['school']->id, 'term_id' => $world['term']->id,
        'class_subject_id' => $classSubject->id, 'status' => $status,
    ]);
}

test('scheme list paginates SQL summaries without hydrating item records', function () {
    $world = schemeListWorld();
    for ($index = 1; $index <= 27; $index++) {
        $scheme = schemeListRecord($world, sprintf('Subject %02d', $index), SchemeStatus::Approved, $world['admin']);
        $scheme->items()->create(['position' => 1, 'topic' => 'Introduction', 'week' => 1, 'periods' => 2]);
    }
    $retrieved = 0;
    SchemeItem::retrieved(function () use (&$retrieved): void {
        $retrieved++;
    });

    $this->actingAs($world['admin'])->get('http://scheme-lists.ekol.test/classes/schemes?sort=subject&page=2')
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('paged.total', 27)->where('paged.page', 2)->where('paged.lastPage', 2)
        ->where('paged.from', 26)->where('paged.to', 27)->has('rows', 2)
        ->where('rows.0.subject', 'Subject 26')->where('rows.1.subject', 'Subject 27')
        ->where('rows.0.state', 'behind')->where('rows.0.progress.planned', 1)
        ->where('rows.0.late', 1)->where('totals.behind', 27));

    expect($retrieved)->toBe(0);
});

test('scheme summary states and progress retain precedence and week boundaries', function () {
    $world = schemeListWorld();
    $cases = [
        ['Closed', SchemeStatus::Closed, null, 'closed'],
        ['Unstaffed', SchemeStatus::Submitted, null, 'waiting'],
        ['Submitted', SchemeStatus::Submitted, $world['admin'], 'to_approve'],
        ['Returned', SchemeStatus::ChangesRequested, $world['admin'], 'sent_back'],
        ['Draft', SchemeStatus::Draft, $world['admin'], 'not_submitted'],
        ['Behind', SchemeStatus::Approved, $world['admin'], 'behind'],
        ['Current', SchemeStatus::Approved, $world['admin'], 'on_track'],
    ];
    foreach ($cases as [$name, $status, $teacher]) {
        $scheme = schemeListRecord($world, $name, $status, $teacher);
        $scheme->items()->create(['position' => 1, 'topic' => 'Old topic', 'week' => $name === 'Current' ? 5 : 4, 'periods' => 2]);
        $scheme->items()->create(['position' => 2, 'topic' => 'Taught topic', 'week' => 3, 'periods' => 2, 'taught_on' => '2025-09-15']);
        $scheme->items()->create(['position' => 3, 'topic' => 'Future topic', 'week' => 6, 'periods' => 2]);
        $scheme->items()->create(['position' => 4, 'topic' => 'Unplaced topic', 'week' => null, 'periods' => 2]);
    }

    $rows = (new SchemePageData)->query($world['term'], 5)->get()->keyBy('subject');

    expect($rows->map(fn ($row) => $row->state)->sortKeys()->all())->toBe([
        'Behind' => 'behind', 'Closed' => 'closed', 'Current' => 'on_track', 'Draft' => 'not_submitted',
        'Returned' => 'sent_back', 'Submitted' => 'to_approve', 'Unstaffed' => 'waiting',
    ])->and((int) $rows['Behind']->topics)->toBe(4)
        ->and((int) $rows['Behind']->planned)->toBe(2)
        ->and((int) $rows['Behind']->taught)->toBe(1)
        ->and((int) $rows['Behind']->late)->toBe(1)
        ->and((int) $rows['Current']->late)->toBe(0);
    $beforeTerm = (new SchemePageData)->query($world['term'], null)->where('subject', 'Behind')->first();
    expect($beforeTerm->state)->toBe('on_track')
        ->and((int) $beforeTerm->planned)->toBe(0)
        ->and((int) $beforeTerm->late)->toBe(0);
});

test('scheme list and picked drawer keep department and tenant authorization', function () {
    $world = schemeListWorld();
    $head = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::HeadOfDepartment]);
    $science = schemeListRecord($world, 'Physics', SchemeStatus::Submitted, $head);
    $languages = schemeListRecord($world, 'French', SchemeStatus::Submitted, $world['admin'], 'Languages');
    $other = schemeListWorld('another-scheme-list');
    $foreign = schemeListRecord($other, 'Foreign subject', SchemeStatus::Submitted, $other['admin']);

    $this->actingAs($head)->get('http://scheme-lists.ekol.test/classes/schemes?scheme='.$languages->id)
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('totals.all', 1)->has('rows', 1)->where('rows.0.id', $science->id)
        ->where('departments', ['Sciences'])->where('picked', null));
    $this->get('http://scheme-lists.ekol.test/classes/schemes?scheme='.$foreign->id)
        ->assertOk()->assertInertia(fn (Assert $page) => $page->where('picked', null)->where('totals.all', 1));
    $world['opening']->update(['approval' => SchemeOpening::PRINCIPAL]);
    $this->get('http://scheme-lists.ekol.test/classes/schemes')
        ->assertOk()->assertInertia(fn (Assert $page) => $page->where('totals.all', 0)->has('rows', 0));
});

test('scheme filters preserve literal search and selected exports stay authorized', function () {
    $world = schemeListWorld();
    $head = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::HeadOfDepartment]);
    $matching = schemeListRecord($world, 'Physics_100%', SchemeStatus::Submitted, $head);
    schemeListRecord($world, 'Physics 1000', SchemeStatus::Submitted, $head);
    $hidden = schemeListRecord($world, 'French', SchemeStatus::Submitted, $world['admin'], 'Languages');

    $this->actingAs($head)->get('http://scheme-lists.ekol.test/classes/schemes?q='.urlencode('_100%').'&state=to_approve&department=Sciences&level='.$world['level']->id)
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('paged.total', 1)->where('rows.0.id', $matching->id)->where('totals.all', 2));
    $csv = $this->get('http://scheme-lists.ekol.test/classes/schemes/export?ids='.$matching->id.','.$hidden->id.'&columns=subject,state')
        ->assertDownload()->streamedContent();

    expect($csv)->toContain('Physics_100%')->not->toContain('Physics 1000')->not->toContain('French');
});

test('scheme filter options omit deleted levels', function () {
    $world = schemeListWorld();
    schemeListRecord($world, 'Science', SchemeStatus::Approved, $world['admin']);
    $world['level']->delete();

    $this->actingAs($world['admin'])->get('http://scheme-lists.ekol.test/classes/schemes')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('rows', 1)->has('levels', 0));
});
