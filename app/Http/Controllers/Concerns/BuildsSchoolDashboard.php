<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\ApplicationStage;
use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Enums\AttendanceStatus;
use App\Enums\EnrolmentStatus;
use App\Enums\Gender;
use App\Enums\SchemeStatus;
use App\Http\FeeLedgerRows;
use App\Http\SchemePageData;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\Attendance;
use App\Models\Enrolment;
use App\Models\Installment;
use App\Models\Level;
use App\Models\Money;
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
use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

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
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $week = $term ? Scheme::currentWeek($term) : null;

        $fees = $user->can('manage-fees') && $year ? $this->rememberDashboard($school, $year, $term, $range, 'fees', fn () => $this->dashboardFees($school, $year, $term, $range)) : null;
        $marks = $user->can('manage-assessments') && $year ? $this->rememberDashboard($school, $year, $term, $range, 'marks', fn () => $this->dashboardMarks($school, $year)) : null;
        $schemes = $user->can('follow-schemes') && $term ? $this->rememberDashboard($school, $year, $term, $range, 'schemes', fn () => $this->dashboardSchemes($term, $week)) : null;
        $admissions = $user->can('manage-students') ? $this->rememberDashboard($school, $year, $term, $range, 'admissions', fn () => $this->dashboardAdmissions($school)) : null;
        $attendance = $this->rememberDashboard($school, $year, $term, $range, 'attendance', fn () => $this->dashboardAttendance($school, $year, $term, $range, $now));

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
            'results' => $user->can('manage-assessments') && $year ? $this->rememberDashboard($school, $year, $term, $range, 'results', fn () => $this->dashboardResults($school, $year)) : null,
            'levels' => $year ? $this->rememberDashboard($school, $year, $term, $range, 'levels', fn () => $this->dashboardLevels($school, $year)) : [],
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
     * @template TValue
     *
     * @param  Closure(): TValue  $build
     * @return TValue
     */
    protected function rememberDashboard(School $school, ?AcademicYear $year, ?Term $term, string $range, string $section, Closure $build): mixed
    {
        $key = implode(':', ['school-dashboard-v1', $school->id, $year->id ?? '-', $term->id ?? '-', $range, app()->getLocale(), now($school->timezone)->toDateString(), $section]);

        return Cache::remember($key, 120, $build);
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
        $invoices = (new FeeLedgerRows)->invoices($school, $year);
        $totals = $invoices->clone()->toBase()
            ->selectRaw('COALESCE(SUM(due_minor), 0) as due, COALESCE(SUM(paid_minor), 0) as paid, COALESCE(SUM(overdue_minor), 0) as overdue')
            ->selectRaw('COUNT(DISTINCT CASE WHEN overdue_minor > 0 THEN student_id END) as overdue_students')
            ->first();
        $parts = Installment::whereIn('invoice_id', $invoices->clone()->select('invoices.id'))
            ->toBase()->selectRaw('due_on, SUM(net_due_minor) as amount')->groupBy('due_on')->get();
        $fallback = $invoices->clone()->doesntHave('installments')->toBase()
            ->selectRaw('issued_on as due_on, SUM(due_minor) as amount')->groupBy('issued_on')->get();
        $parts = $parts->concat($fallback);
        $payments = Payment::whereIn('invoice_id', $invoices->clone()->select('invoices.id'))
            ->toBase()->selectRaw('DATE(received_at) as received_on, ROUND(SUM(amount), 2) as amount')->groupByRaw('DATE(received_at)')->get();
        $today = today();

        $series = $this->periods($range === 'year' || ! $term ? $year->starts_on : $term->starts_on, $range === 'year' || ! $term ? $year->ends_on : $term->ends_on, $range === 'year' || ! $term ? 'month' : 'week')
            ->map(fn (array $point) => [
                'label' => $point['label'],
                'starts_on' => $point['start']->toDateString(),
                'ends_on' => $point['end']->toDateString(),
                'due' => Money::number((int) $parts->filter(fn (object $part) => $part->due_on <= $point['end']->toDateString())->sum('amount')),
                'collected' => $point['start']->gt($today)
                    ? null
                    : Money::number(Money::sum($payments->filter(fn (object $payment) => $payment->received_on <= ($point['end']->lt($today) ? $point['end'] : $today)->toDateString())->pluck('amount'))),
            ])->values();

        return [
            'due' => Money::number((int) $totals->due),
            'collected' => Money::number((int) $totals->paid),
            'overdue' => Money::number((int) $totals->overdue),
            'overdue_students' => (int) $totals->overdue_students,
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

        $days = $mine()->whereDate('date', '>=', $from->toDateString())->whereDate('date', '<=', $now->toDateString())
            ->toBase()->selectRaw('DATE(date) as day, COUNT(*) as total, SUM(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END) as here', $present)
            ->groupByRaw('DATE(date)')->orderBy('day')->get()
            ->groupBy(fn (object $row) => $range === 'year' ? Carbon::parse($row->day)->startOfWeek()->toDateString() : (string) $row->day)
            ->map(fn (Collection $rows, string $date) => [
                'label' => Carbon::parse($date)->translatedFormat('j M'),
                'date' => $date,
                'rate' => round((int) $rows->sum('here') / max(1, (int) $rows->sum('total')) * 100, 1),
            ])->values();

        $todayCounts = $mine()->whereDate('date', $now->toDateString())->toBase()
            ->selectRaw('COUNT(DISTINCT student_id) as marked, COUNT(DISTINCT CASE WHEN status IN (?, ?) THEN student_id END) as here', $present)->first();
        $marked = (int) $todayCounts->marked;
        $here = (int) $todayCounts->here;
        $lowest = $mine()
            ->join('timetable_slots', 'timetable_slots.id', '=', 'attendance.timetable_slot_id')
            ->join('school_classes', 'school_classes.id', '=', 'timetable_slots.school_class_id')
            ->where('school_classes.school_id', $school->id)->whereNull('school_classes.deleted_at')
            ->whereDate('attendance.date', '>=', $now->copy()->subDays(30)->toDateString())
            ->toBase()->selectRaw('school_classes.name as class, SUM(CASE WHEN attendance.status IN (?, ?) THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as rate', $present)
            ->groupBy('school_classes.id', 'school_classes.name')->orderBy('rate')->orderBy('school_classes.name')->first();

        return [
            'today' => ['rate' => $marked > 0 ? round($here / $marked * 100, 1) : null, 'present' => $here, 'marked' => $marked],
            'series' => array_values(($range === 'year' ? $days : $days->take(-20))->all()),
            'lowest' => $lowest ? ['class' => (string) $lowest->class, 'rate' => round((float) $lowest->rate, 1)] : null,
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

        $counts = AssessmentSubject::whereIn('assessment_id', $plan->assessments()->select('id'))->toBase()
            ->selectRaw('COUNT(*) as total, COUNT(submitted_at) as submitted, COUNT(DISTINCT CASE WHEN submitted_at IS NULL THEN examiner_id END) as teachers')->first();

        return [
            'plan' => $plan->name,
            'submitted' => (int) $counts->submitted,
            'total' => (int) $counts->total,
            'missing' => (int) $counts->total - (int) $counts->submitted,
            'teachers' => (int) $counts->teachers,
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

        $query = (new SchemePageData)->query($term, $week);
        $counts = $query->clone()->selectRaw('state, COUNT(*) as total')->groupBy('state')->pluck('total', 'state');

        return [
            'all' => (int) $counts->sum(),
            'on_track' => (int) $counts->get('on_track', 0),
            'behind' => (int) $counts->get('behind', 0),
            'to_approve' => (int) $counts->get('to_approve', 0),
            'not_submitted' => (int) $counts->get('not_submitted', 0) + (int) $counts->get('sent_back', 0),
            'waiting_names' => array_values($query->clone()->where('status', SchemeStatus::Submitted->value)
                ->orderBy('subject')->orderBy('class')->limit(3)->get(['subject', 'class'])
                ->map(fn (object $row) => $row->subject.' · '.$row->class)->all()),
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
        $coefficient = $plan->kind === AssessmentKind::Exam ? 'coefficients.exam_coeff' : 'coefficients.sequence_coeff';
        $normalized = 'ROUND(marks.score * 20.0 / CASE WHEN assessment_subjects.max_score > 1 THEN assessment_subjects.max_score ELSE 1 END, 2)';
        $averages = DB::table('marks')
            ->join('assessment_subjects', 'assessment_subjects.id', '=', 'marks.assessment_subject_id')
            ->join('assessments', 'assessments.id', '=', 'assessment_subjects.assessment_id')
            ->join('school_classes', 'school_classes.id', '=', 'assessments.school_class_id')
            ->join('enrolments', function ($join) {
                $join->on('enrolments.student_id', '=', 'marks.student_id')->on('enrolments.school_class_id', '=', 'school_classes.id');
            })
            ->join('students', 'students.id', '=', 'marks.student_id')
            ->leftJoin('coefficients', 'coefficients.id', '=', 'assessment_subjects.coefficient_id')
            ->where('assessments.assessment_plan_id', $plan->id)->where('assessments.school_id', $school->id)
            ->where('school_classes.school_id', $school->id)->whereNull('school_classes.deleted_at')
            ->where('students.school_id', $school->id)->whereNull('students.deleted_at')
            ->where('enrolments.academic_year_id', $year->id)->where('enrolments.status', '!=', EnrolmentStatus::Left->value)
            ->where('marks.is_absent', false)->whereNotNull('marks.score')
            ->select('assessments.school_class_id as class_id', 'school_classes.name as class', 'marks.student_id')
            ->selectRaw("ROUND(SUM({$normalized} * COALESCE({$coefficient}, 0)) / NULLIF(SUM(COALESCE({$coefficient}, 0)), 0), 2) as average")
            ->groupBy('assessments.school_class_id', 'school_classes.name', 'marks.student_id');
        $classes = DB::query()->fromSub($averages, 'student_results')->whereNotNull('average')
            ->select('class_id', 'class')->selectRaw('AVG(average) as average, COUNT(*) as students, SUM(CASE WHEN average >= CAST(? AS NUMERIC) THEN 1 ELSE 0 END) as passed', [$pass])
            ->groupBy('class_id', 'class')->orderBy('class')->get();

        return [
            'plan_id' => $plan->id,
            'plan' => $plan->name,
            'published_on' => $plan->published_at?->toDateString(),
            'pass_mark' => $pass,
            'classes' => array_values($classes->map(fn (object $row) => [
                'id' => (string) $row->class_id,
                'name' => (string) $row->class,
                'average' => round((float) $row->average, 1),
                'passed' => (int) $row->passed,
                'students' => (int) $row->students,
            ])->all()),
        ];
    }

    /**
     * Girls and boys enrolled at each level this year.
     *
     * @return list<array{name: string, girls: int, boys: int}>
     */
    protected function dashboardLevels(School $school, AcademicYear $year): array
    {
        return array_values(DB::table('enrolments')
            ->join('students', 'students.id', '=', 'enrolments.student_id')
            ->leftJoin('school_classes', function ($join) {
                $join->on('school_classes.id', '=', 'enrolments.school_class_id')->whereNull('school_classes.deleted_at');
            })
            ->join('levels', 'levels.id', '=', DB::raw('COALESCE(enrolments.level_id, school_classes.level_id)'))
            ->where('enrolments.academic_year_id', $year->id)->where('enrolments.status', '!=', EnrolmentStatus::Left->value)
            ->where('students.school_id', $school->id)->whereNull('students.deleted_at')->where('levels.school_id', $school->id)->whereNull('levels.deleted_at')
            ->whereIn('students.gender', [Gender::Female->value, Gender::Male->value])
            ->select('levels.name')->selectRaw('SUM(CASE WHEN students.gender = ? THEN 1 ELSE 0 END) as girls, SUM(CASE WHEN students.gender = ? THEN 1 ELSE 0 END) as boys', [Gender::Female->value, Gender::Male->value])
            ->groupBy('levels.id', 'levels.name', 'levels.ordinal')->orderBy('levels.ordinal')->get()
            ->map(fn (object $row) => ['name' => (string) $row->name, 'girls' => (int) $row->girls, 'boys' => (int) $row->boys])->all());
    }

    /**
     * Next year's admissions, from application to a place in a class.
     *
     * @return array{year: string, applied: int, reviewed: int, admitted: int, placed: int, to_review: int, oldest_days: int|null}|null
     */
    protected function dashboardAdmissions(School $school): ?array
    {
        $year = $this->schoolContext->nextYear();

        if (! $year) {
            return null;
        }

        $applications = Application::where('academic_year_id', $year->id)->where('school_id', $school->id);
        $counts = $applications->clone()->toBase()
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN stage = ? THEN 1 ELSE 0 END) as waiting, SUM(CASE WHEN stage = ? THEN 1 ELSE 0 END) as admitted, MIN(CASE WHEN stage = ? THEN created_at END) as oldest', [ApplicationStage::ToReview->value, ApplicationStage::Admitted->value, ApplicationStage::ToReview->value])->first();

        return [
            'year' => $year->label,
            'applied' => (int) $counts->total,
            'reviewed' => (int) $counts->total - (int) $counts->waiting,
            'admitted' => (int) $counts->admitted,
            'placed' => Enrolment::where('academic_year_id', $year->id)
                ->whereIn('student_id', $applications->clone()->where('stage', ApplicationStage::Admitted)->whereNotNull('student_id')->select('student_id'))
                ->whereIn('status', [EnrolmentStatus::Placed, EnrolmentStatus::Enrolled])->count(),
            'to_review' => (int) $counts->waiting,
            'oldest_days' => $counts->oldest ? (int) Carbon::parse($counts->oldest)->diffInDays(today()) : null,
        ];
    }
}
