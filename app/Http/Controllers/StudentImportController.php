<?php

namespace App\Http\Controllers;

use App\Http\Requests\Students\UploadStudentImportRequest;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StudentImportController extends Controller
{
    protected const string SESSION_KEY = 'student_import';

    protected const int MAX_ROWS = 5000;

    /**
     * What a spreadsheet column can be matched to; place of birth is optional.
     */
    public const array FIELDS = [
        'full_name' => 'Full name',
        'date_of_birth' => 'Date of birth',
        'gender' => 'Gender',
        'class' => 'Class',
        'guardian_name' => 'Guardian name',
        'guardian_phone' => 'Guardian phone',
        'place_of_birth' => 'Place of birth',
    ];

    protected const array OPTIONAL = ['place_of_birth'];

    /**
     * Header words that suggest a field, tried in order.
     */
    protected const array HINTS = [
        'guardian_phone' => ['phone', 'tel', 'contact'],
        'guardian_name' => ['guardian', 'parent', 'father', 'mother'],
        'date_of_birth' => ['birth date', 'date of birth', 'dob', 'born'],
        'place_of_birth' => ['place'],
        'gender' => ['gender', 'sex'],
        'class' => ['class', 'form'],
        'full_name' => ['name', 'student'],
    ];

    public function show(Request $request): Response
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $state = $this->state($request);
        $props = [
            'yearLabel' => $year?->label,
            'hasYear' => $year !== null,
            'fields' => collect(static::FIELDS)->map(fn (string $label, string $key) => [
                'key' => $key,
                'label' => $label,
                'required' => ! in_array($key, static::OPTIONAL, true),
            ])->values(),
        ];

        if (! $state) {
            return Inertia::render('students/import', [...$props, 'step' => 'upload']);
        }

        [$headers, $rows] = $this->read($state['path']);
        $file = ['name' => $state['name'], 'rows' => count($rows), 'headers' => $headers];

        if (! $state['mapping']) {
            return Inertia::render('students/import', [
                ...$props,
                'step' => 'match',
                'file' => $file,
                'sample' => array_slice($rows, 0, 3),
                'guess' => $this->guess($headers),
            ]);
        }

        $report = $this->analyse($school, $year, $rows, $state['mapping']);
        $problems = array_values(array_filter($report, fn (array $row) => $row['status'] !== 'ready'));

        return Inertia::render('students/import', [
            ...$props,
            'step' => 'check',
            'file' => $file,
            'mapping' => collect($state['mapping'])
                ->map(fn (int $column, string $field) => ['field' => static::FIELDS[$field], 'column' => $headers[$column] ?? '—'])
                ->values(),
            'nextMatricule' => Student::nextMatricule($school, today()),
            'report' => [
                'rows' => count($report),
                'ready' => count($report) - count($problems),
                'fix' => count(array_filter($problems, fn (array $row) => $row['status'] === 'fix')),
                'duplicates' => count(array_filter($problems, fn (array $row) => $row['status'] === 'duplicate')),
                'problems' => array_map(fn (array $row) => [
                    'row' => $row['row'],
                    'name' => $row['name'],
                    'status' => $row['status'],
                    'problem' => $row['problem'],
                ], $problems),
            ],
        ]);
    }

    public function upload(UploadStudentImportRequest $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);

        $this->forget($request);

        $upload = $request->file('file');
        $path = $upload->storeAs("imports/{$school->id}", Str::uuid7().'.csv', 'local');
        [$headers, $rows] = $this->read((string) $path);

        if ($headers === [] || $rows === []) {
            Storage::disk('local')->delete((string) $path);

            throw ValidationException::withMessages([
                'file' => 'That file has no rows under its header line.',
            ]);
        }

        if (count($rows) > static::MAX_ROWS) {
            Storage::disk('local')->delete((string) $path);

            throw ValidationException::withMessages([
                'file' => 'That file has more than '.number_format(static::MAX_ROWS).' rows. Split it and import in parts.',
            ]);
        }

        $request->session()->put(static::SESSION_KEY, [
            'path' => $path,
            'name' => $upload->getClientOriginalName(),
            'mapping' => null,
        ]);

        $this->notify('File uploaded. Match its columns next.');

        return redirect()->route('students.import');
    }

    public function mapping(Request $request): RedirectResponse
    {
        StudentController::schoolFor($request);
        $state = $this->state($request);

        abort_unless($state !== null, 404);

        [$headers] = $this->read($state['path']);
        $columns = array_keys($headers);
        $rules = [];

        foreach (array_keys(static::FIELDS) as $field) {
            $rules["mapping.{$field}"] = [
                in_array($field, static::OPTIONAL, true) ? 'nullable' : 'required',
                'integer',
                Rule::in($columns),
            ];
        }

        $request->validate($rules, [
            'mapping.*.required' => 'Choose the column that holds this.',
        ]);

        $mapping = [];

        foreach (array_keys(static::FIELDS) as $field) {
            $column = $request->input("mapping.{$field}");

            if ($column !== null && $column !== '') {
                $mapping[$field] = (int) $column;
            }
        }

        if (count($mapping) !== count(array_unique($mapping))) {
            throw ValidationException::withMessages([
                'mapping' => 'Two fields point at the same column. Each needs its own.',
            ]);
        }

        $request->session()->put(static::SESSION_KEY, [...$state, 'mapping' => $mapping]);

        $this->notify('Columns matched.');

        return redirect()->route('students.import');
    }

    public function clearMapping(Request $request): RedirectResponse
    {
        StudentController::schoolFor($request);

        if ($state = $this->state($request)) {
            $request->session()->put(static::SESSION_KEY, [...$state, 'mapping' => null]);
        }

        return redirect()->route('students.import');
    }

    public function run(Request $request): RedirectResponse
    {
        $school = StudentController::schoolFor($request);
        $year = StructureController::currentYear($school);
        $state = $this->state($request);

        abort_unless($state !== null && $state['mapping'] !== null && $year !== null, 404);

        [, $rows] = $this->read($state['path']);
        $ready = array_filter(
            $this->analyse($school, $year, $rows, $state['mapping']),
            fn (array $row) => $row['status'] === 'ready',
        );
        $term = StudentController::currentTerm($school);
        $classes = SchoolClass::where('academic_year_id', $year->id)->get()->keyBy('id');

        DB::transaction(function () use ($request, $school, $year, $term, $classes, $ready, $state) {
            foreach ($ready as $row) {
                $class = $classes->get($row['class_id']);

                if (! $class) {
                    continue;
                }

                [$surname, $given] = array_pad(explode(' ', $row['name'], 2), 2, '');

                Student::admit($school, $year, $term, $class, [
                    'surname' => $surname,
                    'given_names' => $given !== '' ? $given : $surname,
                    'full_name' => $row['name'],
                    'date_of_birth' => $row['date_of_birth'],
                    'gender' => $row['gender'],
                    'place_of_birth' => $row['place_of_birth'],
                ], [[
                    'relation' => 'guardian',
                    'name' => $row['guardian_name'],
                    'phone' => $row['guardian_phone'],
                    'occupation' => null,
                    'is_main' => true,
                ]]);
            }

            AuditEvent::create([
                'school_id' => $school->id,
                'actor_id' => $request->user()?->id,
                'entity' => 'student_import',
                'entity_id' => $school->id,
                'action' => 'imported',
                'diff' => ['file' => $state['name'], 'students' => count($ready)],
            ]);
        });

        $this->forget($request);

        $this->notify(count($ready).' students imported.');

        return redirect()->route('students');
    }

    public function problems(Request $request): StreamedResponse
    {
        $school = StudentController::schoolFor($request);
        $state = $this->state($request);

        abort_unless($state !== null && $state['mapping'] !== null, 404);

        [$headers, $rows] = $this->read($state['path']);
        $report = $this->analyse($school, StructureController::currentYear($school), $rows, $state['mapping']);

        return response()->streamDownload(function () use ($headers, $rows, $report) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                return;
            }

            fputcsv($out, [...$headers, 'Problem'], escape: '\\');

            foreach ($report as $index => $row) {
                if ($row['status'] !== 'ready') {
                    fputcsv($out, [...$rows[$index], $row['problem']], escape: '\\');
                }
            }

            fclose($out);
        }, 'problem-rows.csv', ['Content-Type' => 'text/csv']);
    }

    public function template(Request $request): StreamedResponse
    {
        StudentController::schoolFor($request);

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                return;
            }

            fputcsv($out, ['Full name', 'Date of birth', 'Gender', 'Class', 'Guardian name', 'Guardian phone', 'Place of birth'], escape: '\\');
            fputcsv($out, ['Tabi Nkwain Grace', '2010-03-14', 'Girl', 'Form 1 A', 'Tabi Nkwain', '+237 670 14 52 08', 'Bamenda'], escape: '\\');
            fclose($out);
        }, 'students-template.csv', ['Content-Type' => 'text/csv']);
    }

    public function destroy(Request $request): RedirectResponse
    {
        StudentController::schoolFor($request);
        $this->forget($request);

        $this->notify('Import cleared.');

        return redirect()->route('students.import');
    }

    /**
     * The upload in progress, if its file is still there.
     *
     * @return array{path: string, name: string, mapping: array<string, int>|null}|null
     */
    protected function state(Request $request): ?array
    {
        $state = $request->session()->get(static::SESSION_KEY);

        if (! is_array($state) || ! Storage::disk('local')->exists((string) ($state['path'] ?? ''))) {
            return null;
        }

        return [
            'path' => (string) $state['path'],
            'name' => (string) $state['name'],
            'mapping' => is_array($state['mapping'] ?? null) ? $state['mapping'] : null,
        ];
    }

    protected function forget(Request $request): void
    {
        $state = $request->session()->pull(static::SESSION_KEY);

        if (is_array($state) && isset($state['path'])) {
            Storage::disk('local')->delete((string) $state['path']);
        }
    }

    /**
     * Header line and data rows of a stored CSV; comma or semicolon.
     *
     * @return array{0: list<string>, 1: list<list<string>>}
     */
    protected function read(string $path): array
    {
        $handle = Storage::disk('local')->readStream($path);

        if (! is_resource($handle)) {
            return [[], []];
        }

        $first = (string) fgets($handle);
        $delimiter = substr_count($first, ';') > substr_count($first, ',') ? ';' : ',';
        rewind($handle);

        $lines = [];

        while (($line = fgetcsv($handle, null, $delimiter, '"', '\\')) !== false) {
            $cells = array_map(fn (?string $cell) => trim((string) $cell), $line);

            if (implode('', $cells) !== '') {
                $lines[] = $cells;
            }
        }

        fclose($handle);

        if ($lines === []) {
            return [[], []];
        }

        $headers = array_shift($lines);
        $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]) ?? $headers[0];
        $width = count($headers);

        return [
            $headers,
            array_map(fn (array $cells) => array_slice(array_pad($cells, $width, ''), 0, $width), $lines),
        ];
    }

    /**
     * @param  list<string>  $headers
     * @return array<string, int|null>
     */
    protected function guess(array $headers): array
    {
        $guess = array_fill_keys(array_keys(static::FIELDS), null);
        $taken = [];

        foreach (static::HINTS as $field => $words) {
            foreach ($headers as $index => $header) {
                if (! in_array($index, $taken, true) && Str::contains(Str::lower($header), $words)) {
                    $guess[$field] = $index;
                    $taken[] = $index;

                    break;
                }
            }
        }

        return $guess;
    }

    /**
     * Read every row through the mapping and say whether it can be
     * imported, needs fixing, or looks like a student already here.
     *
     * @param  list<list<string>>  $rows
     * @param  array<string, int>  $mapping
     * @return list<array{row: int, name: string, status: string, problem: string|null, class_id: string|null, date_of_birth: string|null, gender: string|null, guardian_name: string, guardian_phone: string, place_of_birth: string|null}>
     */
    protected function analyse(School $school, ?AcademicYear $year, array $rows, array $mapping): array
    {
        $classes = $year
            ? SchoolClass::where('school_id', $school->id)->where('academic_year_id', $year->id)->get()
            : collect();
        $byName = $classes->keyBy(fn (SchoolClass $class) => Str::lower($class->name));
        $seats = Enrolment::whereIn('school_class_id', $classes->pluck('id'))
            ->selectRaw('school_class_id, COUNT(*) as total')
            ->groupBy('school_class_id')
            ->pluck('total', 'school_class_id')
            ->all();
        $existing = Student::where('school_id', $school->id)
            ->get(['full_name', 'date_of_birth', 'admission_no'])
            ->keyBy(fn (Student $student) => Str::lower($student->full_name).'|'.$student->date_of_birth->toDateString());
        $seen = [];
        $report = [];

        foreach ($rows as $index => $cells) {
            $cell = fn (string $field) => isset($mapping[$field]) ? trim($cells[$mapping[$field]] ?? '') : '';
            $name = preg_replace('/\s+/', ' ', $cell('full_name')) ?? '';
            $born = $this->date($cell('date_of_birth'));
            $gender = $this->gender($cell('gender'));
            $class = $byName->get(Str::lower($cell('class')));
            $phone = $cell('guardian_phone');
            $digits = strlen(preg_replace('/\D+/', '', $phone) ?? '');
            $key = Str::lower($name).'|'.$born;
            $status = 'fix';

            $problem = match (true) {
                $name === '' => 'Name is missing',
                $cell('date_of_birth') === '' => 'Date of birth is missing',
                $born === null => 'Date of birth "'.$cell('date_of_birth').'" is not a date',
                $gender === null => 'Gender "'.$cell('gender').'" is not boy or girl',
                $class === null => 'Class "'.$cell('class').'" does not exist',
                $cell('guardian_name') === '' => 'Guardian name is missing',
                $digits < 9 => "Guardian phone has {$digits} digits, not 9",
                default => null,
            };

            if ($problem === null && $class) {
                $taken = (int) ($seats[$class->id] ?? 0);

                if ($existing->has($key)) {
                    $status = 'duplicate';
                    $problem = 'Same name and birth date as '.$existing->get($key)?->admission_no;
                } elseif (isset($seen[$key])) {
                    $status = 'duplicate';
                    $problem = "Same name and birth date as row {$seen[$key]}";
                } elseif ($taken >= $class->capacity) {
                    $problem = "Class \"{$class->name}\" is full, {$taken} of {$class->capacity}";
                } else {
                    $status = 'ready';
                    $seats[$class->id] = $taken + 1;
                    $seen[$key] = $index + 2;
                }
            }

            $report[] = [
                'row' => $index + 2,
                'name' => $name !== '' ? $name : '—',
                'status' => $status,
                'problem' => $problem,
                'class_id' => $class?->id,
                'date_of_birth' => $born,
                'gender' => $gender,
                'guardian_name' => $cell('guardian_name'),
                'guardian_phone' => $phone,
                'place_of_birth' => $cell('place_of_birth') !== '' ? $cell('place_of_birth') : null,
            ];
        }

        return $report;
    }

    protected function date(string $value): ?string
    {
        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'd.m.Y'] as $format) {
            try {
                $date = Carbon::createFromFormat('!'.$format, $value);
            } catch (\Throwable) {
                continue;
            }

            if ($date && $date->format($format) === $value && $date->isPast()) {
                return $date->toDateString();
            }
        }

        return null;
    }

    protected function gender(string $value): ?string
    {
        return match (Str::lower($value)) {
            'f', 'female', 'girl', 'fille', 'féminin' => 'female',
            'm', 'male', 'boy', 'garçon', 'masculin' => 'male',
            default => null,
        };
    }
}
