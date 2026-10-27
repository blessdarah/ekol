<?php

namespace App\Models;

use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use Illuminate\Support\Str;

class DemoSchoolBuilder
{
    public function create(DemoRequest $request): School
    {
        $slug = Str::limit(Str::slug($request->school_name), 35, '').'-demo-'.Str::lower(Str::random(6));
        $school = School::create([
            'name' => $request->school_name.' · Demo '.Str::upper(Str::random(6)),
            'slug' => $slug, 'code' => 'DEMO', 'cycle' => SchoolCycle::Secondary,
            'currency' => 'XAF', 'timezone' => 'Africa/Douala', 'locale' => $request->locale,
            'ownership' => 'private', 'subsystem' => $request->locale === 'fr' ? 'francophone' : 'anglophone',
        ]);
        $school->forceFill(['is_demo' => true, 'demo_expires_at' => now()->addDays(14)])->save();
        $principal = User::create([
            'school_id' => $school->id, 'full_name' => $request->contact_name ?: 'Demo principal',
            'staff_code' => 'DEMO-001', 'initials' => 'DP', 'role' => UserRole::Principal,
            'email' => $slug.'@demo.invalid', 'phone' => $request->whatsapp,
            'password' => Str::random(64), 'setup_completed_at' => now(),
        ]);
        $year = AcademicYear::create([
            'school_id' => $school->id, 'label' => today()->year.'/'.(today()->year + 1),
            'starts_on' => today()->subMonths(2), 'ends_on' => today()->addMonths(10), 'status' => AcademicYearStatus::Current,
        ]);
        $term = Term::create([
            'school_id' => $school->id, 'academic_year_id' => $year->id, 'label' => 'Term 1', 'sequence' => 1,
            'starts_on' => today()->subWeeks(4), 'ends_on' => today()->addWeeks(11), 'week_count' => 15, 'is_current' => true,
        ]);
        $teacher = User::create([
            'school_id' => $school->id, 'staff_code' => 'DEMO-002', 'full_name' => 'Anne Nfor', 'initials' => 'AN',
            'email' => 'teacher-'.$slug.'@demo.invalid', 'phone' => '600000001', 'role' => UserRole::Teacher,
            'teaching_days' => 31, 'max_periods_week' => 25, 'max_periods_day' => 6,
        ]);
        $subject = Subject::create(['school_id' => $school->id, 'code' => 'MATH', 'name' => 'Mathematics', 'department' => 'Science', 'weekly_periods' => 4]);
        foreach (['Form 1', 'Form 2'] as $index => $name) {
            $level = Level::create(['school_id' => $school->id, 'name' => $name, 'code' => 'F'.($index + 1), 'ordinal' => $index + 1, 'cycle' => SchoolCycle::Secondary, 'subsystem' => 'anglophone', 'uses_series' => false]);
            $class = SchoolClass::create(['school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id, 'name' => $name.' A', 'capacity' => 40, 'form_master_id' => $teacher->id]);
            ClassSubject::create(['school_id' => $school->id, 'school_class_id' => $class->id, 'subject_id' => $subject->id, 'staff_id' => $teacher->id, 'weekly_periods' => 4]);
            Room::create(['school_id' => $school->id, 'code' => 'R'.($index + 1), 'name' => $name.' classroom', 'capacity' => 40, 'kind' => 'classroom']);
            $plan = FeePlan::create(['school_id' => $school->id, 'level_id' => $level->id, 'academic_year_id' => $year->id, 'annual_amount' => 150000, 'currency' => 'XAF', 'is_active' => true]);
            foreach (['Tabi Nkwain Junior', 'Mbah Precious Ewi', 'Atanga Fru Nelson', 'Kum Sandrine Lum', 'Peter Tanyi', 'Marie Fotso'] as $i => $fullName) {
                $student = Student::create([
                    'school_id' => $school->id, 'admission_no' => 'DEMO-'.($index + 1).str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                    'full_name' => $fullName, 'surname' => explode(' ', $fullName)[0], 'given_names' => substr($fullName, strpos($fullName, ' ') + 1),
                    'gender' => $i % 2 === 0 ? 'male' : 'female', 'date_of_birth' => today()->subYears(12 + $index),
                    'admitted_on' => today()->subMonth(), 'guardian_name' => 'Sample guardian', 'guardian_phone' => '600000000',
                ]);
                Enrolment::create(['student_id' => $student->id, 'academic_year_id' => $year->id, 'school_class_id' => $class->id, 'level_id' => $level->id, 'status' => 'enrolled']);
                $invoice = Invoice::create(['student_id' => $student->id, 'term_id' => $term->id, 'fee_plan_id' => $plan->id, 'amount_due' => 50000, 'issued_on' => today()->subMonth(), 'status' => 'overdue']);
                Installment::create(['invoice_id' => $invoice->id, 'seq' => 1, 'label' => 'First installment', 'amount' => 50000, 'due_on' => today()->subWeek(), 'status' => 'overdue']);
                if ($i < 3) {
                    Payment::create(['invoice_id' => $invoice->id, 'amount' => 20000, 'method' => 'cash', 'received_at' => now()->subDays(3), 'received_by' => $principal->id, 'receipt_no' => 'DEMO-'.$index.'-'.$i]);
                }
            }
        }
        foreach (range(0, 5) as $i) {
            Period::create(['school_id' => $school->id, 'label' => 'Period '.($i + 1), 'ordinal' => $i + 1, 'starts_at' => sprintf('%02d:00', 8 + $i), 'ends_at' => sprintf('%02d:50', 8 + $i), 'is_break' => false]);
        }
        $assessment = AssessmentPlan::create([
            'school_id' => $school->id, 'term_id' => $term->id, 'kind' => 'sequence', 'name' => 'Sequence 1',
            'state' => 'marks_open', 'window_starts_on' => today()->subWeek(), 'window_ends_on' => today()->addWeek(),
            'level_ids' => Level::where('school_id', $school->id)->pluck('id')->all(),
        ]);
        $assessment->sync();
        foreach ($assessment->sheets() as $sheet) {
            $enrolments = Enrolment::where('school_class_id', $sheet->assessment->school_class_id)->get();
            foreach ($enrolments->take(4) as $i => $enrolment) {
                Mark::create(['assessment_subject_id' => $sheet->id, 'student_id' => $enrolment->student_id,
                    'score' => 12 + $i, 'entered_by' => $teacher->id, 'entered_at' => now()]);
            }
        }
        $request->update(['demo_school_id' => $school->id, 'demo_user_id' => $principal->id, 'status' => 'trying', 'handled_at' => $request->handled_at ?? now()]);

        return $school;
    }
}
