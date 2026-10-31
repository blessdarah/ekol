<?php

namespace App\Http\Controllers;

use App\Actions\Students\ImportStudents;
use App\Http\Requests\Students\UploadStudentImportRequest;
use App\Http\SchoolContext;
use App\Http\StudentImportDocument;
use App\Models\Student;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

    public function __construct(SchoolContext $schoolContext, private StudentImportDocument $document)
    {
        parent::__construct($schoolContext);
    }

    public function show(Request $request): Response
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $state = $this->state($request);
        $props = [
            'yearLabel' => $year?->label,
            'hasYear' => $year !== null,
            'fields' => collect(StudentImportDocument::FIELDS)->map(fn (string $label, string $key) => [
                'key' => $key,
                'label' => $label,
                'required' => ! in_array($key, StudentImportDocument::OPTIONAL, true),
            ])->values(),
        ];

        if (! $state) {
            return Inertia::render('students/import', [...$props, 'step' => 'upload']);
        }

        [$headers, $rows] = $this->document->read($state['path']);
        $file = ['name' => $state['name'], 'rows' => count($rows), 'headers' => $headers];

        if (! $state['mapping']) {
            return Inertia::render('students/import', [
                ...$props,
                'step' => 'match',
                'file' => $file,
                'sample' => array_slice($rows, 0, 3),
                'guess' => $this->document->guess($headers),
            ]);
        }

        $report = $this->document->analyse($school, $year, $rows, $state['mapping']);
        $problems = array_values(array_filter($report, fn (array $row) => $row['status'] !== 'ready'));

        return Inertia::render('students/import', [
            ...$props,
            'step' => 'check',
            'file' => $file,
            'mapping' => collect($state['mapping'])
                ->map(fn (int $column, string $field) => ['field' => StudentImportDocument::FIELDS[$field], 'column' => $headers[$column] ?? '—'])
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
        $school = $this->schoolContext->school();

        $this->forget($request);

        $upload = $request->file('file');
        $path = $upload->storeAs("imports/{$school->id}", Str::uuid7().'.csv', 'local');
        [$headers, $rows] = $this->document->read((string) $path);

        if ($headers === [] || $rows === []) {
            Storage::disk('local')->delete((string) $path);

            throw ValidationException::withMessages([
                'file' => __('That file has no rows under its header line.'),
            ]);
        }

        if (count($rows) > StudentImportDocument::MAX_ROWS) {
            Storage::disk('local')->delete((string) $path);

            throw ValidationException::withMessages([
                'file' => __('That file has more than :max rows. Split it and import in parts.', ['max' => number_format(StudentImportDocument::MAX_ROWS)]),
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
        $this->schoolContext->school();
        $state = $this->state($request);

        abort_unless($state !== null, 404);

        [$headers] = $this->document->read($state['path']);
        $columns = array_keys($headers);
        $rules = [];

        foreach (array_keys(StudentImportDocument::FIELDS) as $field) {
            $rules["mapping.{$field}"] = [
                in_array($field, StudentImportDocument::OPTIONAL, true) ? 'nullable' : 'required',
                'integer',
                Rule::in($columns),
            ];
        }

        $request->validate($rules, [
            'mapping.*.required' => __('Choose the column that holds this.'),
        ]);

        $mapping = [];

        foreach (array_keys(StudentImportDocument::FIELDS) as $field) {
            $column = $request->input("mapping.{$field}");

            if ($column !== null && $column !== '') {
                $mapping[$field] = (int) $column;
            }
        }

        if (count($mapping) !== count(array_unique($mapping))) {
            throw ValidationException::withMessages([
                'mapping' => __('Two fields point at the same column. Each needs its own.'),
            ]);
        }

        $request->session()->put(static::SESSION_KEY, [...$state, 'mapping' => $mapping]);

        $this->notify('Columns matched.');

        return redirect()->route('students.import');
    }

    public function clearMapping(Request $request): RedirectResponse
    {
        $this->schoolContext->school();

        if ($state = $this->state($request)) {
            $request->session()->put(static::SESSION_KEY, [...$state, 'mapping' => null]);
        }

        return redirect()->route('students.import');
    }

    public function run(Request $request, ImportStudents $importStudents): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $year = $this->schoolContext->year();
        $state = $this->state($request);

        abort_unless($state !== null && $state['mapping'] !== null && $year !== null, 404);

        [, $rows] = $this->document->read($state['path']);
        $ready = array_filter(
            $this->document->analyse($school, $year, $rows, $state['mapping']),
            fn (array $row) => $row['status'] === 'ready',
        );
        $term = $this->schoolContext->term();
        $imported = $importStudents->handle($school, $year, $term, $request->user(), array_values(array_map(fn (array $row) => [
            'name' => $row['name'],
            'class_id' => (string) $row['class_id'],
            'date_of_birth' => (string) $row['date_of_birth'],
            'gender' => (string) $row['gender'],
            'guardian_name' => $row['guardian_name'],
            'guardian_phone' => $row['guardian_phone'],
            'place_of_birth' => $row['place_of_birth'],
        ], $ready)), $state['name']);

        $this->forget($request);

        $this->notify(trans_choice('{1} :count student imported.|[2,*] :count students imported.', $imported, ['count' => $imported]));

        return redirect()->route('students');
    }

    public function problems(Request $request): StreamedResponse
    {
        $school = $this->schoolContext->school();
        $state = $this->state($request);

        abort_unless($state !== null && $state['mapping'] !== null, 404);

        [$headers, $rows] = $this->document->read($state['path']);
        $report = $this->document->analyse($school, $this->schoolContext->year(), $rows, $state['mapping']);

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
        $this->schoolContext->school();

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
        $this->schoolContext->school();
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
}
