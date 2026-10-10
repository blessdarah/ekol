<?php

use App\Enums\AcademicYearStatus;
use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Enums\Gender;
use App\Enums\PaymentMethod;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\AssessmentSubject;
use App\Models\Coefficient;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Mark;
use App\Models\Payment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Term;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

test('school foundation chain uses uuidv7 keys and enforces one current term', function () {
    $school = School::create([
        'name' => 'Ekol Test School',
        'code' => 'ETS',
        'slug' => 'ekol-test',
        'cycle' => SchoolCycle::Secondary,
        'currency' => 'XAF',
        'timezone' => 'Africa/Douala',
    ]);

    expect(Str::isUuid($school->id))->toBeTrue()
        ->and(substr($school->id, 14, 1))->toBe('7')
        ->and($school->cycle)->toBe(SchoolCycle::Secondary);

    $year = AcademicYear::create([
        'school_id' => $school->id,
        'label' => '2025/26',
        'starts_on' => '2025-09-01',
        'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);

    expect($year->status)->toBe(AcademicYearStatus::Current)
        ->and($school->academicYears()->count())->toBe(1);

    $term = Term::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'label' => 'Term 1',
        'sequence' => 1,
        'starts_on' => '2025-09-01',
        'ends_on' => '2025-12-12',
        'week_count' => 15,
        'is_current' => true,
    ]);

    expect($term->is_current)->toBeTrue()
        ->and($term->academicYear->id)->toBe($year->id);

    expect(fn () => Term::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'label' => 'Term 2',
        'sequence' => 2,
        'starts_on' => '2026-01-05',
        'ends_on' => '2026-03-27',
        'week_count' => 12,
        'is_current' => true,
    ]))->toThrow(QueryException::class);

    $teacher = User::create([
        'school_id' => $school->id,
        'staff_code' => 'STF-0001',
        'full_name' => 'Eposi Fonkem',
        'initials' => 'EF',
        'email' => 'eposi@example.com',
        'role' => UserRole::Principal,
        'phone' => '+237600000000',
        'password' => 'password',
    ]);

    expect($teacher->role)->toBe(UserRole::Principal)
        ->and($teacher->school->id)->toBe($school->id);

    $level = Level::create([
        'school_id' => $school->id,
        'name' => 'Form 4',
        'ordinal' => 4,
        'cycle' => SchoolCycle::Secondary,
        'uses_series' => false,
    ]);

    $class = SchoolClass::create([
        'school_id' => $school->id,
        'academic_year_id' => $year->id,
        'level_id' => $level->id,
        'name' => 'Form 4A',
        'form_master_id' => $teacher->id,
        'capacity' => 60,
    ]);

    expect($class->academicYear->id)->toBe($year->id);

    $student = Student::create([
        'school_id' => $school->id,
        'admission_no' => 'ADM-0001',
        'full_name' => 'Amina Bello',
        'gender' => Gender::Female,
        'date_of_birth' => '2012-04-03',
        'guardian_name' => 'Musa Bello',
        'guardian_phone' => '+237611111111',
        'admitted_on' => '2025-09-01',
    ]);

    $enrolment = Enrolment::create([
        'student_id' => $student->id,
        'academic_year_id' => $year->id,
        'status' => EnrolmentStatus::Admitted,
    ]);

    expect($enrolment->school_class_id)->toBeNull();

    $enrolment->update([
        'school_class_id' => $class->id,
        'status' => EnrolmentStatus::Placed,
    ]);

    expect($enrolment->fresh()->status)->toBe(EnrolmentStatus::Placed)
        ->and($student->enrolments()->count())->toBe(1);

    $subject = Subject::create([
        'school_id' => $school->id,
        'code' => 'MATH',
        'name' => 'Mathematics',
        'department' => 'Science',
        'weekly_periods' => 5,
    ]);

    $coefficient = Coefficient::create([
        'subject_id' => $subject->id,
        'level_id' => $level->id,
        'sequence_coeff' => '1.0',
        'exam_coeff' => '1.5',
    ]);

    $assessment = Assessment::create([
        'school_id' => $school->id,
        'term_id' => $term->id,
        'school_class_id' => $class->id,
        'kind' => AssessmentKind::Sequence,
        'name' => 'First Sequence',
        'state' => AssessmentState::MarksOpen,
        'sequence_weight' => '1.0',
        'exam_weight' => '0.0',
    ]);

    $node = AssessmentSubject::create([
        'assessment_id' => $assessment->id,
        'subject_id' => $subject->id,
        'coefficient_id' => $coefficient->id,
        'max_score' => '20.0',
        'examiner_id' => $teacher->id,
    ]);

    $mark = Mark::create([
        'assessment_subject_id' => $node->id,
        'student_id' => $student->id,
        'score' => '15.5',
        'entered_by' => $teacher->id,
    ]);

    expect($mark->student->id)->toBe($student->id)
        ->and($student->marks()->count())->toBe(1);

    $invoice = Invoice::create([
        'student_id' => $student->id,
        'term_id' => $term->id,
        'fee_plan_id' => FeePlan::create([
            'school_id' => $school->id,
            'level_id' => $level->id,
            'academic_year_id' => $year->id,
            'annual_amount' => '150000.00',
            'currency' => 'XAF',
        ])->id,
        'amount_due' => '50000.00',
        'issued_on' => '2025-09-05',
    ]);

    $payment = Payment::create([
        'invoice_id' => $invoice->id,
        'amount' => '20000.00',
        'method' => PaymentMethod::Cash,
        'received_by' => $teacher->id,
    ]);

    expect($payment->method)->toBe(PaymentMethod::Cash)
        ->and((float) $invoice->payments()->sum('amount'))->toBe(20000.0);
});
