<?php

use App\Enums\AcademicYearStatus;
use App\Enums\RoomKind;
use App\Enums\SchoolCycle;
use App\Enums\TimetableStatus;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\Period;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Term;
use App\Models\TimetableChange;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A five-day school with four periods around a break, two classes in
 * their home rooms, one lab, and three teachers: Mathematics five
 * times a week, English four, Physics twice in the lab.
 *
 * @return array<string, mixed>
 */
function timetableWorld(string $slug = 'timea'): array
{
    $school = School::create([
        'name' => "Academy {$slug}", 'code' => 'GBHS', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
        'school_days' => 31,
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

    $periods = [];

    foreach ([['P1', '07:30', '08:25', false], ['P2', '08:25', '09:20', false], ['Break', '09:20', '09:40', true], ['P3', '09:40', '10:35', false], ['P4', '10:35', '11:30', false]] as $ordinal => [$label, $from, $to, $break]) {
        $periods[$label] = Period::create([
            'school_id' => $school->id, 'label' => $label, 'ordinal' => $ordinal + 1,
            'starts_at' => $from, 'ends_at' => $to, 'is_break' => $break,
        ]);
    }

    $rooms = [];

    foreach (['A1' => RoomKind::Classroom, 'A2' => RoomKind::Classroom, 'Lab 1' => RoomKind::Laboratory] as $code => $kind) {
        $rooms[$code] = Room::create([
            'school_id' => $school->id, 'code' => $code, 'name' => $code,
            'capacity' => 45, 'kind' => $kind,
        ]);
    }

    $level = Level::create([
        'school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    $classes = [];

    foreach (['Form 1 A' => 'A1', 'Form 1 B' => 'A2'] as $name => $room) {
        $classes[$name] = SchoolClass::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id,
            'name' => $name, 'capacity' => 45, 'home_room_id' => $rooms[$room]->id,
        ]);
    }

    $teachers = [];
    $subjects = [];
    $lessons = [];

    foreach ([['Mathematics', 5, 5, null], ['English', 4, 3, null], ['Physics', 2, 2, RoomKind::Laboratory]] as [$name, $weekly, $coefficient, $kind]) {
        $teachers[$name] = User::factory()->create([
            'school_id' => $school->id, 'role' => UserRole::Teacher, 'full_name' => "Mr. {$name} Teacher",
        ]);
        $subjects[$name] = Subject::create([
            'school_id' => $school->id, 'code' => strtoupper(substr($name, 0, 3)), 'name' => $name,
            'department' => 'General', 'weekly_periods' => $weekly, 'coefficient' => $coefficient, 'room_kind' => $kind,
        ]);

        foreach ($classes as $className => $class) {
            $lessons["{$name}|{$className}"] = ClassSubject::create([
                'school_id' => $school->id, 'school_class_id' => $class->id,
                'subject_id' => $subjects[$name]->id, 'staff_id' => $teachers[$name]->id, 'weekly_periods' => $weekly,
            ]);
        }
    }

    return compact('school', 'admin', 'year', 'term', 'periods', 'rooms', 'level', 'classes', 'teachers', 'subjects', 'lessons');
}

function generateTimetable(array $world, array $options = []): TimetableVersion
{
    test()->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/generate', ['options' => $options])
        ->assertSessionHasNoErrors();

    return TimetableVersion::where('term_id', $world['term']->id)->where('status', TimetableStatus::Draft)->firstOrFail();
}

test('the overview shows where the term\'s timetable stands', function () {
    $world = timetableWorld();

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('timetable/overview')
            ->where('phase.draft', 1)
            ->where('phase.live', null)
            ->where('phase.setup', true)
            ->where('phase.checks', true)
            ->where('phase.current', 'generate')
            ->where('summary.lessons', 22)
            ->where('summary.classes', 2)
            ->where('summary.teachers', 3)
            ->where('summary.rooms', 3));

    $teacher = $world['teachers']['English'];
    $this->actingAs($teacher)->get('http://timea.ekol.test/timetable')->assertForbidden();
});

test('a subject with no teacher blocks the generator', function () {
    $world = timetableWorld();
    $world['lessons']['English|Form 1 B']->update(['staff_id' => null]);

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable/checks')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('timetable/checks')
            ->where('phase.current', 'checks')
            ->where('phase.blocking', 1)
            ->where('inputs.blocking.0.title', 'English in Form 1 B has no teacher')
            ->where('inputs.blocking.0.detail', '4 lessons a week would be left out'));

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/generate', ['options' => []])
        ->assertSessionHasErrors('generate');

    expect(TimetableVersion::count())->toBe(0);
});

test('a teacher over the weekly limit is a warning, not a block', function () {
    $world = timetableWorld();
    $world['teachers']['Mathematics']->update(['max_periods_week' => 8]);

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable/checks')
        ->assertInertia(fn (Assert $page) => $page
            ->where('inputs.blocking', [])
            ->where('inputs.warnings.0.title', 'Mr. Mathematics Teacher has 10 periods a week. The limit is 8.'));
});

test('generating places every lesson without a clash', function () {
    $world = timetableWorld();
    $draft = generateTimetable($world);
    $slots = TimetableSlot::where('timetable_version_id', $draft->id)->get();

    expect($slots)->toHaveCount(22)
        ->and($draft->toFix())->toBe(0)
        ->and($draft->generated_at)->not->toBeNull();

    $unique = fn (string $column) => $slots->whereNotNull($column)
        ->map(fn (TimetableSlot $slot) => "{$slot->getAttribute($column)}|{$slot->weekday}|{$slot->period_id}");

    expect($unique('staff_id')->duplicates())->toBeEmpty()
        ->and($unique('room_id')->duplicates())->toBeEmpty()
        ->and($unique('school_class_id')->duplicates())->toBeEmpty();

    $physics = $slots->where('subject_id', $world['subjects']['Physics']->id);
    $maths = $slots->where('subject_id', $world['subjects']['Mathematics']->id);

    expect($physics->pluck('room_id')->unique()->all())->toBe([$world['rooms']['Lab 1']->id])
        ->and($maths->where('school_class_id', $world['classes']['Form 1 A']->id)->pluck('room_id')->unique()->all())
        ->toBe([$world['rooms']['A1']->id])
        ->and($maths->where('period_id', $world['periods']['P4']->id))->toBeEmpty();

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable/generate')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('timetable/generate')
            ->where('result.placed', 22)
            ->where('result.total', 22)
            ->where('result.clashes', 0)
            ->where('phase.current', 'publish'));
});

test('teaching days and closed rooms are respected', function () {
    $world = timetableWorld();
    $world['teachers']['Physics']->update([
        'teaching_days' => 3,
        'unavailable_times' => [['weekday' => 0, 'from' => 'P1', 'to' => 'P2', 'reason' => 'clinic']],
    ]);
    $world['rooms']['Lab 1']->update([
        'unavailable' => [['weekday' => 1, 'period_id' => $world['periods']['P1']->id, 'reason' => 'cleaning']],
    ]);

    $draft = generateTimetable($world);
    $physics = TimetableSlot::where('timetable_version_id', $draft->id)
        ->where('subject_id', $world['subjects']['Physics']->id)
        ->get();

    expect($physics)->toHaveCount(4)
        ->and($physics->pluck('weekday')->unique()->sort()->values()->all())->toBe([0, 1])
        ->and($physics->where('weekday', 0)->whereIn('period_id', [$world['periods']['P1']->id, $world['periods']['P2']->id]))->toBeEmpty()
        ->and($physics->where('weekday', 1)->where('period_id', $world['periods']['P1']->id))->toBeEmpty();
});

test('locked lessons stay where they are when generating again', function () {
    $world = timetableWorld();
    $draft = generateTimetable($world);
    $slot = TimetableSlot::where('timetable_version_id', $draft->id)->firstOrFail();

    $this->actingAs($world['admin'])
        ->patch("http://timea.ekol.test/timetable/slots/{$slot->id}", ['is_locked' => true])
        ->assertSessionHasNoErrors();

    generateTimetable($world, ['spread' => false]);
    $kept = TimetableSlot::whereKey($slot->id)->first();

    expect($kept)->not->toBeNull()
        ->and($kept->weekday)->toBe($slot->weekday)
        ->and($kept->period_id)->toBe($slot->period_id)
        ->and(TimetableSlot::where('timetable_version_id', $draft->id)->count())->toBe(22);
});

test('the review shows a class grid and offers free slots for a lesson', function () {
    $world = timetableWorld();
    $draft = generateTimetable($world);
    $class = $world['classes']['Form 1 A'];
    $slot = TimetableSlot::where('timetable_version_id', $draft->id)->where('school_class_id', $class->id)->firstOrFail();

    $this->actingAs($world['admin'])
        ->get("http://timea.ekol.test/timetable/review?view=class&id={$class->id}&slot={$slot->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('timetable/review')
            ->where('view', 'class')
            ->where('current.name', 'Form 1 A')
            ->where('current.detail', '11 of 11 lessons placed')
            ->has('picker', 2)
            ->has('days', 5)
            ->has('periods', 5)
            ->where('selected.id', $slot->id)
            ->where('selected.type', 'slot')
            ->has('selected.moves')
            ->where('unplaced', []));

    foreach (['teacher', 'room'] as $view) {
        $this->actingAs($world['admin'])
            ->get("http://timea.ekol.test/timetable/review?view={$view}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('view', $view)->has('picker', 3));
    }
});

test('a lesson can be taken off, placed again and moved, but not into a clash', function () {
    $world = timetableWorld();
    $draft = generateTimetable($world);
    $class = $world['classes']['Form 1 A'];
    $maths = $world['subjects']['Mathematics'];
    $slot = TimetableSlot::where('timetable_version_id', $draft->id)
        ->where('school_class_id', $class->id)->where('subject_id', $maths->id)->firstOrFail();

    $this->actingAs($world['admin'])
        ->delete("http://timea.ekol.test/timetable/slots/{$slot->id}")
        ->assertSessionHasNoErrors();

    $draft = $draft->fresh();
    expect($draft->toFix())->toBe(1);

    $this->actingAs($world['admin'])
        ->get("http://timea.ekol.test/timetable/review?id={$class->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('unplaced.0.subject', 'Mathematics')
            ->where('unplaced.0.count', 1)
            ->where('phase.to_fix', 1)
            ->where('phase.current', 'review'));

    $lesson = $world['lessons']['Mathematics|Form 1 A'];
    $times = $draft->freeTimes($lesson->load('subject'));
    expect($times)->not->toBeEmpty();

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/slots', [
            'lesson_id' => $lesson->id,
            'weekday' => $times[0]['weekday'],
            'period_id' => $times[0]['period_id'],
        ])
        ->assertSessionHasNoErrors();

    expect($draft->fresh()->toFix())->toBe(0);

    $other = TimetableSlot::where('timetable_version_id', $draft->id)
        ->where('school_class_id', $world['classes']['Form 1 B']->id)->where('subject_id', $maths->id)->firstOrFail();
    $mine = TimetableSlot::where('timetable_version_id', $draft->id)
        ->where('school_class_id', $class->id)->where('subject_id', '!=', $maths->id)->firstOrFail();

    $this->actingAs($world['admin'])
        ->patch("http://timea.ekol.test/timetable/slots/{$mine->id}", [
            'staff_id' => $world['teachers']['Mathematics']->id,
            'weekday' => $other->weekday,
            'period_id' => $other->period_id,
        ])
        ->assertSessionHasErrors('move');
});

test('publishing needs a clean draft and makes it the live version', function () {
    $world = timetableWorld();
    $draft = generateTimetable($world);
    $slot = TimetableSlot::where('timetable_version_id', $draft->id)->firstOrFail();
    $slot->delete();

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/publish', ['effective_on' => '2025-10-13'])
        ->assertSessionHasErrors('publish');

    generateTimetable($world, ['keep_placed' => true]);

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable/publish')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('timetable/publish')
            ->where('checks.placed', 22)
            ->where('checks.clashes', 0)
            ->where('diff', null));

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/publish', ['effective_on' => '2025-10-13'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('timetable'));

    $draft->refresh();
    expect($draft->status)->toBe(TimetableStatus::Live)
        ->and($draft->effective_on->toDateString())->toBe('2025-10-13')
        ->and($draft->published_by)->toBe($world['admin']->id);

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable')
        ->assertInertia(fn (Assert $page) => $page
            ->where('phase.live', 1)
            ->where('phase.draft', 2)
            ->where('phase.has_draft', false)
            ->where('live.number', 1));

    $this->actingAs($world['admin'])
        ->patch("http://timea.ekol.test/timetable/slots/{$slot->id}", ['is_locked' => true])
        ->assertSessionHasErrors('move');
});

test('the next draft starts from the live timetable and shows what changed', function () {
    $world = timetableWorld();
    generateTimetable($world);
    $this->actingAs($world['admin'])->post('http://timea.ekol.test/timetable/publish', ['effective_on' => '2025-10-13']);

    $world['lessons']['English|Form 1 A']->update(['weekly_periods' => 5]);
    $draft = generateTimetable($world, ['keep_placed' => true]);

    expect($draft->number)->toBe(2)
        ->and(TimetableSlot::where('timetable_version_id', $draft->id)->count())->toBe(23)
        ->and(TimetableVersion::where('status', TimetableStatus::Live)->firstOrFail()->slots()->count())->toBe(22);

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable/publish')
        ->assertInertia(fn (Assert $page) => $page
            ->where('diff.from', 1)
            ->where('diff.added', 1)
            ->where('diff.added_subjects', ['English (1)'])
            ->where('diff.moved', 0)
            ->where('diff.classes', 1));
});

test('rooms can be added, changed and retired', function () {
    $world = timetableWorld();

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/rooms', [
            'code' => 'Computer room', 'kind' => 'computer', 'capacity' => 30, 'unavailable' => [],
        ])
        ->assertSessionHasNoErrors();

    $room = Room::where('code', 'Computer room')->firstOrFail();
    expect($room->kind)->toBe(RoomKind::Computer);

    $lab = $world['rooms']['Lab 1'];
    $this->actingAs($world['admin'])
        ->patch("http://timea.ekol.test/timetable/rooms/{$lab->id}", [
            'code' => 'Lab 1', 'kind' => 'laboratory', 'capacity' => 30,
            'unavailable' => [['weekday' => 4, 'period_id' => $world['periods']['P4']->id, 'reason' => 'cleaning']],
            'subject_ids' => [$world['subjects']['English']->id],
        ])
        ->assertSessionHasNoErrors();

    expect($lab->refresh()->capacity)->toBe(30)
        ->and($lab->unavailable[0]['reason'])->toBe('cleaning')
        ->and($world['subjects']['English']->refresh()->room_kind)->toBe(RoomKind::Laboratory)
        ->and($world['subjects']['Physics']->refresh()->room_kind)->toBeNull();

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable/rooms')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('timetable/rooms')
            ->has('rooms', 4)
            ->where('slotsAWeek', 20));

    $this->actingAs($world['admin'])
        ->delete("http://timea.ekol.test/timetable/rooms/{$world['rooms']['A1']->id}")
        ->assertRedirect(route('timetable.rooms'));

    expect(Room::whereKey($world['rooms']['A1']->id)->exists())->toBeFalse()
        ->and($world['classes']['Form 1 A']->refresh()->home_room_id)->toBeNull();
});

test('a cover is suggested from free teachers and logged against the live version', function () {
    $world = timetableWorld();
    generateTimetable($world);

    $this->actingAs($world['admin'])
        ->get('http://timea.ekol.test/timetable/changes')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('timetable/changes')->where('live', null));

    $this->actingAs($world['admin'])->post('http://timea.ekol.test/timetable/publish', ['effective_on' => '2025-10-13']);
    $live = TimetableVersion::where('status', TimetableStatus::Live)->firstOrFail();
    $away = $world['teachers']['Mathematics'];
    $lesson = $live->slots->where('staff_id', $away->id)->where('weekday', 0)->first();

    $response = $this->actingAs($world['admin'])
        ->get("http://timea.ekol.test/timetable/changes?teacher={$away->id}&date=2025-10-13")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('live', 1)
            ->where('mode', 'cover')
            ->where('isSchoolDay', true)
            ->has('lessons.0.covers'));

    $cover = $response->viewData('page')['props']['lessons'][0]['covers'][0];

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/changes', [
            'kind' => 'cover',
            'date' => '2025-10-13',
            'covers' => [['slot_id' => $lesson->id, 'staff_id' => $cover['id']]],
        ])
        ->assertSessionHasNoErrors();

    $change = TimetableChange::firstOrFail();

    expect($change->kind)->toBe('cover')
        ->and($change->staff_id)->toBe($cover['id'])
        ->and($change->starts_on->toDateString())->toBe('2025-10-13')
        ->and($change->summary)->toContain('for Mr. Mathematics Teacher')
        ->and($change->summary)->toContain('supervised study');
});

test('a room change and a swap are recorded for a day or a week', function () {
    $world = timetableWorld();
    generateTimetable($world);
    $this->actingAs($world['admin'])->post('http://timea.ekol.test/timetable/publish', ['effective_on' => '2025-10-13']);
    $live = TimetableVersion::where('status', TimetableStatus::Live)->firstOrFail();
    $class = $world['classes']['Form 1 A'];
    [$first, $second] = $live->slots->where('school_class_id', $class->id)->values()->all();

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/changes', [
            'kind' => 'room', 'date' => '2025-10-15', 'whole_week' => true,
            'slot_id' => $first->id, 'room_id' => $world['rooms']['A2']->id,
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($world['admin'])
        ->post('http://timea.ekol.test/timetable/changes', [
            'kind' => 'swap', 'date' => '2025-10-15',
            'slot_id' => $first->id, 'other_slot_id' => $second->id,
        ])
        ->assertSessionHasNoErrors();

    $room = TimetableChange::where('kind', 'room')->firstOrFail();
    $swap = TimetableChange::where('kind', 'swap')->firstOrFail();

    expect($room->starts_on->toDateString())->toBe('2025-10-13')
        ->and($room->ends_on->toDateString())->toBe('2025-10-19')
        ->and($room->summary)->toContain('to A2 for the week')
        ->and($swap->other_slot_id)->toBe($second->id)
        ->and($swap->starts_on->toDateString())->toBe('2025-10-15');

    $this->actingAs($world['admin'])
        ->get("http://timea.ekol.test/timetable/changes?mode=swap&class={$class->id}")
        ->assertInertia(fn (Assert $page) => $page->where('mode', 'swap')->has('slots', 11)->has('recent', 2));
});
