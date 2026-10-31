<?php

namespace App\Http\Controllers;

use App\Actions\SaveSubject;
use App\Http\Requests\Subjects\SaveSubjectRequest;
use App\Http\SchoolContext;
use App\Http\SubjectPageData;
use App\Models\ClassSubject;
use App\Models\School;
use App\Models\Subject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SubjectRegistrationController extends Controller
{
    private const array DEPARTMENTS = ['Sciences', 'Languages', 'Arts', 'Technical', 'Commercial', 'General'];

    public function __construct(SchoolContext $schoolContext, protected SubjectPageData $page)
    {
        parent::__construct($schoolContext);
    }

    public function create(Request $request): Response
    {
        $school = $this->schoolContext->school();

        return $this->form($school, null);
    }

    public function edit(Request $request, string $subject): Response
    {
        $school = $this->schoolContext->school();

        return $this->form($school, $this->subject($school, $subject));
    }

    public function store(SaveSubjectRequest $request, SaveSubject $saveSubject): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $data = $this->validated($request);

        $subject = $saveSubject->handle($school, $request->user(), new Subject(['school_id' => $school->id]), $data);

        $this->notify('Subject saved.');

        return redirect()->route('classes.subjects.show', $subject->id);
    }

    public function update(SaveSubjectRequest $request, string $subject, SaveSubject $saveSubject): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $target = $this->subject($school, $subject);
        $data = $this->validated($request);

        $saveSubject->handle($school, $request->user(), $target, $data);

        $this->notify('Subject saved.');

        return redirect()->route('classes.subjects.show', $target->id);
    }

    protected function subject(School $school, string $id): Subject
    {
        return Subject::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    protected function form(School $school, ?Subject $subject): Response
    {
        $year = $this->schoolContext->year();
        $subject?->load('classSubjects');

        return Inertia::render('subjects/register', [
            'yearLabel' => $year?->label,
            'departments' => collect(self::DEPARTMENTS)
                ->merge(Subject::where('school_id', $school->id)->distinct()->pluck('department'))
                ->unique()
                ->values(),
            'subject' => $subject ? [
                'id' => $subject->id,
                'name' => $subject->name,
                'code' => $subject->code,
                'coefficient' => (float) $subject->coefficient,
                'department' => $subject->department,
                'note' => $subject->note,
                'classes' => $subject->classSubjects->map(fn (ClassSubject $row) => [
                    'class_id' => $row->school_class_id,
                    'staff_id' => $row->staff_id,
                    'weekly_periods' => $row->weekly_periods,
                ]),
            ] : null,
            ...$this->page->pickers($school, $year),
        ]);
    }

    /**
     * @return array{name: string, code: string, department: string, coefficient: string, note: string|null, classes: list<array{class_id: string, staff_id: string|null, weekly_periods: int}>}
     */
    protected function validated(SaveSubjectRequest $request): array
    {
        $data = $request->subjectData();

        if ($request->string('mode')->toString() === 'register') {
            $staffed = collect($data['classes'])->every(fn (array $row) => ! empty($row['staff_id']));

            if ($data['classes'] === [] || ! $staffed) {
                throw ValidationException::withMessages([
                    'classes' => __('Every selected class needs a teacher before you can register. Save a draft to finish later.'),
                ]);
            }
        }

        return $data;
    }
}
