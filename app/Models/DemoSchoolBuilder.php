<?php

namespace App\Models;

use App\Enums\AcademicYearStatus;
use App\Enums\AssessmentState;
use App\Enums\SchoolCycle;
use App\Enums\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DemoSchoolBuilder
{
    public function create(DemoRequest $request): School
    {
        $school = DB::transaction(function () use ($request) {
            $prospect = DemoRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            if ($prospect->demo_school_id) {
                abort_unless($prospect->status === 'trying', 409);
                $existing = School::whereKey($prospect->demo_school_id)->where('is_demo', true)->firstOrFail();
                abort_unless($existing->demo_expires_at?->isFuture(), 410);

                return $existing;
            }
            abort_unless(in_array($prospect->status, ['new', 'contacted'], true), 409);

            $school = $this->school($prospect);
            $principal = $this->principal($school, $prospect);
            [$year, $term] = $this->calendar($school);
            $lessons = $this->subjects($school);
            $fees = $this->fees($school, $year);
            $this->classes($school, $year, $term, $principal, $lessons, $fees);
            $this->periods($school);
            $this->grading($school);
            $this->assessments($school, $term, $principal);

            $prospect->update([
                'demo_school_id' => $school->id, 'demo_user_id' => $principal->id,
                'status' => 'trying', 'handled_at' => $prospect->handled_at ?? now(),
            ]);

            return $school;
        }, attempts: 3);
        $request->refresh();

        return $school;
    }

    private function school(DemoRequest $request): School
    {
        $slug = Str::limit(Str::slug($request->school_name), 35, '').'-demo-'.Str::lower(Str::random(6));
        $school = School::create([
            'name' => $request->school_name.' · Demo '.Str::upper(Str::random(6)),
            'slug' => $slug, 'code' => 'DEMO', 'cycle' => SchoolCycle::Secondary,
            'currency' => 'XAF', 'timezone' => 'Africa/Douala', 'locale' => $request->locale,
            'ownership' => 'private', 'subsystem' => $request->locale === 'fr' ? 'francophone' : 'anglophone',
            'school_days' => 31, 'day_starts_at' => '08:00', 'period_minutes' => 45,
        ]);
        $school->forceFill(['is_demo' => true, 'demo_expires_at' => now()->addDays(14)])->save();

        return $school;
    }

    private function principal(School $school, DemoRequest $request): User
    {
        return User::create([
            'school_id' => $school->id, 'full_name' => $request->contact_name ?: 'Demo principal',
            'staff_code' => 'DEMO-001', 'initials' => Str::upper(Str::substr($request->contact_name ?: 'DP', 0, 2)),
            'role' => UserRole::Principal, 'email' => $school->slug.'@demo.invalid', 'phone' => $request->whatsapp,
            'password' => Str::random(64), 'locale' => $school->locale, 'setup_completed_at' => now(),
        ]);
    }

    /** @return array{AcademicYear, Term} */
    private function calendar(School $school): array
    {
        $starts = today()->startOfWeek()->subWeeks(5);
        $ends = $starts->addYear()->subDay();
        $year = AcademicYear::create([
            'school_id' => $school->id, 'label' => $starts->year.'/'.substr((string) $ends->year, -2),
            'starts_on' => $starts, 'ends_on' => $ends, 'status' => AcademicYearStatus::Current,
            'enrolment_confirmed_at' => now(),
        ]);
        $terms = [[$starts, $starts->addWeeks(15)->subDay()],
            [$starts->addWeeks(15), $starts->addWeeks(29)->subDay()], [$starts->addWeeks(29), $ends]];
        foreach ($terms as $index => [$from, $until]) {
            $year->terms()->create([
                'school_id' => $school->id, 'label' => 'Term '.($index + 1), 'sequence' => $index + 1,
                'starts_on' => $from, 'ends_on' => $until, 'week_count' => (int) ceil($from->diffInDays($until->addDay()) / 7),
                'is_current' => $index === 0,
            ]);
        }

        return [$year, $year->terms()->where('is_current', true)->firstOrFail()];
    }

    /** @return list<array{subject: Subject, teacher: User}> */
    private function subjects(School $school): array
    {
        $lessons = [];
        foreach (DemoSchoolSample::SUBJECTS as $index => $sample) {
            $profile = $sample['teacher'];
            $teacher = User::create([
                'school_id' => $school->id, 'staff_code' => 'DEMO-00'.($index + 2),
                'full_name' => $profile['family'].' '.$profile['given'], 'given_name' => $profile['given'], 'family_name' => $profile['family'],
                'initials' => Str::upper($profile['given'][0].$profile['family'][0]), 'gender' => $profile['gender'],
                'email' => $sample['code'].'-'.$school->slug.'@demo.invalid', 'phone' => '60000000'.($index + 1),
                'role' => UserRole::Teacher, 'qualification' => 'B.Ed.', 'employment_type' => 'school_paid',
                'teaching_days' => 31, 'max_periods_week' => 25, 'max_periods_day' => 6, 'joined_on' => today()->subMonths(2),
            ]);
            $subject = Subject::create([
                'school_id' => $school->id, 'code' => $sample['code'], 'name' => $sample[$school->locale === 'fr' ? 'fr' : 'en'],
                'department' => $sample['department'], 'weekly_periods' => $sample['periods'], 'coefficient' => $sample['coefficient'],
            ]);
            SubjectTeacher::create(['subject_id' => $subject->id, 'staff_id' => $teacher->id, 'role' => 'lead']);
            $lessons[] = ['subject' => $subject, 'teacher' => $teacher];
        }

        return $lessons;
    }

    /** @return list<array{item: FeeItem, amount: int}> */
    private function fees(School $school, AcademicYear $year): array
    {
        foreach (DemoSchoolSample::INSTALLMENTS as $index => $percent) {
            FeeInstallmentTemplate::create([
                'school_id' => $school->id, 'academic_year_id' => $year->id, 'seq' => $index + 1,
                'percent' => $percent, 'due_on' => today()->subWeek()->addDays($index * 30),
            ]);
        }
        $fees = [];
        foreach (DemoSchoolSample::FEES as $index => $sample) {
            $item = FeeItem::create([
                'school_id' => $school->id, 'academic_year_id' => $year->id,
                'name' => $sample[$school->locale === 'fr' ? 'fr' : 'en'], 'position' => $index + 1,
                'is_spread' => $sample['spread'], 'new_students_only' => false,
            ]);
            $fees[] = ['item' => $item, 'amount' => $sample['amount']];
        }

        return $fees;
    }

    /**
     * @param  list<array{subject: Subject, teacher: User}>  $lessons
     * @param  list<array{item: FeeItem, amount: int}>  $fees
     */
    private function classes(School $school, AcademicYear $year, Term $term, User $principal, array $lessons, array $fees): void
    {
        $annualAmount = array_sum(array_column($fees, 'amount'));
        foreach (DemoSchoolSample::CLASSES as $index => $sample) {
            $name = $sample[$school->locale === 'fr' ? 'fr' : 'en'];
            $level = Level::create([
                'school_id' => $school->id, 'name' => $name, 'code' => $sample['code'], 'ordinal' => $index + 1,
                'cycle' => SchoolCycle::Secondary, 'subsystem' => $school->subsystem, 'uses_series' => false,
            ]);
            $room = Room::create(['school_id' => $school->id, 'code' => 'R'.($index + 1), 'name' => $name, 'capacity' => 40, 'kind' => 'classroom']);
            $class = SchoolClass::create([
                'school_id' => $school->id, 'academic_year_id' => $year->id, 'level_id' => $level->id,
                'name' => SchoolClass::nameFor($name, 'A'), 'capacity' => 40, 'form_master_id' => $lessons[$index]['teacher']->id, 'home_room_id' => $room->id,
            ]);
            foreach ($lessons as $lesson) {
                ClassSubject::create([
                    'school_id' => $school->id, 'school_class_id' => $class->id, 'subject_id' => $lesson['subject']->id,
                    'staff_id' => $lesson['teacher']->id, 'weekly_periods' => $lesson['subject']->weekly_periods,
                ]);
            }
            $lines = [];
            foreach ($fees as $fee) {
                FeeItemAmount::create(['fee_item_id' => $fee['item']->id, 'level_id' => $level->id, 'amount' => $fee['amount']]);
                $lines[] = ['fee_item_id' => $fee['item']->id, 'name' => $fee['item']->name, 'position' => $fee['item']->position,
                    'is_spread' => $fee['item']->is_spread, 'amount' => (string) $fee['amount']];
            }
            $plan = FeePlan::create(['school_id' => $school->id, 'level_id' => $level->id, 'academic_year_id' => $year->id, 'annual_amount' => $annualAmount, 'currency' => 'XAF', 'is_active' => true]);
            foreach (array_slice(DemoSchoolSample::STUDENTS, $index * 6, 6) as $position => $profile) {
                $student = Student::create([
                    'school_id' => $school->id, 'admission_no' => 'DEMO-'.($index + 1).str_pad((string) ($position + 1), 3, '0', STR_PAD_LEFT),
                    'full_name' => $profile['surname'].' '.$profile['given'], 'surname' => $profile['surname'], 'given_names' => $profile['given'],
                    'gender' => $profile['gender'], 'date_of_birth' => today()->subYears($sample['age'])->subDays($position * 35),
                    'admitted_on' => $year->starts_on, 'guardian_name' => 'Sample guardian '.($index * 6 + $position + 1), 'guardian_phone' => '600000000',
                ]);
                Enrolment::create(['student_id' => $student->id, 'academic_year_id' => $year->id, 'school_class_id' => $class->id, 'level_id' => $level->id, 'status' => 'enrolled']);
                $invoice = Invoice::issue($student, $term, $plan, number_format($annualAmount, 2, '.', ''), today()->subWeeks(2)->toDateString(), $lines);
                $amount = DemoSchoolSample::SAMPLE_PAYMENTS[$position];
                if ($amount > 0) {
                    $invoice->recordPayment((string) $amount, 'cash', $principal, receivedAt: now()->subDays(3));
                } else {
                    $invoice->syncStatus();
                }
            }
        }
    }

    private function periods(School $school): void
    {
        $starts = today()->setTime(8, 0);
        foreach (range(1, 6) as $ordinal) {
            if ($ordinal === 3) {
                Period::create(['school_id' => $school->id, 'label' => 'Break', 'ordinal' => $ordinal, 'starts_at' => $starts->format('H:i'), 'ends_at' => $starts->addMinutes(15)->format('H:i'), 'is_break' => true]);
                $starts = $starts->addMinutes(15);
            }
            Period::create(['school_id' => $school->id, 'label' => 'Period '.$ordinal, 'ordinal' => $ordinal >= 3 ? $ordinal + 1 : $ordinal,
                'starts_at' => $starts->format('H:i'), 'ends_at' => $starts->addMinutes(45)->format('H:i'), 'is_break' => false]);
            $starts = $starts->addMinutes(45);
        }
    }

    private function grading(School $school): void
    {
        foreach (GradeBand::STANDARD as $index => $band) {
            GradeBand::create(['school_id' => $school->id, 'letter' => $band['letter'], 'from_percent' => $band['from'] * 5,
                'to_percent' => $band['to'] * 5, 'meaning' => $band['meaning'], 'standard_remark' => $band['remark'], 'rank_order' => $index + 1]);
        }
    }

    private function assessments(School $school, Term $term, User $principal): void
    {
        $levelIds = Level::where('school_id', $school->id)->pluck('id')->all();
        foreach ([1, 2] as $sequence) {
            $plan = AssessmentPlan::create([
                'school_id' => $school->id, 'term_id' => $term->id, 'kind' => 'sequence', 'name' => 'Sequence '.$sequence,
                'state' => AssessmentState::MarksOpen, 'window_starts_on' => today()->subWeeks(2), 'window_ends_on' => today()->addWeeks(2),
                'held_from' => today()->subWeeks(3), 'held_until' => today()->subWeeks(2), 'level_ids' => $levelIds,
            ]);
            $plan->sync();
            foreach ($plan->sheets() as $sheet) {
                $enrolments = Enrolment::where('school_class_id', $sheet->assessment->school_class_id)->orderBy('student_id')->get();
                foreach ($enrolments as $index => $enrolment) {
                    if ($sequence === 2 && $index >= 4) {
                        continue;
                    }
                    $score = 9 + $index + $sequence;
                    $band = GradeBand::forScore($school->id, $score);
                    Mark::create(['assessment_subject_id' => $sheet->id, 'student_id' => $enrolment->student_id,
                        'score' => $score, 'grade_band_id' => $band['id'] ?? null, 'remark' => $band['remark'] ?? null,
                        'entered_by' => $sheet->examiner_id, 'entered_at' => now()->subDay()]);
                }
                if ($sequence === 1) {
                    $sheet->update(['submitted_at' => now()->subDay(), 'submitted_by' => $sheet->examiner_id]);
                }
            }
            if ($sequence === 1) {
                $plan->moveTo(AssessmentState::Published, ['closed_at' => now()->subDay(), 'published_at' => now()->subDay(), 'published_by' => $principal->id]);
            }
        }
    }
}
