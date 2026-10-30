<?php

use App\Enums\AcademicYearStatus;
use App\Enums\AssessmentState;
use App\Enums\EnrolmentDecision;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\ClassSubject;
use App\Models\Enrolment;
use App\Models\ExamPaper;
use App\Models\GradeBand;
use App\Models\Level;
use App\Models\Mark;
use App\Models\MarkCorrection;
use App\Models\Room;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A school on 1 October 2025, in Term 1: one class of three students
 * taking Mathematics (coefficient 4) and English (coefficient 2), each
 * with its own teacher.
 *
 * @return array<string, mixed>
 */
function examWorld(string $slug = 'exama'): array
{
    test()->travelTo('2025-10-01 09:00:00');

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
        'school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    $class = SchoolClass::create([
        'school_id' => $school->id, 'academic_year_id' => $year->id,
        'level_id' => $level->id, 'name' => 'Form 1 A', 'capacity' => 40,
    ]);

    $students = [];

    foreach (['Achu Brandon', 'Bih Glory', 'Che Emmanuel'] as $index => $name) {
        $students[] = $student = Student::create([
            'school_id' => $school->id, 'admission_no' => 'GBHS-25-000'.($index + 1),
            'full_name' => $name, 'gender' => 'male', 'date_of_birth' => '2013-01-01',
            'guardian_name' => 'G', 'guardian_phone' => '+23767000000'.$index, 'admitted_on' => '2025-09-01',
        ]);
        Enrolment::create([
            'student_id' => $student->id, 'academic_year_id' => $year->id,
            'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled,
        ]);
    }

    $subjects = [];
    $teachers = [];

    foreach ([['Mathematics', 4], ['English', 2]] as [$name, $coefficient]) {
        $teachers[$name] = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Teacher]);
        $subjects[$name] = Subject::create([
            'school_id' => $school->id, 'code' => strtoupper(substr($name, 0, 3)), 'name' => $name,
            'department' => 'General', 'weekly_periods' => 4, 'coefficient' => $coefficient,
        ]);
        ClassSubject::create([
            'school_id' => $school->id, 'school_class_id' => $class->id,
            'subject_id' => $subjects[$name]->id, 'staff_id' => $teachers[$name]->id, 'weekly_periods' => 4,
        ]);
    }

    return compact('school', 'admin', 'year', 'term', 'level', 'class', 'students', 'subjects', 'teachers');
}

function planPayload(array $world, array $overrides = []): array
{
    return array_merge([
        'name' => 'Sequence 1',
        'kind' => 'sequence',
        'term_id' => $world['term']->id,
        'held_from' => '2025-09-15',
        'held_until' => '2025-09-26',
        'window_starts_on' => '2025-09-15',
        'window_ends_on' => '2025-10-08',
        'level_ids' => [$world['level']->id],
        'schedule' => true,
    ], $overrides);
}

function schedulePlan(array $world, array $overrides = []): AssessmentPlan
{
    test()->actingAs($world['admin'])
        ->post('http://exama.ekol.test/assessments', planPayload($world, $overrides))
        ->assertSessionHasNoErrors();

    return AssessmentPlan::where('name', $overrides['name'] ?? 'Sequence 1')->firstOrFail();
}

function sheetFor(AssessmentPlan $plan, Subject $subject): AssessmentSubject
{
    return AssessmentSubject::where('subject_id', $subject->id)
        ->whereHas('assessment', fn ($query) => $query->where('assessment_plan_id', $plan->id))
        ->firstOrFail();
}

/**
 * @param  array<int, float|null>  $scores
 */
function enterMarks(array $world, AssessmentPlan $plan, string $subject, array $scores, bool $submit = true): void
{
    $sheet = sheetFor($plan, $world['subjects'][$subject]);

    test()->actingAs($world['teachers'][$subject])
        ->patch("http://exama.ekol.test/assessments/sheets/{$sheet->id}", [
            'submit' => $submit,
            'marks' => array_map(fn (int $index) => [
                'student_id' => $world['students'][$index]->id,
                'score' => $scores[$index],
                'absent' => false,
                'remark' => null,
            ], array_keys($scores)),
        ])
        ->assertSessionHasNoErrors();
}

test('a term can start with the usual three drafts', function () {
    $world = examWorld();

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/terms/{$world['term']->id}/usual")
        ->assertSessionHasNoErrors();

    expect(AssessmentPlan::orderBy('name')->pluck('name')->all())->toBe(['Sequence 1', 'Sequence 2', 'Term 1 exam'])
        ->and(AssessmentPlan::where('state', AssessmentState::Draft)->count())->toBe(3);

    $this->actingAs($world['admin'])
        ->get('http://exama.ekol.test/assessments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/calendar')
            ->where('counts.draft', 3)
            ->has('terms.0.plans', 3));

    $this->actingAs($world['teachers']['English'])
        ->get('http://exama.ekol.test/assessments')
        ->assertRedirect(route('assessments.sheets'));
});

test('scheduling makes a mark sheet per class and subject and opens marks when the window starts', function () {
    $world = examWorld();
    $plan = schedulePlan($world);

    expect($plan->state)->toBe(AssessmentState::MarksOpen)
        ->and($plan->assessments()->count())->toBe(1)
        ->and(AssessmentSubject::count())->toBe(2)
        ->and(sheetFor($plan, $world['subjects']['Mathematics'])->examiner_id)->toBe($world['teachers']['Mathematics']->id)
        ->and((float) sheetFor($plan, $world['subjects']['Mathematics'])->coefficient->sequence_coeff)->toBe(4.0);

    $later = schedulePlan($world, [
        'name' => 'Sequence 2', 'held_from' => '2025-11-10', 'held_until' => '2025-11-21',
        'window_starts_on' => '2025-11-10', 'window_ends_on' => '2025-11-24',
    ]);

    expect($later->state)->toBe(AssessmentState::Scheduled);

    $this->actingAs($world['admin'])
        ->post('http://exama.ekol.test/assessments', planPayload($world, ['name' => 'Bad dates', 'window_ends_on' => '2025-09-20']))
        ->assertSessionHasErrors('window_ends_on');
    $this->actingAs($world['admin'])
        ->post('http://exama.ekol.test/assessments', planPayload($world))
        ->assertSessionHasErrors('name');
});

test('a teacher fills and submits only her own sheet, within the limits', function () {
    $world = examWorld();
    $plan = schedulePlan($world);
    $sheet = sheetFor($plan, $world['subjects']['Mathematics']);
    $row = fn (int $index, mixed $score) => ['student_id' => $world['students'][$index]->id, 'score' => $score, 'absent' => false, 'remark' => null];

    $this->actingAs($world['teachers']['English'])
        ->get("http://exama.ekol.test/assessments/sheets/{$sheet->id}")
        ->assertForbidden();

    $this->actingAs($world['teachers']['Mathematics'])
        ->patch("http://exama.ekol.test/assessments/sheets/{$sheet->id}", ['marks' => [$row(0, 23)]])
        ->assertSessionHasErrors('marks.0.score');

    $this->actingAs($world['teachers']['Mathematics'])
        ->patch("http://exama.ekol.test/assessments/sheets/{$sheet->id}", ['submit' => true, 'marks' => [$row(0, 13.5), $row(1, 7.25)]])
        ->assertSessionHasErrors('marks');

    $this->actingAs($world['teachers']['Mathematics'])
        ->patch("http://exama.ekol.test/assessments/sheets/{$sheet->id}", ['marks' => [$row(0, 13.5), $row(1, 7.25)]])
        ->assertSessionHasNoErrors();

    expect((float) Mark::where('student_id', $world['students'][1]->id)->value('score'))->toBe(7.25)
        ->and($sheet->refresh()->submitted_at)->toBeNull();

    $this->actingAs($world['teachers']['Mathematics'])
        ->get("http://exama.ekol.test/assessments/sheets/{$sheet->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/sheet')
            ->where('open', true)
            ->where('rows.0.score', 13.5)
            ->where('rows.2.score', null)
            ->has('rows', 3));

    $this->actingAs($world['teachers']['Mathematics'])
        ->get('http://exama.ekol.test/assessments/sheets')
        ->assertInertia(fn (Assert $page) => $page->component('assessments/sheets')->has('sheets', 1)->where('sheets.0.entered', 2));
});

test('a submitted sheet points to the next one: the class from Marks progress, a teacher\'s own otherwise', function () {
    $world = examWorld();
    $plan = schedulePlan($world);
    $maths = sheetFor($plan, $world['subjects']['Mathematics']);
    $english = sheetFor($plan, $world['subjects']['English']);
    enterMarks($world, $plan, 'Mathematics', [12, 14, 9]);

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/assessments/sheets/{$maths->id}?from=progress")
        ->assertInertia(fn (Assert $page) => $page
            ->where('next.mode', 'class')
            ->where('next.plan_id', $plan->id)
            ->where('next.total', 2)
            ->where('next.submitted', 1)
            ->where('next.missing', ['English'])
            ->where('next.sheet.id', $english->id)
            ->where('next.sheet.subject', 'English'));

    $this->actingAs($world['teachers']['Mathematics'])
        ->get("http://exama.ekol.test/assessments/sheets/{$maths->id}?from=progress")
        ->assertInertia(fn (Assert $page) => $page
            ->where('next.mode', 'mine')
            ->where('next.total', 1)
            ->where('next.submitted', 1)
            ->where('next.sheet', null));

    $english->update(['examiner_id' => $world['teachers']['Mathematics']->id]);

    $this->actingAs($world['teachers']['Mathematics'])
        ->get("http://exama.ekol.test/assessments/sheets/{$maths->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('next.mode', 'mine')
            ->where('next.total', 2)
            ->where('next.missing', ['Form 1 A'])
            ->where('next.sheet.id', $english->id));
});

test('progress follows the sheets, and closing marks entry stops teachers', function () {
    $world = examWorld();
    $plan = schedulePlan($world);
    enterMarks($world, $plan, 'Mathematics', [14, 10, 8]);

    $this->actingAs($world['admin'])
        ->get('http://exama.ekol.test/assessments/progress')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/progress')
            ->where('plan.name', 'Sequence 1')
            ->where('stats.submitted', 1)
            ->where('stats.total', 2)
            ->where('stats.teachers', 1)
            ->where('tabs.missing', 1)
            ->where('classes.0.missing.0.subject', 'English')
            ->has('teachers', 1)
            ->where('teachers.0.missing.0.subject', 'English')
            ->where('teachers.0.missing.0.students', fn (int $students) => $students > 0));

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/{$plan->id}/close")
        ->assertRedirect(route('assessments.results', ['plan' => $plan->id]));

    expect($plan->refresh()->state)->toBe(AssessmentState::MarksClosed);

    $sheet = sheetFor($plan, $world['subjects']['English']);
    $this->actingAs($world['teachers']['English'])
        ->patch("http://exama.ekol.test/assessments/sheets/{$sheet->id}", ['marks' => []])
        ->assertSessionHasErrors('marks');

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/{$plan->id}/window", ['window_ends_on' => '2025-10-10'])
        ->assertSessionHasNoErrors();

    expect($plan->refresh()->state)->toBe(AssessmentState::MarksOpen)
        ->and($plan->window_ends_on->toDateString())->toBe('2025-10-10');
});

test('results weight marks by coefficient, rank ties together and leave out missing marks', function () {
    $world = examWorld();
    $plan = schedulePlan($world);
    enterMarks($world, $plan, 'Mathematics', [14, 14, 8]);
    enterMarks($world, $plan, 'English', [11, 11, null], false);
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$plan->id}/close");

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/assessments/results?plan={$plan->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/results')
            ->where('rows.0.average', 13)
            ->where('rows.0.rank', 1)
            ->where('rows.1.rank', 1)
            ->where('rows.2.name', 'Che Emmanuel')
            ->where('rows.2.rank', null)
            ->where('rows.2.average', 8)
            ->where('rows.2.missing', ['English'])
            ->where('missing', 1)
            ->where('stats.highest', 13));

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/{$plan->id}/publish")
        ->assertRedirect(route('assessments.reports', ['plan' => $plan->id]));

    expect($plan->refresh()->state)->toBe(AssessmentState::Published)
        ->and($plan->published_by)->toBe($world['admin']->id);

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/{$plan->id}/publish")
        ->assertSessionHasErrors('publish');
});

test('the term average is the mean of its published assessments and feeds report cards', function () {
    $world = examWorld();
    $first = schedulePlan($world);
    enterMarks($world, $first, 'Mathematics', [16, 10, 8]);
    enterMarks($world, $first, 'English', [16, 10, 8]);
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$first->id}/close");
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$first->id}/publish");

    $second = schedulePlan($world, ['name' => 'Sequence 2', 'held_from' => '2025-09-22', 'held_until' => '2025-09-26', 'window_starts_on' => '2025-09-22']);
    enterMarks($world, $second, 'Mathematics', [12, 12, 10]);
    enterMarks($world, $second, 'English', [12, 12, 10]);
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$second->id}/close");
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$second->id}/publish");

    $this->actingAs($world['admin'])
        ->get('http://exama.ekol.test/assessments/term')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/term')
            ->where('term.complete', true)
            ->has('columns', 2)
            ->where('rows.0.name', 'Achu Brandon')
            ->where('rows.0.average', 14)
            ->where('rows.0.rank', 1)
            ->where('rows.1.average', 11)
            ->where('rows.2.average', 9));

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/assessments/reports?plan={$first->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/reports')
            ->where('school.code', 'GBHS')
            ->where('scope.label', 'Sequence 1 report')
            ->where('classes.0.pupils', 3)
            ->where('preview.name', 'Achu Brandon')
            ->where('preview.average', 16)
            ->where('preview.position', 1)
            ->where('preview.grade', 'A · Excellent')
            ->has('preview.subjects', 2));

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/assessments/reports/print?term={$world['term']->id}&class={$world['class']->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/report-print')
            ->has('cards', 3)
            ->where('cards.0.average', 14)
            ->where('cards.0.subjects.0.score', 14));
});

test('a term card shows each assessment, weighted marks, subject places and the class spread', function () {
    $world = examWorld();
    $world['school']->update(['motto' => 'Knowledge and service']);
    $world['class']->update(['form_master_id' => $world['teachers']['English']->id]);
    User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Principal, 'full_name' => 'Eposi Fonkem']);

    foreach ([['Sequence 1', '2025-09-15', [16, 10, 8]], ['Sequence 2', '2025-09-22', [12, 12, 10]]] as [$name, $from, $scores]) {
        $plan = schedulePlan($world, ['name' => $name, 'held_from' => $from, 'held_until' => $from, 'window_starts_on' => $from]);
        enterMarks($world, $plan, 'Mathematics', $scores);
        enterMarks($world, $plan, 'English', $scores);
        $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$plan->id}/close");
        $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$plan->id}/publish");
    }

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/assessments/reports/print?term={$world['term']->id}&class={$world['class']->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/report-print')
            ->where('issuer.motto', 'Knowledge and service')
            ->has('cards.0.columns', 2)
            ->where('cards.0.subjects.0.subject', 'English')
            ->where('cards.0.subjects.0.scores', [16, 12])
            ->where('cards.0.subjects.0.points', 28)
            ->where('cards.0.subjects.0.rank', 1)
            ->where('cards.0.total_coefficient', 6)
            ->where('cards.0.total_points', 84)
            ->where('cards.0.spread.highest', 14)
            ->where('cards.0.spread.lowest', 9)
            ->where('cards.0.glance.kind', 'year')
            ->where('cards.0.glance.total.average', 14)
            ->where('cards.0.class_master', $world['teachers']['English']->full_name)
            ->where('cards.0.principal', 'Eposi Fonkem'));
});

test('the year\'s last cards wait for every decision, then print it on each card', function () {
    $world = examWorld();
    $next = Level::create([
        'school_id' => $world['school']->id, 'name' => 'Form 2', 'code' => 'F2', 'ordinal' => 2,
        'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false,
    ]);
    AcademicYear::create([
        'school_id' => $world['school']->id, 'label' => '2026/27',
        'starts_on' => '2026-09-01', 'ends_on' => '2027-07-31', 'status' => AcademicYearStatus::Planned,
    ]);
    $plan = schedulePlan($world);
    enterMarks($world, $plan, 'Mathematics', [16, 10, 8]);
    enterMarks($world, $plan, 'English', [16, 10, 8]);
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$plan->id}/close");
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$plan->id}/publish");

    $decide = fn (int $student, EnrolmentDecision $decision) => Enrolment::where('student_id', $world['students'][$student]->id)
        ->update(['decision' => $decision]);
    $decide(0, EnrolmentDecision::Promote);
    $decide(1, EnrolmentDecision::Repeat);
    $print = "http://exama.ekol.test/assessments/reports/print?term={$world['term']->id}&class={$world['class']->id}";

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/assessments/reports?term={$world['term']->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('closesYear', true)
            ->where('classes.0.undecided', 1));

    $this->actingAs($world['admin'])->get($print)
        ->assertRedirect(route('assessments.reports', ['term' => $world['term']->id, 'class' => $world['class']->id]));

    $decide(2, EnrolmentDecision::Leaving);

    $this->actingAs($world['admin'])->get($print)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('cards.0.outcome', ['kind' => 'promoted', 'level' => $next->name])
            ->where('cards.1.outcome', ['kind' => 'repeats', 'level' => 'Form 1'])
            ->where('cards.2.outcome', ['kind' => 'leaving', 'level' => null]));
});

test('a published mark changes only through an approved correction', function () {
    $world = examWorld();
    $plan = schedulePlan($world);
    enterMarks($world, $plan, 'Mathematics', [14, 12, 8]);
    enterMarks($world, $plan, 'English', [10, 12, 8]);
    $mark = Mark::where('student_id', $world['students'][0]->id)
        ->where('assessment_subject_id', sheetFor($plan, $world['subjects']['English'])->id)->firstOrFail();
    $ask = fn (User $by, array $overrides = []) => $this->actingAs($by)
        ->post('http://exama.ekol.test/assessments/corrections', array_merge(['mark_id' => $mark->id, 'new_score' => 16, 'reason' => 'Question 4 marked twice'], $overrides));

    $ask($world['teachers']['English'])->assertSessionHasErrors('new_score');

    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$plan->id}/close");
    $this->actingAs($world['admin'])->post("http://exama.ekol.test/assessments/{$plan->id}/publish");

    $ask($world['teachers']['Mathematics'])->assertForbidden();
    $ask($world['teachers']['English'], ['new_score' => 25])->assertSessionHasErrors('new_score');
    $ask($world['teachers']['English'])->assertSessionHasNoErrors();
    $ask($world['teachers']['English'])->assertSessionHasErrors('new_score');

    $correction = MarkCorrection::firstOrFail();
    expect($correction->reference)->toBe('C-001')
        ->and((float) $mark->fresh()->score)->toBe(10.0);

    $this->actingAs($world['admin'])
        ->get('http://exama.ekol.test/assessments/corrections')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/corrections')
            ->where('counts.pending', 1)
            ->where('tabs.pending', 1)
            ->where('current.old', 10)
            ->where('current.new', 16)
            ->where('current.impact.average_from', 12.67)
            ->where('current.impact.average_to', 14.67)
            ->where('current.impact.position_from', 1)
            ->where('current.impact.position_to', 1));

    $lead = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::AcademicLead]);
    $this->actingAs($lead)
        ->post("http://exama.ekol.test/assessments/corrections/{$correction->id}/decision", ['decision' => 'approve'])
        ->assertForbidden();

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/corrections/{$correction->id}/decision", ['decision' => 'approve', 'note' => 'Checked'])
        ->assertSessionHasNoErrors();

    expect((float) $mark->fresh()->score)->toBe(16.0)
        ->and($correction->refresh()->status)->toBe('approved')
        ->and($correction->decided_by)->toBe($world['admin']->id);
});

test('the grading scale must cover zero to twenty with no gap', function () {
    $world = examWorld();
    $bands = [
        ['letter' => 'A', 'from' => 15, 'to' => 20, 'meaning' => 'Very good', 'remark' => 'Very good.'],
        ['letter' => 'B', 'from' => 10, 'to' => 14.99, 'meaning' => 'Pass', 'remark' => 'Passed.'],
        ['letter' => 'C', 'from' => 0, 'to' => 9.99, 'meaning' => 'Fail', 'remark' => 'More work needed.'],
    ];

    $this->actingAs($world['admin'])
        ->get('http://exama.ekol.test/assessments/grading')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/grading')
            ->where('passMark', 10)
            ->where('isStandard', true)
            ->has('bands', 6));

    $gap = $bands;
    $gap[1]['to'] = 14;
    $this->actingAs($world['admin'])
        ->put('http://exama.ekol.test/assessments/grading', ['pass_mark' => 10, 'bands' => $gap])
        ->assertSessionHasErrors('bands');

    $this->actingAs($world['admin'])
        ->put('http://exama.ekol.test/assessments/grading', ['pass_mark' => 12, 'bands' => $bands])
        ->assertSessionHasNoErrors();

    expect((float) $world['school']->fresh()->pass_mark)->toBe(12.0)
        ->and(GradeBand::count())->toBe(3)
        ->and(GradeBand::forScore($world['school']->id, 14.99)['letter'])->toBe('B')
        ->and(GradeBand::forScore($world['school']->id, 15)['letter'])->toBe('A');
});

test('an exam schedule needs a paper per subject and no clash before it is published', function () {
    $world = examWorld();
    $plan = schedulePlan($world, [
        'name' => 'Term 1 exam', 'kind' => 'exam', 'held_from' => '2025-12-08', 'held_until' => '2025-12-12',
        'window_starts_on' => '2025-12-08', 'window_ends_on' => '2025-12-16',
    ]);
    $hall = Room::create(['school_id' => $world['school']->id, 'code' => 'Hall A', 'name' => 'Hall A', 'capacity' => 300, 'kind' => 'hall']);
    $paper = fn (string $subject, array $overrides = []) => $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/schedule/{$plan->id}/papers", array_merge([
            'level_id' => $world['level']->id, 'subject_id' => $world['subjects'][$subject]->id,
            'held_on' => '2025-12-08', 'starts_at' => '08:00', 'hours' => 2,
            'room_id' => $hall->id, 'invigilator_ids' => [$world['teachers'][$subject]->id],
        ], $overrides));

    $paper('Mathematics', ['held_on' => '2025-12-20'])->assertSessionHasErrors('held_on');
    $paper('Mathematics')->assertSessionHasNoErrors();

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/schedule/{$plan->id}/publish")
        ->assertSessionHasErrors('publish');

    $paper('English', ['starts_at' => '09:00'])->assertSessionHasNoErrors();

    $this->actingAs($world['admin'])
        ->get('http://exama.ekol.test/assessments/schedule')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('assessments/schedule')
            ->where('plan.name', 'Term 1 exam')
            ->has('rows', 2)
            ->has('clashes', 1)
            ->where('tabs.clashes', 1)
            ->where('unset', 0));

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/schedule/{$plan->id}/publish")
        ->assertSessionHasErrors('publish');

    $paper('English', ['starts_at' => '11:00'])->assertSessionHasNoErrors();

    $this->actingAs($world['admin'])
        ->post("http://exama.ekol.test/assessments/schedule/{$plan->id}/publish")
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('assessments'));

    expect(ExamPaper::count())->toBe(2)
        ->and($plan->refresh()->schedule_published_at)->not->toBeNull();
});

test('the student academics tab shows marks, average and position for the term', function () {
    $world = examWorld();
    $plan = schedulePlan($world);
    enterMarks($world, $plan, 'Mathematics', [16, 10, 8]);
    enterMarks($world, $plan, 'English', [13, 10, null], false);
    schedulePlan($world, [
        'name' => 'Sequence 2', 'held_from' => '2025-11-10', 'held_until' => '2025-11-21',
        'window_starts_on' => '2025-11-10', 'window_ends_on' => '2025-11-24',
    ]);
    [$achu, , $che] = $world['students'];

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/students/{$achu->id}/academics")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('students/academics')
            ->where('term.label', 'Term 1')
            ->has('columns', 2)
            ->where('columns.0.name', 'Sequence 1')
            ->where('columns.0.average', 15)
            ->where('columns.0.position', 1)
            ->where('columns.0.of', 3)
            ->where('columns.1.state', 'scheduled')
            ->where('columns.1.average', null)
            ->where('focus.name', 'Sequence 1')
            ->has('subjects', 2)
            ->where('subjects.0.subject', 'English')
            ->where('subjects.0.coefficient', 2)
            ->where("subjects.0.marks.{$plan->id}", 13)
            ->where('subjects.0.teacher', $world['teachers']['English']->formalName())
            ->where('coefficients', 6)
            ->where('remark.grade', 'B · Very good')
            ->where('termComplete', false)
            ->where('termAverage', null));

    $this->actingAs($world['admin'])
        ->get("http://exama.ekol.test/students/{$che->id}/academics")
        ->assertInertia(fn (Assert $page) => $page
            ->where('columns.0.average', 8)
            ->where('columns.0.complete', false)
            ->where('columns.0.position', null)
            ->where("subjects.0.marks.{$plan->id}", null));

    $this->actingAs($world['teachers']['English'])
        ->get("http://exama.ekol.test/students/{$achu->id}/academics")
        ->assertForbidden();
});
