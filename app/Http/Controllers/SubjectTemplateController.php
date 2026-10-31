<?php

namespace App\Http\Controllers;

use App\Actions\SaveSubject;
use App\Http\Requests\Subjects\StoreSubjectTemplatesRequest;
use App\Http\SchoolContext;
use App\Http\SubjectPageData;
use App\Models\Level;
use App\Models\School;
use App\Models\Subject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SubjectTemplateController extends Controller
{
    public function __construct(SchoolContext $schoolContext, protected SubjectPageData $page)
    {
        parent::__construct($schoolContext);
    }

    public function templates(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $levels = Level::where('school_id', $school->id)->orderBy('ordinal')->get();
        $registered = Subject::where('school_id', $school->id)->pluck('code')->all();

        $sets = collect($this->templateSets())->map(function (array $set, string $key) use ($levels, $registered) {
            $cycle = $levels->filter(fn (Level $level) => $level->cycle->value === $set['cycle'])->values();

            return [
                'key' => $key,
                'name' => $set['name'],
                'description' => $set['description'],
                'subjects' => collect($set['subjects'])->map(function (array $subject) use ($cycle, $registered) {
                    [$name, $code, $department, $coefficient, $periods, $from] = $subject;
                    $covered = $cycle->slice($from)->values();

                    return [
                        'name' => $name,
                        'code' => $code,
                        'department' => $department,
                        'coefficient' => $coefficient,
                        'weekly_periods' => $periods,
                        'level_ids' => $covered->modelKeys(),
                        'levels_label' => $this->page->levelRange($covered),
                        'registered' => in_array($code, $registered, true),
                    ];
                })->values(),
            ];
        })->values();

        return Inertia::render('subjects/templates', [
            'yearLabel' => $year?->label,
            'sets' => $sets,
            ...$this->page->pickers($school, $year),
        ]);
    }

    public function storeTemplates(StoreSubjectTemplatesRequest $request, SaveSubject $saveSubject): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $set = $this->templateSets()[$request->string('set')->toString()] ?? null;

        abort_unless($set !== null, 404);

        $data = $request->validated();

        $catalogue = collect($set['subjects'])->keyBy(fn (array $subject) => $subject[1]);
        $registered = Subject::withTrashed()->where('school_id', $school->id)->pluck('code')->all();

        $created = DB::transaction(function () use ($request, $school, $data, $catalogue, $registered, $saveSubject) {
            $created = 0;

            foreach ($data['subjects'] as $row) {
                $template = $catalogue->get($row['code']);

                // Subjects the school already has are left alone.
                if (! $template || in_array($row['code'], $registered, true)) {
                    continue;
                }

                [$name, $code, $department, $coefficient, $periods] = $template;

                $subject = $saveSubject->handle($school, $request->user(), new Subject(['school_id' => $school->id]), [
                    'name' => $name,
                    'code' => $code,
                    'department' => $department,
                    'coefficient' => $coefficient,
                    'note' => null,
                    'classes' => $row['classes'],
                ], $periods, true);

                $created++;
            }

            return $created;
        });

        $this->notify(trans_choice('{1} :count subject created.|[2,*] :count subjects created.', $created, ['count' => $created]));

        return redirect()->route('classes.subjects');
    }

    /**
     * @return array<string, array{name: string, description: string, cycle: string, subjects: list<array{0: string, 1: string, 2: string, 3: int, 4: int, 5: int}>}>
     */
    protected function templateSets(): array
    {
        return config('subject_templates');
    }
}
