<?php

use App\Enums\AcademicYearStatus;
use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\Attendance;
use App\Models\Coefficient;
use App\Models\Enrolment;
use App\Models\FeeExemption;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeePlan;
use App\Models\Invoice;
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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

/** @return array{school: School, admin: User, year: AcademicYear, term: Term, level: Level, class: SchoolClass, students: list<Student>} */
function aggregateDashboardWorld(string $slug): array
{
    $school = School::create(['name' => 'Aggregate Academy '.$slug, 'code' => 'AG', 'slug' => $slug, 'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
    $admin = User::factory()->create(['school_id' => $school->id, 'role' => UserRole::Admin]);
    $year = AcademicYear::create(['school_id' => $school->id, 'label' => '2025/26', 'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31', 'status' => AcademicYearStatus::Current]);
    $term = Term::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1, 'starts_on' => '2025-09-01', 'ends_on' => '2025-12-19', 'week_count' => 16, 'is_current' => true]);
    $level = Level::create(['school_id' => $school->id, 'name' => 'Form 1', 'code' => 'F1', 'ordinal' => 1, 'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone']);
    $class = SchoolClass::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => 'Form 1 A', 'capacity' => 40]);
    $students = [];
    foreach (['Ada', 'Bih', 'Che'] as $index => $name) {
        $students[] = $student = Student::create(['school_id' => $school->id, 'admission_no' => 'AG-'.($index + 1), 'full_name' => $name, 'gender' => $index === 1 ? 'female' : 'male', 'date_of_birth' => '2013-01-01', 'guardian_name' => 'Guardian', 'guardian_phone' => '+237670000000', 'admitted_on' => '2025-09-01']);
        Enrolment::create(['student_id' => $student->id, 'academic_year_id' => $year->id, 'school_class_id' => $class->id, 'status' => EnrolmentStatus::Enrolled]);
    }

    return compact('school', 'admin', 'year', 'term', 'level', 'class', 'students');
}

/** @param array{school: School, term: Term, class: SchoolClass, ...} $world
 * @return list<TimetableSlot>
 */
function aggregateDashboardSlots(array $world): array
{
    $slots = [];
    foreach ([1, 2] as $ordinal) {
        $period = Period::create(['school_id' => $world['school']->id, 'ordinal' => $ordinal, 'label' => 'P'.$ordinal, 'starts_at' => '08:00', 'ends_at' => '08:45']);
        $slots[] = TimetableSlot::create(['school_id' => $world['school']->id, 'term_id' => $world['term']->id, 'school_class_id' => $world['class']->id, 'period_id' => $period->id, 'weekday' => 2]);
    }

    return $slots;
}

test('school attendance aggregates count students once today and weight weekly rates by registers', function () {
    $this->travelTo('2025-10-01 09:00:00');
    $world = aggregateDashboardWorld('aggregatea');
    $other = aggregateDashboardWorld('aggregateb');
    $slots = aggregateDashboardSlots($world);
    $otherSlots = aggregateDashboardSlots($other);
    foreach (['present', 'late', 'absent'] as $index => $status) {
        Attendance::create(['timetable_slot_id' => $slots[0]->id, 'student_id' => $world['students'][$index]->id, 'date' => '2025-09-29', 'status' => $status]);
    }
    foreach ([[0, 0, 'present'], [1, 0, 'present'], [0, 1, 'absent'], [1, 1, 'late'], [0, 2, 'absent']] as [$slot, $student, $status]) {
        Attendance::create(['timetable_slot_id' => $slots[$slot]->id, 'student_id' => $world['students'][$student]->id, 'date' => '2025-10-01', 'status' => $status]);
    }
    Attendance::create(['timetable_slot_id' => $otherSlots[0]->id, 'student_id' => $other['students'][0]->id, 'date' => '2025-10-01', 'status' => 'absent']);

    $this->actingAs($world['admin'])->get('http://aggregatea.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('attendance.today', ['rate' => 66.7, 'present' => 2, 'marked' => 3])
        ->where('attendance.series.0.rate', 66.7)->where('attendance.series.1.rate', 60)
        ->where('attendance.lowest', ['class' => 'Form 1 A', 'rate' => 62.5]));
    $this->get('http://aggregatea.ekol.test/dashboard?range=year')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('attendance.series', 1)->where('attendance.series.0.date', '2025-09-29')->where('attendance.series.0.rate', 62.5));
    $this->actingAs($other['admin'])->get('http://aggregateb.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('attendance.today', ['rate' => 0, 'present' => 0, 'marked' => 1]));
});

test('school dashboard sections expire after two minutes and authorization stays outside the shared cache', function () {
    $this->travelTo('2025-10-01 09:00:00');
    $world = aggregateDashboardWorld('aggregatecache');
    $slots = aggregateDashboardSlots($world);
    $record = Attendance::create(['timetable_slot_id' => $slots[0]->id, 'student_id' => $world['students'][0]->id, 'date' => '2025-10-01', 'status' => 'present']);
    $registrar = User::factory()->create(['school_id' => $world['school']->id, 'role' => UserRole::Registrar]);

    $this->actingAs($world['admin'])->get('http://aggregatecache.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->where('attendance.today.present', 1)->where('fees.due', 0));
    $record->update(['status' => 'absent']);
    $this->actingAs($registrar)->get('http://aggregatecache.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->where('attendance.today.present', 1)->where('fees', null)->where('marks', null)->where('results', null));
    $this->get('http://aggregatecache.ekol.test/dashboard?range=year')->assertOk()->assertInertia(fn (Assert $page) => $page->where('attendance.today.present', 0));
    $this->travel(121)->seconds();
    $this->get('http://aggregatecache.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->where('attendance.today.present', 0)->where('attendance.today.marked', 1));
});

test('dashboard results aggregate weighted exam averages before comparing each student with the pass mark', function () {
    $this->travelTo('2025-10-01 09:00:00');
    $world = aggregateDashboardWorld('aggregateresults');
    $plan = AssessmentPlan::create(['school_id' => $world['school']->id, 'term_id' => $world['term']->id, 'kind' => AssessmentKind::Exam, 'name' => 'Term exam', 'state' => AssessmentState::Published, 'published_at' => now(), 'level_ids' => [$world['level']->id]]);
    $assessment = Assessment::create(['school_id' => $world['school']->id, 'term_id' => $world['term']->id, 'school_class_id' => $world['class']->id, 'kind' => AssessmentKind::Exam, 'name' => 'Term exam', 'state' => AssessmentState::Published, 'sequence_weight' => 1, 'exam_weight' => 1, 'assessment_plan_id' => $plan->id]);
    foreach ([['Mathematics', 30, 1, 3, [15.01, 14.99, null]], ['English', 20, 3, 1, [9.97, null, null]]] as [$name, $max, $sequence, $exam, $scores]) {
        $subject = Subject::create(['school_id' => $world['school']->id, 'code' => substr($name, 0, 3), 'name' => $name, 'department' => 'General', 'weekly_periods' => 2]);
        $coefficient = Coefficient::create(['subject_id' => $subject->id, 'level_id' => $world['level']->id, 'sequence_coeff' => $sequence, 'exam_coeff' => $exam, 'status' => 'draft']);
        $sheet = AssessmentSubject::create(['assessment_id' => $assessment->id, 'subject_id' => $subject->id, 'coefficient_id' => $coefficient->id, 'max_score' => $max]);
        foreach ($scores as $index => $score) {
            Mark::create(['assessment_subject_id' => $sheet->id, 'student_id' => $world['students'][$index]->id, 'score' => $score, 'is_absent' => $name === 'English' && $index > 0]);
        }
    }
    $class = SchoolClass::create(['school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id, 'level_id' => $world['level']->id, 'name' => 'Form 1 B', 'capacity' => 40]);
    Enrolment::where('student_id', $world['students'][2]->id)->update(['school_class_id' => $class->id]);
    Assessment::create(['school_id' => $world['school']->id, 'term_id' => $world['term']->id, 'school_class_id' => $class->id, 'kind' => AssessmentKind::Exam, 'name' => 'Term exam', 'state' => AssessmentState::Published, 'sequence_weight' => 1, 'exam_weight' => 1, 'assessment_plan_id' => $plan->id]);

    DB::enableQueryLog();
    $this->actingAs($world['admin'])->get('http://aggregateresults.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('results.plan', 'Term exam')->has('results.classes', 1)
        ->where('results.classes.0', ['id' => $world['class']->id, 'name' => 'Form 1 A', 'average' => 10, 'passed' => 1, 'students' => 2]));
    $before = count(DB::getQueryLog());
    DB::disableQueryLog();
    foreach (range(3, 8) as $number) {
        $extra = SchoolClass::create(['school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id, 'level_id' => $world['level']->id, 'name' => 'Form 1 '.$number, 'capacity' => 40]);
        Assessment::create(['school_id' => $world['school']->id, 'term_id' => $world['term']->id, 'school_class_id' => $extra->id, 'kind' => AssessmentKind::Exam, 'name' => 'Term exam', 'state' => AssessmentState::Published, 'sequence_weight' => 1, 'exam_weight' => 1, 'assessment_plan_id' => $plan->id]);
    }
    Cache::flush();
    DB::flushQueryLog();
    DB::enableQueryLog();
    $this->get('http://aggregateresults.ekol.test/dashboard')->assertOk();
    $after = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($after)->toBeLessThanOrEqual($before);
});

test('dashboard fee series use net installment summaries and exact daily payment aggregates', function () {
    $this->travelTo('2025-10-01 09:00:00');
    $world = aggregateDashboardWorld('aggregatefees');
    $plan = FeePlan::create(['school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id, 'level_id' => $world['level']->id, 'annual_amount' => '30.81', 'currency' => 'XAF']);
    foreach ([[1, '2025-09-15'], [2, '2025-11-15']] as [$seq, $due]) {
        FeeInstallmentTemplate::create(['school_id' => $world['school']->id, 'academic_year_id' => $world['year']->id, 'seq' => $seq, 'percent' => 50, 'due_on' => $due]);
    }
    $invoice = Invoice::issue($world['students'][0], $world['term'], $plan, '30.81', '2025-09-01');
    FeeExemption::create(['invoice_id' => $invoice->id, 'kind' => 'amount', 'amount' => '0.01', 'reason' => 'Fixed discount', 'granted_by' => $world['admin']->id]);
    foreach (['0.10', '0.20', '0.30'] as $amount) {
        $invoice->recordPayment($amount, 'cash', $world['admin']);
    }
    Invoice::create(['school_id' => $world['school']->id, 'student_id' => $world['students'][1]->id, 'term_id' => $world['term']->id, 'fee_plan_id' => $plan->id, 'amount_due' => '0.30', 'issued_on' => '2025-09-01']);

    $this->actingAs($world['admin'])->get('http://aggregatefees.ekol.test/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('fees.due', 31.1)->where('fees.collected', 0.6)->where('fees.overdue', 15.1)
        ->where('fees.series.0.due', 0.3)->where('fees.series.2.due', 15.7)
        ->where('fees.series.4.collected', 0.6)->where('fees.series.5.collected', null));
});
