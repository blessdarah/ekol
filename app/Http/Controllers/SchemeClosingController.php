<?php

namespace App\Http\Controllers;

use App\Actions\CloseTermSchemes;
use App\Http\Requests\Schemes\CloseSchemesRequest;
use App\Http\SchemePageData;
use App\Http\SchoolContext;
use App\Models\Scheme;
use App\Models\SchemeOpening;
use App\Models\Term;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SchemeClosingController extends Controller
{
    public function __construct(SchoolContext $schoolContext, protected SchemePageData $page)
    {
        parent::__construct($schoolContext);
    }

    /**
     * Step 5: how much of each plan was taught, before the term closes.
     */
    public function closing(Request $request): Response|RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;

        if (! $term || ! $opening) {
            return redirect()->route('schemes');
        }

        $schemes = $this->page->schemesOf($term);
        $below = in_array($request->query('show'), ['all', 'below'], true) ? (string) $request->query('show') : 'below';
        $rows = $schemes
            ->map(fn (Scheme $scheme) => [
                ...$this->page->summary($scheme),
                'taught' => $scheme->items->whereNotNull('taught_on')->count(),
                'total' => $scheme->items->count(),
                'coverage' => $scheme->coverage(),
                'carries' => $scheme->untaughtLabels()->all(),
            ])
            ->sortBy('coverage')
            ->values();
        $items = $schemes->flatMap->items;
        $nextTerm = Term::where('academic_year_id', $term->academic_year_id)->where('sequence', $term->sequence + 1)->first();
        $lastWeek = collect(Scheme::weeks($term))->last();

        return Inertia::render('schemes/close', [
            'steps' => Scheme::steps($school, $this->schoolContext->term()),
            'closed' => $opening->closed_at !== null,
            'canClose' => $lastWeek !== null && today()->gte($lastWeek['starts_on']),
            'lastWeekStarts' => $lastWeek['starts_on'] ?? null,
            'nextTerm' => $nextTerm?->label,
            'totals' => [
                'taught_percent' => $items->isEmpty() ? 0 : (int) floor($items->whereNotNull('taught_on')->count() / $items->count() * 100),
                'fully' => $rows->where('coverage', 100)->count(),
                'schemes' => $rows->count(),
                'below' => $rows->filter(fn (array $row) => $row['coverage'] < Scheme::COVERED_PERCENT)->count(),
                'carry' => $items->whereNull('taught_on')->count(),
            ],
            'filters' => ['show' => $below],
            'rows' => $below === 'below' ? $rows->filter(fn (array $row) => $row['coverage'] < Scheme::COVERED_PERCENT)->values() : $rows,
        ]);
    }

    /**
     * Lock the term's schemes. What was not taught starts the next
     * term's schemes, opened now when asked.
     */
    public function close(CloseSchemesRequest $request, CloseTermSchemes $closeSchemes): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        $opening = $term ? SchemeOpening::where('term_id', $term->id)->first() : null;
        $lastWeek = $term ? collect(Scheme::weeks($term))->last() : null;

        if (! $term || ! $opening || $opening->closed_at !== null) {
            return redirect()->route('schemes');
        }

        $opened = $closeSchemes->handle($school, $term, $request->user(), $request->boolean('open_next'));

        $this->notify($opened > 0
            ? trans_choice('{1} :term schemes closed. :count scheme opened for the next term.|[2,*] :term schemes closed. :count schemes opened for the next term.', $opened, ['term' => __($term->label)])
            : __(':term schemes closed.', ['term' => __($term->label)]));

        return redirect()->route('schemes.close');
    }

    /**
     * Coverage by subject and class, for the inspectorate and the staff
     * meeting, as a spreadsheet.
     */
    public function report(Request $request): StreamedResponse
    {
        $school = $this->schoolContext->school();
        $term = $this->schoolContext->term();
        abort_unless($term !== null, 404);
        $schemes = $this->page->schemesOf($term);

        return response()->streamDownload(function () use ($schemes) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                return;
            }

            fputcsv($out, [__('Subject'), __('Class'), __('Teacher'), __('Taught'), __('Sub-topics'), __('Coverage %'), __('Not taught')], escape: '');

            foreach ($schemes as $scheme) {
                fputcsv($out, [
                    $scheme->classSubject?->subject?->name,
                    $scheme->classSubject?->schoolClass?->name,
                    $scheme->classSubject?->staff?->full_name,
                    $scheme->items->whereNotNull('taught_on')->count(),
                    $scheme->items->count(),
                    $scheme->coverage(),
                    $scheme->untaughtLabels()->join('; '),
                ], escape: '');
            }

            fclose($out);
        }, 'coverage-'.str($term->label)->slug().'.csv', ['Content-Type' => 'text/csv']);
    }
}
