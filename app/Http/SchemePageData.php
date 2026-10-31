<?php

namespace App\Http;

use App\Http\Controllers\Concerns\ListsTables;
use App\Models\Level;
use App\Models\Scheme;
use App\Models\SchemeItem;
use App\Models\SchemeOpening;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class SchemePageData
{
    use ListsTables;

    public const array STATES = ['to_approve' => 'To approve', 'behind' => 'Behind', 'sent_back' => 'Sent back', 'not_submitted' => 'Not submitted', 'waiting' => 'No teacher yet', 'on_track' => 'On track', 'closed' => 'Closed'];

    /**
     * The term's schemes this person may follow, where each stands, and
     * the ones the filters, search and sort from the page address keep,
     * with the filters as the page shows them and in words.
     *
     * @return array{0: Collection<int, Scheme>, 1: Collection<string, string>, 2: Collection<int, Scheme>, 3: array<string, mixed>, 4: list<string>}
     */
    public function list(Request $request, Term $term, SchemeOpening $opening, ?int $week): array
    {
        $schemes = $this->schemesOf($term)->filter(fn (Scheme $scheme) => $request->user()->can('view', [$scheme, $opening]))->values();
        $states = $schemes->mapWithKeys(fn (Scheme $scheme) => [$scheme->id => $scheme->followState($week)]);
        $search = trim((string) $request->query('q', ''));
        $needle = mb_strtolower($search);
        $wanted = $this->many($request, 'state', array_keys(static::STATES));
        $levels = $this->many($request, 'level');
        $departments = $this->many($request, 'department');
        [$sort, $direction] = $this->sorting($request, ['attention', 'subject', 'class', 'teacher'], 'attention');
        $order = array_keys(static::STATES);

        $listed = $schemes
            ->filter(fn (Scheme $scheme) => ($wanted === [] || in_array($states[$scheme->id], $wanted, true))
                && ($levels === [] || in_array($scheme->classSubject?->schoolClass?->level_id, $levels, true))
                && ($departments === [] || in_array($scheme->classSubject?->subject?->department, $departments, true))
                && ($needle === '' || str_contains(mb_strtolower($this->title($scheme).' '.$scheme->classSubject?->staff?->full_name), $needle)))
            ->sortBy(fn (Scheme $scheme) => match ($sort) {
                'subject' => [$scheme->classSubject?->subject?->name, $scheme->classSubject?->schoolClass?->name],
                'class' => [$scheme->classSubject?->schoolClass?->name, $scheme->classSubject?->subject?->name],
                'teacher' => [$scheme->classSubject->staff->full_name ?? "\u{FFFF}", $this->title($scheme)],
                default => [array_search($states[$scheme->id], $order, true), $this->title($scheme)],
            }, descending: $direction === 'desc')
            ->values();

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $wanted !== [] ? $this->say('Status: :value', ['value' => implode(', ', array_map(fn (string $state) => $this->say(static::STATES[$state]), $wanted))]) : null,
            $levels !== [] ? $this->say('Level: :value', ['value' => Level::whereIn('id', $levels)->orderBy('ordinal')->pluck('name')->join(', ')]) : null,
            $departments !== [] ? $this->say('Department: :value', ['value' => implode(', ', $departments)]) : null,
        ]));

        return [$schemes, $states, $listed, [
            'q' => $search,
            'state' => $wanted,
            'level' => $levels,
            'department' => $departments,
            'sort' => ($direction === 'desc' ? '-' : '').$sort,
        ], $applied];
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
