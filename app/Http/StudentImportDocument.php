<?php

namespace App\Http;

use App\Models\AcademicYear;
use App\Models\Enrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StudentImportDocument
{
    public const int MAX_ROWS = 5000;

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

    public const array OPTIONAL = ['place_of_birth'];

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

    /**
     * Header line and data rows of a stored CSV; comma or semicolon.
     *
     * @return array{0: list<string>, 1: list<list<string>>}
     */
    public function read(string $path): array
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
    public function guess(array $headers): array
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
    public function analyse(School $school, ?AcademicYear $year, array $rows, array $mapping): array
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
