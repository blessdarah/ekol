<?php

namespace App\Http;

use App\Enums\SchemeStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Concerns\ListsTables;
use App\Models\ClassSubject;
use App\Models\Level;
use App\Models\Scheme;
use App\Models\SchemeItem;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SchemePageData
{
    use ListsTables;

    public const array STATES = [
        'to_approve' => 'To approve',
        'behind' => 'Behind',
        'sent_back' => 'Sent back',
        'not_submitted' => 'Not submitted',
        'waiting' => 'No teacher yet',
        'on_track' => 'On track',
        'closed' => 'Closed',
    ];

    /**
     * Scalar scheme summaries, with progress computed in the database.
     * Item records are only loaded separately when a person opens a scheme.
     */
    public function query(Term $term, ?int $week): Builder
    {
        $items = SchemeItem::query()
            ->whereIn('scheme_id', Scheme::where('school_id', $term->school_id)->where('term_id', $term->id)->select('id'))
            ->select('scheme_id')
            ->selectRaw('COUNT(*) as topics')
            ->selectRaw('SUM(CASE WHEN taught_on IS NOT NULL THEN 1 ELSE 0 END) as taught_total')
            ->selectRaw('SUM(CASE WHEN week <= ? THEN 1 ELSE 0 END) as planned', [$week])
            ->selectRaw('SUM(CASE WHEN week <= ? AND taught_on IS NOT NULL THEN 1 ELSE 0 END) as taught', [$week])
            ->selectRaw('SUM(CASE WHEN week < ? AND taught_on IS NULL THEN 1 ELSE 0 END) as late', [$week])
            ->groupBy('scheme_id');
        $rows = Scheme::where('schemes.school_id', $term->school_id)
            ->where('schemes.term_id', $term->id)
            ->leftJoin('class_subjects', fn (JoinClause $join) => $join
                ->on('class_subjects.id', '=', 'schemes.class_subject_id')
                ->where('class_subjects.school_id', $term->school_id))
            ->leftJoin('subjects', fn (JoinClause $join) => $join
                ->on('subjects.id', '=', 'class_subjects.subject_id')
                ->where('subjects.school_id', $term->school_id)->whereNull('subjects.deleted_at'))
            ->leftJoin('school_classes', fn (JoinClause $join) => $join
                ->on('school_classes.id', '=', 'class_subjects.school_class_id')
                ->where('school_classes.school_id', $term->school_id)->whereNull('school_classes.deleted_at'))
            ->leftJoin('levels', fn (JoinClause $join) => $join
                ->on('levels.id', '=', 'school_classes.level_id')->where('levels.school_id', $term->school_id)->whereNull('levels.deleted_at'))
            ->leftJoin('users', fn (JoinClause $join) => $join
                ->on('users.id', '=', 'class_subjects.staff_id')
                ->where('users.school_id', $term->school_id)->whereNull('users.deleted_at'))
            ->leftJoinSub($items, 'item_counts', 'item_counts.scheme_id', '=', 'schemes.id')
            ->select([
                'schemes.id',
                'schemes.status',
                'subjects.name as subject',
                'subjects.department',
                'school_classes.name as class',
                'school_classes.level_id',
                'levels.name as level_name',
                'levels.ordinal as level_ordinal',
                'users.full_name as teacher',
                'users.initials as teacher_initials',
                'class_subjects.staff_id',
                'class_subjects.subject_id',
            ])
            ->selectRaw('COALESCE(item_counts.topics, 0) as topics, COALESCE(item_counts.taught_total, 0) as taught_total, COALESCE(item_counts.planned, 0) as planned, COALESCE(item_counts.taught, 0) as taught, COALESCE(item_counts.late, 0) as late')
            ->selectRaw("CASE WHEN schemes.status = ? THEN 'closed' WHEN class_subjects.staff_id IS NULL THEN 'waiting' WHEN schemes.status = ? THEN 'to_approve' WHEN schemes.status = ? THEN 'sent_back' WHEN schemes.status NOT IN (?, ?, ?) THEN 'not_submitted' WHEN COALESCE(item_counts.late, 0) > 0 THEN 'behind' ELSE 'on_track' END as state", [
                SchemeStatus::Closed->value,
                SchemeStatus::Submitted->value,
                SchemeStatus::ChangesRequested->value,
                SchemeStatus::Submitted->value,
                SchemeStatus::Approved->value,
                SchemeStatus::Closed->value,
            ]);

        return DB::query()->fromSub($rows, 'scheme_rows');
    }

    /**
     * The authorized base, filtered SQL list, and the filters in page and export form.
     *
     * @return array{0: Builder, 1: Builder, 2: array<string, mixed>, 3: list<string>}
     */
    public function list(Request $request, Term $term, SchemeOpening $opening, ?int $week): array
    {
        $schemes = $this->visible($request->user(), $term, $opening, $week);
        $listed = clone $schemes;
        $search = trim((string) $request->query('q', ''));
        $wanted = $this->many($request, 'state', array_keys(static::STATES));
        $levels = $this->many($request, 'level');
        $departments = $this->many($request, 'department');
        [$sort, $direction] = $this->sorting($request, ['attention', 'subject', 'class', 'teacher'], 'attention');

        $listed->when($wanted !== [], fn (Builder $query) => $query->whereIn('state', $wanted))
            ->when($levels !== [], fn (Builder $query) => $query->whereIn('level_id', $levels))
            ->when($departments !== [], fn (Builder $query) => $query->whereIn('department', $departments));
        if ($search !== '') {
            $listed->whereRaw("LOWER(COALESCE(subject, '') || ' · ' || COALESCE(class, '') || ' ' || COALESCE(teacher, '')) LIKE ? ESCAPE '\\'", ['%'.addcslashes(mb_strtolower($search), '\\%_').'%']);
        }

        $title = "COALESCE(subject, '') || ' · ' || COALESCE(class, '')";
        match ($sort) {
            'subject' => $listed->orderByRaw("COALESCE(subject, '') {$direction}")->orderByRaw("COALESCE(class, '') {$direction}"),
            'class' => $listed->orderByRaw("COALESCE(class, '') {$direction}")->orderByRaw("COALESCE(subject, '') {$direction}"),
            'teacher' => $listed->orderByRaw("CASE WHEN teacher IS NULL THEN 1 ELSE 0 END {$direction}")->orderBy('teacher', $direction)->orderByRaw("{$title} {$direction}"),
            default => $listed->orderByRaw("CASE state WHEN 'to_approve' THEN 0 WHEN 'behind' THEN 1 WHEN 'sent_back' THEN 2 WHEN 'not_submitted' THEN 3 WHEN 'waiting' THEN 4 WHEN 'on_track' THEN 5 ELSE 6 END {$direction}")->orderByRaw("{$title} {$direction}"),
        };
        $listed->orderBy('id');

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $wanted !== [] ? $this->say('Status: :value', ['value' => implode(', ', array_map(fn (string $state) => $this->say(static::STATES[$state]), $wanted))]) : null,
            $levels !== [] ? $this->say('Level: :value', ['value' => Level::where('school_id', $term->school_id)->whereIn('id', $levels)->orderBy('ordinal')->pluck('name')->join(', ')]) : null,
            $departments !== [] ? $this->say('Department: :value', ['value' => implode(', ', $departments)]) : null,
        ]));

        return [$schemes, $listed, [
            'q' => $search,
            'state' => $wanted,
            'level' => $levels,
            'department' => $departments,
            'sort' => ($direction === 'desc' ? '-' : '').$sort,
        ], $applied];
    }

    protected function visible(User $user, Term $term, SchemeOpening $opening, ?int $week): Builder
    {
        $query = $this->query($term, $week);

        if ($user->can('manage-schemes') || in_array($user->role, [UserRole::Principal, UserRole::AcademicLead, UserRole::Admin], true)) {
            return $query;
        }

        if ($user->role !== UserRole::HeadOfDepartment || $opening->approval !== SchemeOpening::HEAD_OF_DEPARTMENT) {
            return $query->whereRaw('1 = 0');
        }

        $departments = ClassSubject::where('class_subjects.school_id', $term->school_id)
            ->where('staff_id', $user->id)
            ->join('subjects', fn (JoinClause $join) => $join
                ->on('subjects.id', '=', 'class_subjects.subject_id')
                ->where('subjects.school_id', $term->school_id)->whereNull('subjects.deleted_at'))
            ->whereNotNull('subjects.department')->where('subjects.department', '!=', '')
            ->select('subjects.department');

        return $query->whereIn('department', $departments);
    }

    /**
     * @return Collection<int, Scheme>
     */
    public function schemesOf(Term $term): Collection
    {
        return Scheme::where('term_id', $term->id)
            ->with(['items', 'classSubject.subject:id,name,department', 'classSubject.schoolClass:id,name,level_id', 'classSubject.schoolClass.level:id,name,ordinal', 'classSubject.staff:id,full_name'])
            ->get()
            ->sortBy(fn (Scheme $scheme) => $this->title($scheme))
            ->values();
    }

    public function find(School $school, string $id): Scheme
    {
        return Scheme::where('school_id', $school->id)
            ->whereKey($id)
            ->with(['items', 'term', 'events.user:id,full_name', 'classSubject.subject:id,name,department', 'classSubject.schoolClass:id,name,level_id', 'classSubject.staff:id,full_name'])
            ->firstOrFail();
    }

    public function title(Scheme $scheme): string
    {
        return $scheme->classSubject?->subject?->name.' · '.$scheme->classSubject?->schoolClass?->name;
    }

    /**
     * @return array{id: string, subject: string|null, class: string|null, teacher: string|null, status: string, topics: int}
     */
    public function summary(Scheme $scheme): array
    {
        return [
            'id' => $scheme->id,
            'subject' => $scheme->classSubject?->subject?->name,
            'class' => $scheme->classSubject?->schoolClass?->name,
            'teacher' => $scheme->classSubject?->staff?->full_name,
            'status' => $scheme->status->value,
            'topics' => $scheme->items->count(),
        ];
    }

    /**
     * Sub-topics planned for a week already gone and not taught yet.
     *
     * @return Collection<int, SchemeItem>
     */
    public function lateItems(Scheme $scheme, ?int $week): Collection
    {
        return $week === null
            ? new Collection
            : $scheme->items->filter(fn (SchemeItem $item) => $item->week !== null && $item->week < $week && $item->taught_on === null)->values();
    }

    /**
     * The drawer of the progress page: the plan week by week, each
     * sub-topic taught, not yet, this week or planned.
     *
     * @return array<string, mixed>
     */
    public function panel(Scheme $scheme, ?int $week, string $state): array
    {
        $approver = $scheme->approved_by ? User::whereKey($scheme->approved_by)->value('full_name') : null;
        $late = $this->lateItems($scheme, $week);

        return [
            ...$this->summary($scheme),
            'state' => $state,
            'approved_on' => $scheme->approved_at?->toDateString(),
            'approved_by' => $approver,
            'late' => $late->count(),
            'late_weeks' => $late->pluck('week')->unique()->sort()->values(),
            'items' => $scheme->items->whereNotNull('week')->map(fn (SchemeItem $item) => [
                'id' => $item->id,
                'week' => $item->week,
                'label' => $item->label(),
                'taught_on' => $item->taught_on?->toDateString(),
                'state' => match (true) {
                    $item->taught_on !== null => 'taught',
                    $week !== null && $item->week < $week => 'late',
                    $week !== null && $item->week === $week => 'this_week',
                    default => 'planned',
                },
            ])->values(),
        ];
    }
}
