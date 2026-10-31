<?php

namespace App\Http;

use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\FeeInstallmentTemplate;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\Level;
use App\Models\Money;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Series;
use App\Models\Student;
use App\Models\StudentGuardian;
use App\Models\StudentSeries;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class StudentRegistrationForm
{
    public function __construct(private SchoolContext $schoolContext) {}

    public function render(Request $request, School $school, ?Student $student): Response
    {
        $year = $this->schoolContext->year();
        $term = $this->schoolContext->term();
        $private = (bool) $request->user()?->can('see-private-student-details');
        $classes = self::classes($school, $year);
        $counts = Enrolment::whereIn('school_class_id', $classes->modelKeys())
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id');
        $student?->load('guardians');

        $enrolment = $student && $year
            ? Enrolment::where('student_id', $student->id)->where('academic_year_id', $year->id)->first()
            : null;
        $seriesId = $student && $term
            ? StudentSeries::where('student_id', $student->id)->where('term_id', $term->id)->value('series_id')
            : null;

        return Inertia::render('students/register', [
            'yearLabel' => $year?->label,
            'currency' => $school->currency,
            'matricule' => $student->admission_no ?? Student::nextMatricule($school, today()),
            'canSeePrivate' => $private,
            'religions' => Student::RELIGIONS,
            'disabilityTypes' => Student::DISABILITY_TYPES,
            'livesWithOptions' => Student::LIVES_WITH,
            'levels' => Level::where('school_id', $school->id)
                ->orderBy('ordinal')
                ->get()
                ->map(fn (Level $level) => $level->only(['id', 'name', 'uses_series'])),
            'classes' => $classes->map(fn (SchoolClass $class) => [
                'id' => $class->id,
                'name' => $class->name,
                'level_id' => $class->level_id,
                'capacity' => $class->capacity,
                'students' => (int) ($counts[$class->id] ?? 0),
            ]),
            'series' => Series::where('school_id', $school->id)
                ->orderBy('stream', 'desc')
                ->orderBy('code')
                ->get()
                ->map(fn (Series $series) => [
                    'id' => $series->id,
                    'code' => $series->code,
                    'name' => $series->name,
                    'stream' => $series->stream ?? 'science',
                    'level_id' => $series->level_id,
                ]),
            'feePlans' => $this->feePlans($school, $year),
            'student' => $student ? [
                'id' => $student->id,
                'surname' => $student->surname ?? Str::before($student->full_name, ' '),
                'given_names' => $student->given_names ?? Str::after($student->full_name, ' '),
                'date_of_birth' => $student->date_of_birth->toDateString(),
                'gender' => $student->gender->value,
                'place_of_birth' => $student->place_of_birth,
                'religion' => $private ? $student->religion : null,
                'has_disability' => $private && $student->has_disability,
                'disability_types' => $private ? ($student->disability_types ?? []) : [],
                'disability_support' => $private ? $student->disability_support : null,
                'transferred' => $student->transferred,
                'previous_school' => $student->previous_school,
                'previous_class' => $student->previous_class,
                'previous_year_left' => $student->previous_year_left,
                'transfer_certificate_received' => $student->transfer_certificate_received,
                'last_report_received' => $student->last_report_received,
                'on_whatsapp' => $student->on_whatsapp,
                'lives_with' => $student->lives_with,
                'class_id' => $enrolment?->school_class_id,
                'series_id' => $seriesId,
                'guardians' => $student->guardians->map(fn (StudentGuardian $guardian) => $guardian->only(['relation', 'name', 'phone', 'occupation', 'is_main'])),
            ] : null,
        ]);
    }

    /**
     * @return Collection<int, SchoolClass>
     */
    public static function classes(School $school, ?AcademicYear $year): Collection
    {
        return $year
            ? SchoolClass::where('school_id', $school->id)
                ->where('academic_year_id', $year->id)
                ->orderBy('name')
                ->get()
            : new Collection;
    }

    /**
     * What a new student of each level is billed, item by item, split
     * by the year's installment schedule.
     *
     * @return array<int, array{level_id: string, amount: float, items: list<array{name: string, amount: float}>, installments: array<int, array{seq: int, due_on: string|null, amount: float}>}>
     */
    protected function feePlans(School $school, ?AcademicYear $year): array
    {
        if (! $year) {
            return [];
        }

        $templates = FeeInstallmentTemplate::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->orderBy('seq')
            ->get();

        $percents = array_values($templates->map(fn (FeeInstallmentTemplate $template) => (string) $template->percent)->all());

        return FeePlan::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->get()
            ->map(function (FeePlan $plan) use ($templates, $percents) {
                $lines = $plan->lines(true);
                $parts = Invoice::schedule($lines, $percents);

                return [
                    'level_id' => $plan->level_id,
                    'amount' => Money::number(Money::sum(array_column($lines, 'amount'))),
                    'items' => array_map(fn (array $line) => ['name' => $line['name'], 'amount' => Money::number(Money::units((string) $line['amount']))], $lines),
                    'installments' => $templates->values()->map(fn (FeeInstallmentTemplate $template, int $index) => [
                        'seq' => $template->seq,
                        'due_on' => $template->due_on?->toDateString(),
                        'amount' => Money::number($parts[$index] ?? 0),
                    ])->all(),
                ];
            })
            ->all();
    }
}
