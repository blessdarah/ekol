<?php

namespace App\Models;

use App\Enums\AssessmentKind;
use App\Enums\AssessmentState;
use App\Enums\CoefficientStatus;
use App\Enums\EnrolmentStatus;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One assessment for the whole school in a term: Sequence 1, the Term
 * 1 exam. Each class in its levels gets its own assessment row and a
 * mark sheet per subject; the plan carries the dates and the state.
 *
 * @property string $id
 * @property string $school_id
 * @property string $term_id
 * @property AssessmentKind $kind
 * @property string $name
 * @property AssessmentState $state
 * @property Carbon|null $held_from
 * @property Carbon|null $held_until
 * @property Carbon|null $window_starts_on
 * @property Carbon|null $window_ends_on
 * @property list<string> $level_ids
 * @property Carbon|null $schedule_published_at
 * @property Carbon|null $closed_at
 * @property Carbon|null $published_at
 * @property string|null $published_by
 */
class AssessmentPlan extends Model
{
    use BelongsToSchool, HasUuids;

    /**
     * Every sheet is marked out of this.
     */
    public const int OUT_OF = 20;

    protected $fillable = [
        'school_id',
        'term_id',
        'kind',
        'name',
        'state',
        'held_from',
        'held_until',
        'window_starts_on',
        'window_ends_on',
        'level_ids',
        'schedule_published_at',
        'closed_at',
        'published_at',
        'published_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => AssessmentKind::class,
            'state' => AssessmentState::class,
            'held_from' => 'date',
            'held_until' => 'date',
            'window_starts_on' => 'date',
            'window_ends_on' => 'date',
            'level_ids' => 'array',
            'schedule_published_at' => 'datetime',
            'closed_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    /**
     * Positions for a set of averages, best first. Equal averages
     * share a position and the next one is skipped: 1, 2, 2, 4.
     *
     * @param  array<string, float>  $averages
     * @return array<string, int>
     */
    public static function rank(array $averages): array
    {
        arsort($averages);
        $ranks = [];
        $position = 0;
        $seen = 0;
        $previous = null;

        foreach ($averages as $id => $average) {
            $seen++;

            if ($previous === null || abs($average - $previous) > 0.0001) {
                $position = $seen;
            }

            $ranks[$id] = $position;
            $previous = $average;
        }

        return $ranks;
    }

    /**
     * A scheduled assessment opens for marks on the first day of its
     * window. Called when its screens load, so no clock job is needed.
     */
    public function refreshState(): static
    {
        if ($this->state === AssessmentState::Scheduled && $this->window_starts_on && today()->gte($this->window_starts_on)) {
            $this->sync();
            $this->moveTo(AssessmentState::MarksOpen);
        }

        return $this;
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public function moveTo(AssessmentState $state, array $extra = []): void
    {
        $this->update(['state' => $state, ...$extra]);
        $this->assessments()->update(['state' => $state]);
    }

    /**
     * Whether a teacher may enter or change marks right now.
     */
    public function acceptsMarks(): bool
    {
        return $this->state === AssessmentState::MarksOpen
            && $this->window_starts_on !== null
            && $this->window_ends_on !== null
            && today()->between($this->window_starts_on, $this->window_ends_on);
    }

    /**
     * Give every class in the plan's levels its assessment and one
     * mark sheet per subject it takes, each with the coefficient of the
     * day. Safe to run again: it only adds what is missing.
     */
    public function sync(): void
    {
        $term = Term::whereKey($this->term_id)->firstOrFail();
        $classes = SchoolClass::where('school_id', $this->school_id)
            ->where('academic_year_id', $term->academic_year_id)
            ->whereIn('level_id', $this->level_ids)
            ->get();
        $lessons = ClassSubject::whereIn('school_class_id', $classes->modelKeys())
            ->whereHas('subject')
            ->with('subject')
            ->get()
            ->groupBy('school_class_id');

        foreach ($classes as $class) {
            $assessment = Assessment::firstOrCreate(
                ['assessment_plan_id' => $this->id, 'school_class_id' => $class->id],
                [
                    'school_id' => $this->school_id,
                    'term_id' => $this->term_id,
                    'kind' => $this->kind,
                    'name' => $this->name,
                    'state' => $this->state,
                    'sequence_weight' => 1,
                    'exam_weight' => 1,
                    'total_max' => static::OUT_OF,
                ],
            );

            $assessment->update([
                'window_starts_on' => $this->window_starts_on,
                'window_ends_on' => $this->window_ends_on,
            ]);

            foreach ($lessons->get($class->id, []) as $lesson) {
                $weight = $lesson->subject->coefficient ?? 1;
                $coefficient = Coefficient::firstOrCreate(
                    ['subject_id' => $lesson->subject_id, 'level_id' => $class->level_id],
                    ['sequence_coeff' => $weight, 'exam_coeff' => $weight, 'status' => CoefficientStatus::Complete],
                );

                $sheet = AssessmentSubject::firstOrCreate(
                    ['assessment_id' => $assessment->id, 'subject_id' => $lesson->subject_id],
                    ['coefficient_id' => $coefficient->id, 'max_score' => static::OUT_OF, 'examiner_id' => $lesson->staff_id],
                );

                if ($sheet->submitted_at === null && $sheet->examiner_id !== $lesson->staff_id) {
                    $sheet->update(['examiner_id' => $lesson->staff_id]);
                }
            }
        }
    }

    /**
     * Every mark sheet of the plan, with its class, subject and how
     * many marks are in.
     *
     * @return Collection<int, AssessmentSubject>
     */
    public function sheets(): Collection
    {
        return AssessmentSubject::whereIn('assessment_id', $this->assessments()->select('id'))
            ->with(['assessment.schoolClass.formMaster:id,full_name', 'subject:id,name', 'coefficient', 'examiner:id,full_name,initials,phone'])
            ->withCount(['marks as entered_count' => fn ($query) => $query->where(fn ($inner) => $inner->whereNotNull('score')->orWhere('is_absent', true))])
            ->get();
    }

    /**
     * Each student of a class with their average in this assessment:
     * the marks weighted by subject coefficient, out of 20. A student
     * marked absent in a subject is left out of that subject; one with
     * a mark still missing has an average so far but is not complete.
     *
     * @return array<string, array{name: string, matricule: string, average: float|null, entered: int, expected: int, missing: list<string>, complete: bool, subjects: list<array{mark_id: string|null, subject: string, coefficient: float, score: float|null, absent: bool}>}>
     */
    public function standings(SchoolClass $class): array
    {
        $assessment = $this->assessments()->where('school_class_id', $class->id)->first();
        $sheets = $assessment
            ? AssessmentSubject::where('assessment_id', $assessment->id)->with(['subject:id,name', 'coefficient', 'marks'])->get()
                ->sortBy(fn (AssessmentSubject $sheet) => $sheet->subject?->name)->values()
            : new Collection;
        $students = Enrolment::where('school_class_id', $class->id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->whereHas('student')
            ->with('student:id,full_name,admission_no')
            ->get()
            ->map(fn (Enrolment $enrolment) => $enrolment->student)
            ->filter()
            ->sortBy('full_name');
        $rows = [];

        foreach ($students as $student) {
            $weighted = 0.0;
            $weights = 0.0;
            $entered = 0;
            $missing = [];
            $subjects = [];

            foreach ($sheets as $sheet) {
                $mark = $sheet->marks->firstWhere('student_id', $student->id);
                $coefficient = (float) ($this->kind === AssessmentKind::Exam
                    ? $sheet->coefficient?->exam_coeff
                    : $sheet->coefficient?->sequence_coeff);
                $name = (string) $sheet->subject?->name;
                $score = $mark && ! $mark->is_absent && $mark->score !== null
                    ? round((float) $mark->score / max(1.0, (float) $sheet->max_score) * static::OUT_OF, 2)
                    : null;

                if ($mark?->is_absent) {
                    $entered++;
                } elseif ($score === null) {
                    $missing[] = $name;
                } else {
                    $entered++;
                    $weighted += $score * $coefficient;
                    $weights += $coefficient;
                }

                $subjects[] = [
                    'mark_id' => $mark?->id,
                    'subject' => $name,
                    'coefficient' => $coefficient,
                    'score' => $score,
                    'absent' => (bool) $mark?->is_absent,
                ];
            }

            $rows[$student->id] = [
                'name' => $student->full_name,
                'matricule' => $student->admission_no,
                'average' => $weights > 0 ? round($weighted / $weights, 2) : null,
                'entered' => $entered,
                'expected' => $sheets->count(),
                'missing' => $missing,
                'complete' => $missing === [] && $weights > 0,
                'subjects' => $subjects,
            ];
        }

        return $rows;
    }

    /**
     * @return HasMany<Assessment, $this>
     */
    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class);
    }

    /**
     * @return HasMany<ExamPaper, $this>
     */
    public function papers(): HasMany
    {
        return $this->hasMany(ExamPaper::class);
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * The year's plans, oldest first, each moved to marks-open when its
     * window has started.
     *
     * @return Collection<int, AssessmentPlan>
     */
    public static function forYear(School $school, ?AcademicYear $year): Collection
    {
        if (! $year) {
            return new Collection;
        }

        return AssessmentPlan::where('school_id', $school->id)
            ->whereIn('term_id', Term::where('academic_year_id', $year->id)->select('id'))
            ->with('term:id,label,sequence,is_current')
            ->get()
            ->each(fn (AssessmentPlan $plan) => $plan->refreshState())
            ->sortBy(fn (AssessmentPlan $plan) => [
                $plan->term?->sequence,
                $plan->held_from?->toDateString() ?? '9999',
                $plan->kind === AssessmentKind::Exam ? 1 : 0,
                $plan->name,
            ])
            ->values();
    }

    /**
     * The badges on the tab bar every assessment screen shares.
     *
     * @return array{missing: int, clashes: int, pending: int}
     */
    public static function tabs(School $school, ?AcademicYear $year): array
    {
        $plans = static::forYear($school, $year);
        $open = $plans->where('state', AssessmentState::MarksOpen);

        return [
            'missing' => $open->isEmpty() ? 0 : AssessmentSubject::whereNull('submitted_at')
                ->whereHas('assessment', fn ($query) => $query->whereIn('assessment_plan_id', $open->modelKeys()))
                ->count(),
            'clashes' => (int) $plans
                ->filter(fn (AssessmentPlan $plan) => $plan->kind === AssessmentKind::Exam && $plan->schedule_published_at === null)
                ->sum(fn (AssessmentPlan $plan) => count($plan->clashes())),
            'pending' => MarkCorrection::where('school_id', $school->id)->where('status', 'pending')->count(),
        ];
    }

    /**
     * A plan as the lists and pickers show it.
     *
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'kind' => $this->kind->value,
            'state' => $this->state->value,
            'term' => $this->term?->label,
            'held_from' => $this->held_from?->toDateString(),
            'held_until' => $this->held_until?->toDateString(),
            'window_starts_on' => $this->window_starts_on?->toDateString(),
            'window_ends_on' => $this->window_ends_on?->toDateString(),
            'days_left' => $this->state === AssessmentState::MarksOpen && $this->window_ends_on
                ? (int) today()->diffInDays($this->window_ends_on, false)
                : null,
            'has_schedule' => $this->schedule_published_at !== null,
            'closed_on' => $this->closed_at?->toDateString(),
            'published_on' => $this->published_at?->toDateString(),
        ];
    }

    /**
     * Rooms and invigilators booked for two papers at the same time.
     *
     * @return list<array{paper_ids: list<string>, text: string}>
     */
    public function clashes(): array
    {
        $papers = $this->papers()->with(['subject:id,name', 'level:id,name', 'room:id,code'])->get()->values();
        $names = User::whereIn('id', $papers->flatMap(fn (ExamPaper $paper) => $paper->invigilator_ids)->unique()->values())->pluck('full_name', 'id');
        $clashes = [];

        foreach ($papers as $position => $paper) {
            foreach ($papers->slice($position + 1) as $other) {
                if (! $paper->overlaps($other)) {
                    continue;
                }

                $when = $paper->held_on->translatedFormat('D j M').' at '.substr($paper->starts_at, 0, 5);
                $pair = "{$paper->level?->name} {$paper->subject?->name} and {$other->level?->name} {$other->subject?->name}";

                if ($paper->room_id && $paper->room_id === $other->room_id) {
                    $clashes[] = ['paper_ids' => [$paper->id, $other->id], 'text' => "{$paper->room?->code} is used by {$pair} on {$when}"];
                }

                foreach (array_intersect($paper->invigilator_ids, $other->invigilator_ids) as $staffId) {
                    $clashes[] = ['paper_ids' => [$paper->id, $other->id], 'text' => "{$names->get($staffId)} invigilates {$pair} on {$when}"];
                }
            }
        }

        return $clashes;
    }

    /**
     * Each student of a class across a term's assessments. Only
     * published assessments count. The term average is the mean of
     * the assessment averages, and exists once the student has one in
     * every published assessment.
     *
     * @param  Collection<int, AssessmentPlan>  $plans
     * @return array<string, array{name: string, matricule: string, values: array<string, float|null>, average: float|null}>
     */
    public static function termRows(Collection $plans, SchoolClass $class): array
    {
        $published = $plans->where('state', AssessmentState::Published);
        $rows = [];

        foreach ($published as $plan) {
            foreach ($plan->standings($class) as $studentId => $row) {
                $rows[$studentId] ??= ['name' => $row['name'], 'matricule' => $row['matricule'], 'values' => [], 'average' => null];
                $rows[$studentId]['values'][$plan->id] = $row['complete'] ? $row['average'] : null;
            }
        }

        foreach ($rows as $studentId => $row) {
            $values = array_filter($row['values'], fn (?float $value) => $value !== null);
            $rows[$studentId]['average'] = $values !== [] && count($values) === $published->count()
                ? round(array_sum($values) / count($values), 2)
                : null;
        }

        return $rows;
    }
}
