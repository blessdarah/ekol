<?php

namespace App\Http\Controllers;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Enums\Gender;
use App\Http\Controllers\Concerns\BuildsSchoolDashboard;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\Attendance;
use App\Models\Enrolment;
use App\Models\Invoice;
use App\Models\Period;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\TimetableVersion;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Where a person lands after signing in. Teachers get their day;
 * everyone else gets the school dashboard.
 */
class DashboardController extends Controller
{
    use BuildsSchoolDashboard;

    public function show(Request $request): Response
    {
        $user = $request->user();
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if ($school instanceof School && app()->bound('currentPlatformVisit')) {
            return $this->schoolOverview($school);
        }

        if (! $user || ! $school instanceof School) {
            return Inertia::render('dashboard');
        }

        if ($user->role->teaches()) {
            return $this->today($user, $school);
        }

        $range = $request->query('range') === 'year' ? 'year' : 'term';

        return Inertia::render('dashboard', $this->schoolDashboard($user, $school, $range));
    }

    protected function schoolOverview(School $school): Response
    {
        $year = StructureController::currentYear($school);
        $term = StudentController::currentTerm($school);
        $enrolments = $year ? Enrolment::where('academic_year_id', $year->id)->where('status', EnrolmentStatus::Enrolled)->count() : 0;
        $invoices = Invoice::whereHas('student', fn ($q) => $q->where('school_id', $school->id))
            ->when($term, fn ($q) => $q->where('term_id', $term->id))->with('student')->withSum('payments', 'amount')->with('exemption')->get();
        $due = $invoices->sum('amount_due');
        $paid = $invoices->sum('payments_sum_amount');
        $balance = fn ($invoice) => max(0, (float) $invoice->amount_due - (float) $invoice->getAttribute('payments_sum_amount') - (float) ($invoice->exemption->amount ?? 0));
        $overdue = $invoices->filter(fn ($invoice) => $balance($invoice) > 0)->values();
        $staff = User::where('school_id', $school->id)->whereIn('role', ['teacher', 'form_master', 'head_of_department'])->count();
        $openPlans = AssessmentPlan::where('school_id', $school->id)->where('state', 'marks_open')->count();

        return Inertia::render('platform/school-dashboard', [
            'date' => now($school->timezone)->translatedFormat('l, j F'), 'schoolName' => $school->name,
            'students' => $enrolments, 'classes' => $year ? SchoolClass::where('academic_year_id', $year->id)->count() : 0,
            'teachers' => $staff, 'collected' => $paid, 'billed' => $due,
            'percent' => $due > 0 ? min(100, (int) round($paid / $due * 100)) : 0,
            'openAssessments' => $openPlans, 'overdueCount' => $overdue->count(),
            'overdue' => $overdue->take(5)->map(fn ($invoice) => ['id' => $invoice->student_id, 'name' => $invoice->student->full_name,
                'admission' => $invoice->student->admission_no, 'balance' => $balance($invoice)]),
        ]);
    }

    /**
     * A teacher's day: the lessons the live timetable gives her today,
     * the one coming up, and the mark sheets she still has to fill.
     */
    protected function today(User $teacher, School $school): Response
    {
        $now = now($school->timezone);
        $term = StudentController::currentTerm($school);
        $live = $term ? TimetableVersion::liveFor($term) : null;
        $lessons = $live ? $this->lessons($teacher, $school, $live, $now) : [];
        $next = collect($lessons)->first(fn (array $lesson) => $lesson['state'] === 'now')
            ?? collect($lessons)->first(fn (array $lesson) => $lesson['state'] === 'next');
        $sheets = $this->sheets($teacher, $school, $term);
        $open = collect($sheets)->where('open', true);

        return Inertia::render('teacher/today', [
            'date' => $now->translatedFormat('l j F'),
            'greeting' => match (true) {
                $now->hour < 12 => 'Good morning',
                $now->hour < 17 => 'Good afternoon',
                default => 'Good evening',
            },
            'name' => $this->formal($teacher),
            'hasTimetable' => $live !== null,
            'isSchoolDay' => ($school->school_days & (1 << ($now->dayOfWeekIso - 1))) !== 0,
            'lessons' => $lessons,
            'unmarked' => collect($lessons)->filter(fn (array $lesson) => ! $lesson['marked'] && in_array($lesson['state'], ['done', 'now'], true))->count(),
            'next' => $next,
            'sheets' => $sheets,
            'openSheets' => $open->count(),
            'closesOn' => $open->pluck('closes_on')->filter()->unique()->count() === 1 ? $open->first()['closes_on'] : null,
        ]);
    }

    /**
     * @return list<array{id: string, starts_at: string, ends_at: string, class: string, subject: string, room: string|null, students: int, state: string, marked: bool, in_minutes: int|null}>
     */
    protected function lessons(User $teacher, School $school, TimetableVersion $live, CarbonInterface $now): array
    {
        $periods = Period::where('school_id', $school->id)->get()->keyBy('id');
        $slots = TimetableSlot::where('timetable_version_id', $live->id)
            ->where('staff_id', $teacher->id)
            ->where('weekday', $now->dayOfWeekIso - 1)
            ->with(['schoolClass:id,name', 'subject:id,name', 'room:id,code'])
            ->get()
            ->sortBy(fn (TimetableSlot $slot) => $periods->get($slot->period_id)?->starts_at)
            ->values();
        $sizes = Enrolment::whereIn('school_class_id', $slots->pluck('school_class_id')->unique())
            ->where('status', '!=', EnrolmentStatus::Left)
            ->get(['school_class_id'])
            ->countBy('school_class_id');
        $registers = Attendance::whereIn('timetable_slot_id', $slots->modelKeys())
            ->whereDate('date', $now->toDateString())
            ->distinct()
            ->pluck('timetable_slot_id')
            ->all();
        $clock = $now->format('H:i:s');
        $upcoming = false;
        $lessons = [];

        foreach ($slots as $slot) {
            $period = $periods->get($slot->period_id);

            if (! $period) {
                continue;
            }

            $state = match (true) {
                $clock >= $period->ends_at => 'done',
                $clock >= $period->starts_at => 'now',
                ! $upcoming => 'next',
                default => 'later',
            };
            $upcoming = $upcoming || $state === 'next';
            [$hour, $minute] = array_map('intval', explode(':', $period->starts_at));

            $lessons[] = [
                'id' => $slot->id,
                'starts_at' => substr($period->starts_at, 0, 5),
                'ends_at' => substr($period->ends_at, 0, 5),
                'class' => (string) $slot->schoolClass?->name,
                'subject' => (string) $slot->subject?->name,
                'room' => $slot->room?->code,
                'students' => (int) $sizes->get($slot->school_class_id, 0),
                'state' => $state,
                'marked' => in_array($slot->id, $registers, true),
                'in_minutes' => $state === 'next' ? max(0, ($hour * 60 + $minute) - ($now->hour * 60 + $now->minute)) : null,
            ];
        }

        return $lessons;
    }

    /**
     * Mark sheets that are open now or coming up, open ones first.
     *
     * @return list<array{id: string, plan: string, class: string, subject: string, students: int, entered: int, open: bool, submitted: bool, opens_on: string|null, closes_on: string|null}>
     */
    protected function sheets(User $teacher, School $school, ?Term $term): array
    {
        if (! $term) {
            return [];
        }

        $plans = AssessmentPlan::where('school_id', $school->id)
            ->whereIn('term_id', Term::where('academic_year_id', $term->academic_year_id)->select('id'))
            ->whereIn('state', [AssessmentState::Scheduled, AssessmentState::MarksOpen])
            ->get()
            ->each(fn (AssessmentPlan $plan) => $plan->refreshState())
            ->keyBy('id');

        $sheets = AssessmentSubject::where('examiner_id', $teacher->id)
            ->whereHas('assessment', fn ($query) => $query->whereIn('assessment_plan_id', $plans->keys()))
            ->with(['assessment.schoolClass:id,name', 'subject:id,name'])
            ->withCount(['marks as entered_count' => fn ($query) => $query->where(fn ($inner) => $inner->whereNotNull('score')->orWhere('is_absent', true))])
            ->get();
        $sizes = Enrolment::whereIn('school_class_id', $sheets->map(fn (AssessmentSubject $sheet) => $sheet->assessment?->school_class_id)->filter()->unique())
            ->where('status', '!=', EnrolmentStatus::Left)
            ->get(['school_class_id'])
            ->countBy('school_class_id');

        return array_values($sheets
            ->map(function (AssessmentSubject $sheet) use ($plans, $sizes) {
                $plan = $plans->get((string) $sheet->assessment?->assessment_plan_id);

                return [
                    'id' => $sheet->id,
                    'plan' => (string) $plan?->name,
                    'class' => (string) $sheet->assessment?->schoolClass?->name,
                    'subject' => (string) $sheet->subject?->name,
                    'students' => (int) $sizes->get((string) $sheet->assessment?->school_class_id, 0),
                    'entered' => (int) $sheet->getAttribute('entered_count'),
                    'open' => (bool) $plan?->acceptsMarks(),
                    'submitted' => $sheet->submitted_at !== null,
                    'opens_on' => $plan?->window_starts_on?->toDateString(),
                    'closes_on' => $plan?->window_ends_on?->toDateString(),
                ];
            })
            ->sortBy([['open', 'desc'], ['submitted', 'asc'], ['closes_on', 'asc'], ['class', 'asc']])
            ->values()
            ->all());
    }

    /**
     * How the school addresses a teacher: "Mr. Tanjong".
     */
    protected function formal(User $teacher): string
    {
        $parts = preg_split('/\s+/', trim($teacher->full_name)) ?: [];
        $family = $teacher->family_name ?? (string) end($parts);
        $title = match ($teacher->gender) {
            Gender::Male => 'Mr. ',
            Gender::Female => 'Mrs. ',
            default => '',
        };

        return $title.$family;
    }
}
