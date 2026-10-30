<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\ApplicationStage;
use App\Enums\AssessmentState;
use App\Enums\AttendanceStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\Gender;
use App\Enums\SchemeStatus;
use App\Http\Controllers\EnrolmentController;
use App\Http\Controllers\StructureController;
use App\Http\Controllers\StudentController;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\Attendance;
use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Period;
use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The school dashboard: the numbers a principal, administrator or
 * bursar opens the day with, each part only for those who may see it.
 */
trait BuildsSchoolDashboard
{
    /**
     * @return array<string, mixed>
     */
    protected function schoolDashboard(User $user, School $school, string $range): array
    {
        $now = now($school->timezone);
        $year = StructureController::currentYear($school);
        $term = StudentController::currentTerm($school);
        $role = $user->role;
        $week = $term ? Scheme::currentWeek($term) : null;

        $fees = $role->managesFees() && $year ? $this->dashboardFees($school, $year, $term, $range) : null;
        $marks = $role->managesAssessments() && $year ? $this->dashboardMarks($school, $year) : null;
        $schemes = $role->followsSchemes() && $term ? $this->dashboardSchemes($term, $week) : null;
        $admissions = $role->managesStudents() ? $this->dashboardAdmissions($school) : null;
        $attendance = $this->dashboardAttendance($school, $year, $term, $range, $now);

        return [
            'date' => $now->translatedFormat('l j F Y'),
            'greeting' => match (true) {
                $now->hour < 12 => 'Good morning',
                $now->hour < 17 => 'Good afternoon',
                default => 'Good evening',
            },
            'name' => $this->formal($user),
            'schoolName' => $school->name,
            'currency' => $school->currency,
            'range' => $range,
            'term' => $term ? ['label' => $term->label, 'week' => $week, 'weeks' => $term->week_count, 'ends_on' => $term->ends_on->toDateString()] : null,
            'yearLabel' => $year?->label,
            'counts' => [
                'students' => $year ? Enrolment::where('academic_year_id', $year->id)->where('status', '!=', EnrolmentStatus::Left)->count() : 0,
                'classes' => $year ? SchoolClass::where('academic_year_id', $year->id)->count() : 0,
                'staff' => User::where('school_id', $school->id)->count(),
            ],
            'fees' => $fees,
            'attendance' => $attendance,
            'marks' => $marks,
            'schemes' => $schemes,
            'results' => $role->managesAssessments() && $year ? $this->dashboardResults($school, $year) : null,
            'levels' => $year ? $this->dashboardLevels($school, $year) : [],
            'admissions' => $admissions,
            'attention' => array_values(array_filter([
                $schemes && $schemes['to_approve'] > 0 ? ['key' => 'schemes', 'tone' => 'science', 'count' => $schemes['to_approve'], 'detail' => $schemes['waiting_names']] : null,
                $marks && $marks['missing'] > 0 ? ['key' => 'marks', 'tone' => 'warning', 'count' => $marks['missing'], 'detail' => ['plan' => $marks['plan'], 'closes_on' => $marks['closes_on'], 'teachers' => $marks['teachers']]] : null,
                $fees && $fees['overdue_students'] > 0 ? ['key' => 'fees', 'tone' => 'danger', 'count' => $fees['overdue_students'], 'detail' => ['amount' => $fees['overdue']]] : null,
                $attendance['unmarked'] !== [] ? ['key' => 'registers', 'tone' => 'warning', 'count' => count($attendance['unmarked']), 'detail' => ['classes' => $attendance['unmarked']]] : null,
                $admissions && $admissions['to_review'] > 0 ? ['key' => 'applications', 'tone' => 'muted', 'count' => $admissions['to_review'], 'detail' => ['year' => $admissions['year'], 'oldest' => $admissions['oldest_days']]] : null,
            ])),
        ];
    }

    /**
     * The year's fees: billed, collected and overdue, and how collection
     * grew against what the instalments made due, week by week across
     * the term or month by month across the year.
     *
     * @return array<string, mixed>
     */
    protected function dashboardFees(School $school, AcademicYear $year, ?Term $term, string $range): array
    {
        $invoices = Invoice::whereIn('term_id', Term::where('academic_year_id', $year->id)->select('id'))
            ->whereHas('student', fn ($query) => $query->where('school_id', $school->id))
            ->with(['installments', 'lines', 'payments', 'exemption'])
            ->get();
        $ledgers = $invoices->map(fn (Invoice $invoice) => ['student' => $invoice->student_id, 'ledger' => $invoice->ledger()]);
        $parts = $ledgers->flatMap(fn (array $row) => $row['ledger']['installments']);
        $payments = $invoices->flatMap(fn (Invoice $invoice) => $invoice->payments);
        $today = today();

        $series = $this->periods($range === 'year' || ! $term ? $year->starts_on : $term->starts_on, $range === 'year' || ! $term ? $year->ends_on : $term->ends_on, $range === 'year' || ! $term ? 'month' : 'week')
            ->map(fn (array $point) => [
                'label' => $point['label'],
                'starts_on' => $point['start']->toDateString(),
                'ends_on' => $point['end']->toDateString(),
                'due' => round((float) $parts->filter(fn (array $part) => $part['due_on'] <= $point['end']->toDateString())->sum('amount')),
                'collected' => $point['start']->gt($today)
                    ? null
                    : round((float) $payments->filter(fn (Payment $payment) => $payment->received_at->lte(($point['end']->lt($today) ? $point['end'] : $today)->copy()->endOfDay()))->sum(fn (Payment $payment) => (float) $payment->amount)),
            ])
            ->values();

        return [
            'due' => round((float) $ledgers->sum(fn (array $row) => $row['ledger']['due'])),
            'collected' => round((float) $ledgers->sum(fn (array $row) => $row['ledger']['paid'])),
            'overdue' => round((float) $ledgers->sum(fn (array $row) => $row['ledger']['overdue'])),
            'overdue_students' => $ledgers->filter(fn (array $row) => $row['ledger']['overdue'] > 0)->pluck('student')->unique()->count(),
            'series' => $series,
            'today' => $series->search(fn (array $point) => $point['starts_on'] <= $today->toDateString() && $point['ends_on'] >= $today->toDateString()),
        ];
    }

    /**
     * Weeks or months from one day to another, each with its first and
     * last day and a short label.
     *
     * @return Collection<int, array{label: string, start: Carbon, end: Carbon}>
     */
    protected function periods(CarbonInterface $from, CarbonInterface $to, string $unit): Collection
    {
        $points = collect();
        $cursor = Carbon::parse($from)->startOfDay();
        $count = 1;

        while ($cursor->lte($to) && $count <= 60) {
            $end = ($unit === 'month' ? $cursor->copy()->endOfMonth() : $cursor->copy()->endOfWeek())->min(Carbon::parse($to))->startOfDay();
            $points->push([
                'label' => $unit === 'month' ? $cursor->translatedFormat('M') : 'W'.$count,
                'start' => $cursor->copy(),
                'end' => $end,
            ]);
            $cursor = $end->copy()->addDay();
            $count++;
        }

        return $points;
    }

    /**
     * Who was present: today, day by day across the term (or week by
     * week across the year), the class with the lowest attendance this
     * month, and today's lessons over without a register.
     *
     * @return array{today: array{rate: float|null, present: int, marked: int}, series: list<array{label: string, date: string, rate: float}>, lowest: array{class: string, rate: float}|null, unmarked: list<string>}
     */
    protected function dashboardAttendance(School $school, ?AcademicYear $year, ?Term $term, string $range, CarbonInterface $now): array
    {
        $present = [AttendanceStatus::Present->value, AttendanceStatus::Late->value];
        $mine = fn () => Attendance::whereHas('student', fn ($query) => $query->where('school_id', $school->id));
        $from = $range === 'year' && $year ? $year->starts_on : ($term ? $term->starts_on : $now->copy()->subDays(30));

        $days = $mine()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $now->toDateString())
            ->get(['date', 'status'])
            ->groupBy(fn (Attendance $row) => $range === 'year' ? $row->date->copy()->startOfWeek()->toDateString() : $row->date->toDateString())
            ->map(fn (Collection $rows, string $date) => [
                'label' => Carbon::parse($date)->translatedFormat('j M'),
                'date' => $date,
                'rate' => round($rows->filter(fn (Attendance $row) => in_array($row->status->value, $present, true))->count() / max(1, $rows->count()) * 100, 1),
            ])
            ->sortBy('date')
            ->values();

        $todayRows = $mine()->whereDate('date', $now->toDateString())->get(['student_id', 'status']);
        $marked = $todayRows->pluck('student_id')->unique()->count();
        $here = $todayRows->filter(fn (Attendance $row) => in_array($row->status->value, $present, true))->pluck('student_id')->unique()->count();

        $lowest = Attendance::query()
            ->join('timetable_slots', 'timetable_slots.id', '=', 'attendance.timetable_slot_id')
            ->whereHas('student', fn ($query) => $query->where('school_id', $school->id))
            ->whereDate('attendance.date', '>=', $now->copy()->subDays(30)->toDateString())
            ->selectRaw('timetable_slots.school_class_id as class_id, SUM(CASE WHEN attendance.status IN (?, ?) THEN 1 ELSE 0 END) as here, COUNT(*) as total', $present)
            ->groupBy('timetable_slots.school_class_id')
            ->get()
            ->map(fn (Attendance $row) => ['class_id' => (string) $row->getAttribute('class_id'), 'rate' => round((int) $row->getAttribute('here') / max(1, (int) $row->getAttribute('total')) * 100, 1)])
            ->sortBy('rate')
            ->first();

        return [
            'today' => ['rate' => $marked > 0 ? round($here / $marked * 100, 1) : null, 'present' => $here, 'marked' => $marked],
            'series' => array_values(($range === 'year' ? $days : $days->take(-20))->all()),
            'lowest' => $lowest ? ['class' => (string) SchoolClass::whereKey($lowest['class_id'])->value('name'), 'rate' => $lowest['rate']] : null,
            'unmarked' => $term ? $this->unmarkedRegisters($school, $term, $now) : [],
        ];
    }

    /**
     * Classes whose lesson today is over with no register taken.
     *
     * @return list<string>
     */
    protected function unmarkedRegisters(School $school, Term $term, CarbonInterface $now): array
    {
        $live = TimetableVersion::liveFor($term);

        if (! $live) {
            return [];
        }

        $over = Period::where('school_id', $school->id)->where('ends_at', '<=', $now->format('H:i:s'))->pluck('id');
        $slots = TimetableSlot::where('timetable_version_id', $live->id)
            ->where('weekday', $now->dayOfWeekIso - 1)
            ->whereIn('period_id', $over)
            ->with('schoolClass:id,name')
            ->get();
        $taken = Attendance::whereIn('timetable_slot_id', $slots->modelKeys())->whereDate('date', $now->toDateString())->distinct()->pluck('timetable_slot_id')->all();

        return array_values($slots
            ->reject(fn (TimetableSlot $slot) => in_array($slot->id, $taken, true))
            ->map(fn (TimetableSlot $slot) => (string) $slot->schoolClass?->name)
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all());
    }

    /**
     * The assessment open for marks: sheets handed in and still missing.
     *
     * @return array{plan: string, submitted: int, total: int, missing: int, teachers: int, closes_on: string|null, days_left: int|null}|null
     */
    protected function dashboardMarks(School $school, AcademicYear $year): ?array
    {
        $plan = AssessmentPlan::where('school_id', $school->id)
            ->whereIn('term_id', Term::where('academic_year_id', $year->id)->select('id'))
            ->whereIn('state', [AssessmentState::Scheduled, AssessmentState::MarksOpen])
            ->get()
            ->each(fn (AssessmentPlan $plan) => $plan->refreshState())
            ->firstWhere('state', AssessmentState::MarksOpen);

        if (! $plan) {
            return null;
        }

        $sheets = AssessmentSubject::whereIn('assessment_id', $plan->assessments()->select('id'))->get(['id', 'submitted_at', 'examiner_id']);
        $missing = $sheets->whereNull('submitted_at');

        return [
            'plan' => $plan->name,
            'submitted' => $sheets->count() - $missing->count(),
            'total' => $sheets->count(),
            'missing' => $missing->count(),
            'teachers' => $missing->pluck('examiner_id')->filter()->unique()->count(),
            'closes_on' => $plan->window_ends_on?->toDateString(),
            'days_left' => $plan->window_ends_on ? (int) today()->diffInDays($plan->window_ends_on, false) : null,
        ];
    }

    /**
     * Where the term's schemes of work stand.
     *
     * @return array{all: int, on_track: int, behind: int, to_approve: int, not_submitted: int, waiting_names: list<string>}|null
     */
    protected function dashboardSchemes(Term $term, ?int $week): ?array
    {
        if (! SchemeOpening::where('term_id', $term->id)->exists()) {
            return null;
        }

        $schemes = Scheme::where('term_id', $term->id)->with(['items', 'classSubject.subject:id,name', 'classSubject.schoolClass:id,name'])->get();
        $states = $schemes->map(fn (Scheme $scheme) => $scheme->followState($week));

        return [
            'all' => $schemes->count(),
            'on_track' => $states->filter(fn (string $state) => $state === 'on_track')->count(),
            'behind' => $states->filter(fn (string $state) => $state === 'behind')->count(),
            'to_approve' => $states->filter(fn (string $state) => $state === 'to_approve')->count(),
            'not_submitted' => $states->filter(fn (string $state) => in_array($state, ['not_submitted', 'sent_back'], true))->count(),
            'waiting_names' => array_values($schemes
                ->filter(fn (Scheme $scheme) => $scheme->status === SchemeStatus::Submitted)
                ->take(3)
                ->map(fn (Scheme $scheme) => $scheme->classSubject?->subject?->name.' · '.$scheme->classSubject?->schoolClass?->name)
                ->all()),
        ];
    }

    /**
     * Each class's average in the latest published assessment, and how
     * many of its students reached the pass mark.
     *
     * @return array{plan_id: string, plan: string, published_on: string|null, pass_mark: float, classes: list<array{id: string, name: string, average: float, passed: int, students: int}>}|null
     */
    protected function dashboardResults(School $school, AcademicYear $year): ?array
    {
        $plan = AssessmentPlan::where('school_id', $school->id)
            ->whereIn('term_id', Term::where('academic_year_id', $year->id)->select('id'))
            ->where('state', AssessmentState::Published)
            ->orderByDesc('published_at')
            ->first();

        if (! $plan) {
            return null;
        }

        $pass = (float) ($school->pass_mark ?: 10);
        $classes = SchoolClass::whereIn('id', $plan->assessments()->select('school_class_id'))->orderBy('name')->get();

        return [
            'plan_id' => $plan->id,
            'plan' => $plan->name,
            'published_on' => $plan->published_at?->toDateString(),
            'pass_mark' => $pass,
            'classes' => array_values($classes->map(function (SchoolClass $class) use ($plan, $pass) {
                $averages = collect($plan->standings($class))->pluck('average')->filter(fn (?float $average) => $average !== null);

                return [
                    'id' => $class->id,
                    'name' => $class->name,
                    'average' => round((float) $averages->avg(), 1),
                    'passed' => $averages->filter(fn (float $average) => $average >= $pass)->count(),
                    'students' => $averages->count(),
                ];
            })->filter(fn (array $row) => $row['students'] > 0)->values()->all()),
        ];
    }

    /**
     * Girls and boys enrolled at each level this year.
     *
     * @return list<array{name: string, girls: int, boys: int}>
     */
    protected function dashboardLevels(School $school, AcademicYear $year): array
    {
        $enrolments = Enrolment::where('academic_year_id', $year->id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->with(['student:id,gender', 'schoolClass:id,level_id'])
            ->get();
        $byLevel = $enrolments->groupBy(fn (Enrolment $enrolment) => (string) ($enrolment->level_id ?? $enrolment->schoolClass?->level_id));

        return array_values(Level::where('school_id', $school->id)->orderBy('ordinal')->get()
            ->map(fn (Level $level) => [
                'name' => $level->name,
                'girls' => $byLevel->get($level->id, collect())->filter(fn (Enrolment $enrolment) => $enrolment->student?->gender === Gender::Female)->count(),
                'boys' => $byLevel->get($level->id, collect())->filter(fn (Enrolment $enrolment) => $enrolment->student?->gender === Gender::Male)->count(),
            ])
            ->filter(fn (array $row) => $row['girls'] + $row['boys'] > 0)
            ->values()
            ->all());
    }

    /**
     * Next year's admissions, from application to a place in a class.
     *
     * @return array{year: string, applied: int, reviewed: int, admitted: int, placed: int, to_review: int, oldest_days: int|null}|null
     */
    protected function dashboardAdmissions(School $school): ?array
    {
        $year = EnrolmentController::nextYear($school);

        if (! $year) {
            return null;
        }

        $applications = Application::where('academic_year_id', $year->id)->get(['id', 'stage', 'student_id', 'created_at']);
        $waiting = $applications->filter(fn (Application $application) => $application->stage === ApplicationStage::ToReview);
        $admitted = $applications->filter(fn (Application $application) => $application->stage === ApplicationStage::Admitted);
        $oldest = $waiting->min('created_at');

        return [
            'year' => $year->label,
            'applied' => $applications->count(),
            'reviewed' => $applications->count() - $waiting->count(),
            'admitted' => $admitted->count(),
            'placed' => Enrolment::where('academic_year_id', $year->id)
                ->whereIn('student_id', $admitted->pluck('student_id')->filter())
                ->whereIn('status', [EnrolmentStatus::Placed, EnrolmentStatus::Enrolled])
                ->count(),
            'to_review' => $waiting->count(),
            'oldest_days' => $oldest ? (int) Carbon::parse($oldest)->diffInDays(today()) : null,
        ];
    }
}
