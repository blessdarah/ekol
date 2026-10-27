<?php

namespace App\Models;

use App\Enums\SchemeStatus;
use App\Enums\UserRole;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * What a teacher plans to teach one class in one subject over a term,
 * week by week, and how far they have got. One per subject and class
 * for each term the schemes are opened.
 *
 * @property string $id
 * @property string $school_id
 * @property string $term_id
 * @property string $class_subject_id
 * @property SchemeStatus $status
 * @property Carbon|null $submitted_at
 * @property Carbon|null $approved_at
 * @property string|null $approved_by
 * @property Carbon|null $closed_at
 */
class Scheme extends Model
{
    use BelongsToSchool, HasUuids;

    /**
     * A closed scheme under this share of its sub-topics taught is
     * flagged in the coverage report.
     */
    public const int COVERED_PERCENT = 80;

    protected $fillable = [
        'school_id',
        'term_id',
        'class_subject_id',
        'status',
        'submitted_at',
        'approved_at',
        'approved_by',
        'closed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => SchemeStatus::class,
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * The weeks of a term, Monday to Friday, numbered from the week it
     * starts. A week with tests or exams for the level is kept free of
     * new topics.
     *
     * @return list<array{week: int, starts_on: string, ends_on: string, free: string|null}>
     */
    public static function weeks(Term $term, ?string $levelId = null): array
    {
        $plans = AssessmentPlan::where('term_id', $term->id)
            ->whereNotNull('held_from')
            ->get()
            ->filter(fn (AssessmentPlan $plan) => $levelId === null || $plan->level_ids === [] || in_array($levelId, $plan->level_ids, true));
        $monday = $term->starts_on->copy()->startOfWeek();
        $weeks = [];

        for ($week = 1; $week <= max(1, $term->week_count); $week++) {
            $starts = $monday->copy()->addWeeks($week - 1);
            $ends = $starts->copy()->addDays(4);
            $plan = $plans->first(fn (AssessmentPlan $plan) => $plan->held_from?->lte($ends)
                && ($plan->held_until ?? $plan->held_from)->gte($starts));

            $weeks[] = [
                'week' => $week,
                'starts_on' => $starts->toDateString(),
                'ends_on' => $ends->toDateString(),
                'free' => $plan?->name,
            ];
        }

        return $weeks;
    }

    /**
     * The week of the term today falls in, or null before it starts.
     */
    public static function currentWeek(Term $term): ?int
    {
        $monday = $term->starts_on->copy()->startOfWeek();

        if (today()->lt($monday)) {
            return null;
        }

        return min(max(1, $term->week_count), intdiv((int) $monday->diffInDays(today()), 7) + 1);
    }

    /**
     * Open the term's schemes: one for each subject taught in each class
     * that does not have one yet, filled from the syllabus or from last
     * year's scheme, with what the previous term left untaught first.
     *
     * @return int how many schemes were created
     */
    public static function openFor(SchemeOpening $opening, ?User $by = null): int
    {
        $term = Term::whereKey($opening->term_id)->firstOrFail();
        $existing = static::where('term_id', $term->id)->pluck('class_subject_id')->all();
        $classSubjects = ClassSubject::where('school_id', $term->school_id)
            ->whereHas('schoolClass', fn ($query) => $query->where('academic_year_id', $term->academic_year_id))
            ->whereNotIn('id', $existing)
            ->with('schoolClass')
            ->get();
        $previousTerm = Term::where('academic_year_id', $term->academic_year_id)->where('sequence', $term->sequence - 1)->first();

        return DB::transaction(function () use ($opening, $by, $term, $classSubjects, $previousTerm) {
            foreach ($classSubjects as $classSubject) {
                $scheme = static::create([
                    'school_id' => $term->school_id,
                    'term_id' => $term->id,
                    'class_subject_id' => $classSubject->id,
                    'status' => SchemeStatus::NotStarted,
                ]);
                $carried = $previousTerm ? static::untaughtFrom($previousTerm, $classSubject) : [];
                $planned = $opening->starts_from === SchemeOpening::FROM_LAST_YEAR
                    ? (static::fromLastYear($term, $classSubject) ?? static::fromSyllabus($term, $classSubject))
                    : static::fromSyllabus($term, $classSubject);

                foreach ([...$carried, ...$planned] as $position => $item) {
                    $scheme->items()->create([...$item, 'position' => $position + 1]);
                }

                $scheme->record('opened', $by, $opening->starts_from === SchemeOpening::FROM_LAST_YEAR ? 'last_year' : 'syllabus');
            }

            return $classSubjects->count();
        });
    }

    /**
     * The syllabus topics of the class's level for this term, one item
     * per sub-topic, in the weeks the syllabus suggests.
     *
     * @return list<array<string, mixed>>
     */
    protected static function fromSyllabus(Term $term, ClassSubject $classSubject): array
    {
        $topics = SyllabusTopic::where('level_id', $classSubject->schoolClass?->level_id)
            ->where('subject_id', $classSubject->subject_id)
            ->where('term_sequence', $term->sequence)
            ->with('subtopics')
            ->orderBy('position')
            ->get();
        $items = [];

        foreach ($topics as $topic) {
            $week = $topic->week_from !== null ? min($topic->week_from, max(1, $term->week_count)) : null;

            if ($topic->subtopics->isEmpty()) {
                $items[] = ['syllabus_topic_id' => $topic->id, 'topic' => $topic->name, 'name' => null, 'week' => $week, 'periods' => $topic->periods];

                continue;
            }

            foreach ($topic->subtopics as $subtopic) {
                $items[] = [
                    'syllabus_topic_id' => $topic->id,
                    'syllabus_subtopic_id' => $subtopic->id,
                    'topic' => $topic->name,
                    'name' => $subtopic->name,
                    'week' => $week,
                    'periods' => $subtopic->periods,
                ];
            }
        }

        return $items;
    }

    /**
     * The same term's scheme from last year, for the same subject, level
     * and teacher, with its weeks; null when there is none.
     *
     * @return array<int, array<string, mixed>>|null
     */
    protected static function fromLastYear(Term $term, ClassSubject $classSubject): ?array
    {
        $year = AcademicYear::whereKey($term->academic_year_id)->first();
        $lastYear = $year ? AcademicYear::where('school_id', $term->school_id)->where('starts_on', '<', $year->starts_on)->orderByDesc('starts_on')->first() : null;
        $lastTerm = $lastYear ? Term::where('academic_year_id', $lastYear->id)->where('sequence', $term->sequence)->first() : null;

        if (! $lastTerm || ! $classSubject->staff_id) {
            return null;
        }

        $scheme = static::where('term_id', $lastTerm->id)
            ->whereHas('classSubject', fn ($query) => $query
                ->where('subject_id', $classSubject->subject_id)
                ->where('staff_id', $classSubject->staff_id)
                ->whereHas('schoolClass', fn ($inner) => $inner->where('level_id', $classSubject->schoolClass?->level_id)))
            ->with('items')
            ->first();

        if (! $scheme || $scheme->items->isEmpty()) {
            return null;
        }

        return $scheme->items
            ->reject(fn (SchemeItem $item) => $item->carried_over)
            ->map(fn (SchemeItem $item) => [
                'syllabus_topic_id' => $item->syllabus_topic_id,
                'syllabus_subtopic_id' => $item->syllabus_subtopic_id,
                'topic' => $item->topic,
                'name' => $item->name,
                'week' => $item->week !== null ? min($item->week, max(1, $term->week_count)) : null,
                'periods' => $item->periods,
                'added_by_teacher' => $item->added_by_teacher,
            ])
            ->values()
            ->all();
    }

    /**
     * What the class's scheme last term did not get to, to start this
     * term's scheme with.
     *
     * @return array<int, array<string, mixed>>
     */
    protected static function untaughtFrom(Term $previousTerm, ClassSubject $classSubject): array
    {
        $scheme = static::where('term_id', $previousTerm->id)
            ->where('class_subject_id', $classSubject->id)
            ->where('status', SchemeStatus::Closed)
            ->with('items')
            ->first();

        return $scheme
            ? $scheme->items->whereNull('taught_on')->map(fn (SchemeItem $item) => [
                'syllabus_topic_id' => $item->syllabus_topic_id,
                'syllabus_subtopic_id' => $item->syllabus_subtopic_id,
                'topic' => $item->topic,
                'name' => $item->name,
                'week' => 1,
                'periods' => $item->periods,
                'added_by_teacher' => $item->added_by_teacher,
                'carried_over' => true,
            ])->values()->all()
            : [];
    }

    /**
     * How the scheme stands for the school following progress: waiting
     * for a teacher, not submitted, to approve, or, once approved, on
     * track or behind the plan for the weeks already gone.
     */
    public function followState(?int $currentWeek): string
    {
        return match (true) {
            $this->status === SchemeStatus::Closed => 'closed',
            $this->classSubject?->staff_id === null => 'waiting',
            $this->status === SchemeStatus::Submitted => 'to_approve',
            $this->status === SchemeStatus::ChangesRequested => 'sent_back',
            ! $this->status->isSubmitted() => 'not_submitted',
            $this->isBehind($currentWeek) => 'behind',
            default => 'on_track',
        };
    }

    /**
     * Whether something planned before this week is not taught yet.
     */
    public function isBehind(?int $currentWeek): bool
    {
        return $currentWeek !== null && $this->items
            ->filter(fn (SchemeItem $item) => $item->week !== null && $item->week < $currentWeek)
            ->contains(fn (SchemeItem $item) => $item->taught_on === null);
    }

    /**
     * Sub-topics planned up to and including a week, and how many of
     * them are taught.
     *
     * @return array{planned: int, taught: int}
     */
    public function progressTo(?int $week): array
    {
        $planned = $week === null ? collect() : $this->items->filter(fn (SchemeItem $item) => $item->week !== null && $item->week <= $week);

        return ['planned' => $planned->count(), 'taught' => $planned->whereNotNull('taught_on')->count()];
    }

    /**
     * The share of the whole scheme taught, as a whole percentage.
     */
    public function coverage(): int
    {
        $total = $this->items->count();

        return $total === 0 ? 0 : (int) floor($this->items->whereNotNull('taught_on')->count() / $total * 100);
    }

    /**
     * Whether a person may approve this scheme or send it back: the
     * principal, academic lead or administrator always; a head of
     * department for subjects of their department when heads approve.
     */
    public function canBeApprovedBy(User $user, ?SchemeOpening $opening): bool
    {
        if (in_array($user->role, [UserRole::Principal, UserRole::AcademicLead, UserRole::Admin], true)) {
            return true;
        }

        if ($user->role !== UserRole::HeadOfDepartment || $opening?->approval !== SchemeOpening::HEAD_OF_DEPARTMENT) {
            return false;
        }

        $department = $this->classSubject?->subject?->department;

        return $department !== null && $department !== '' && ClassSubject::where('staff_id', $user->id)
            ->whereHas('subject', fn ($query) => $query->where('department', $department))
            ->exists();
    }

    /**
     * Hand the scheme in. With no approval set for the term it is
     * approved straight away.
     */
    public function submit(User $by, ?SchemeOpening $opening): void
    {
        $approved = $opening?->approval === SchemeOpening::NONE;

        $this->update([
            'status' => $approved ? SchemeStatus::Approved : SchemeStatus::Submitted,
            'submitted_at' => now(),
            'approved_at' => $approved ? now() : null,
            'approved_by' => null,
        ]);
        $this->record('submitted', $by);
    }

    public function approve(User $by, ?string $note = null): void
    {
        $this->update(['status' => SchemeStatus::Approved, 'approved_at' => now(), 'approved_by' => $by->id]);
        $this->record('approved', $by, $note);
    }

    public function sendBack(User $by, string $note): void
    {
        $this->update(['status' => SchemeStatus::ChangesRequested, 'approved_at' => null, 'approved_by' => null]);
        $this->record('changes_requested', $by, $note);
    }

    /**
     * After a teacher changes the plan. A change to an approved scheme
     * needs approval again, unless the term lets teachers change freely.
     */
    public function touchPlan(User $by, ?SchemeOpening $opening): void
    {
        if ($this->status === SchemeStatus::NotStarted) {
            $this->update(['status' => SchemeStatus::Draft]);
        } elseif ($this->status === SchemeStatus::Approved && ! $opening?->free_changes) {
            $this->update(['status' => SchemeStatus::Draft, 'approved_at' => null, 'approved_by' => null]);
            $this->record('reopened', $by);
        } elseif ($this->status === SchemeStatus::Submitted) {
            $this->update(['status' => SchemeStatus::Draft]);
        }
    }

    public function record(string $action, ?User $by = null, ?string $note = null): SchemeEvent
    {
        return $this->events()->create(['action' => $action, 'user_id' => $by?->id, 'note' => $note]);
    }

    /**
     * What the reviewer is told before deciding: syllabus topics in the
     * plan and missing, periods planned against the timetable, anything
     * new in a test or exam week, and what the teacher added.
     *
     * @return array{syllabus: int, placed: int, missing: array<int, string>, periods: int, available: int, weekly: int, in_free_weeks: array<int, string>, added: int}
     */
    public function checks(): array
    {
        $term = $this->term;
        $classSubject = $this->classSubject;
        $syllabus = $term && $classSubject
            ? SyllabusTopic::where('level_id', $classSubject->schoolClass?->level_id)
                ->where('subject_id', $classSubject->subject_id)
                ->where('term_sequence', $term->sequence)
                ->orderBy('position')
                ->get()
            : collect();
        $placedTopics = $this->items->whereNotNull('week')->pluck('syllabus_topic_id')->filter()->unique();
        $weeks = $term ? collect(static::weeks($term, $classSubject?->schoolClass?->level_id)) : collect();
        $freeWeeks = $weeks->whereNotNull('free')->pluck('week')->all();
        $weekly = (int) ($classSubject->weekly_periods ?? 0);

        return [
            'syllabus' => $syllabus->count(),
            'placed' => $syllabus->filter(fn (SyllabusTopic $topic) => $placedTopics->contains($topic->id))->count(),
            'missing' => $syllabus->reject(fn (SyllabusTopic $topic) => $placedTopics->contains($topic->id))->map(fn (SyllabusTopic $topic) => $topic->name)->values()->all(),
            'periods' => (int) $this->items->whereNotNull('week')->sum('periods'),
            'available' => $weekly * ($weeks->count() - count($freeWeeks)),
            'weekly' => $weekly,
            'in_free_weeks' => $this->items->filter(fn (SchemeItem $item) => in_array($item->week, $freeWeeks, true))->map(fn (SchemeItem $item) => $item->label())->values()->all(),
            'added' => $this->items->where('added_by_teacher', true)->count(),
        ];
    }

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * @return BelongsTo<ClassSubject, $this>
     */
    public function classSubject(): BelongsTo
    {
        return $this->belongsTo(ClassSubject::class);
    }

    /**
     * @return HasMany<SchemeItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SchemeItem::class)->orderByRaw('week IS NULL')->orderBy('week')->orderBy('position');
    }

    /**
     * @return HasMany<SchemeEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(SchemeEvent::class)->orderBy('created_at');
    }

    /**
     * Names of the untaught sub-topics, for "moves to Term 2".
     *
     * @return Collection<int, string>
     */
    public function untaughtLabels(): Collection
    {
        return $this->items->whereNull('taught_on')->map(fn (SchemeItem $item) => $item->label())->values();
    }
}
