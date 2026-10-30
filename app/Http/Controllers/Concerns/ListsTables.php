<?php

namespace App\Http\Controllers\Concerns;

use App\Models\AuditEvent;
use App\Models\School;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The parts every list shares: rows per page, sorting, filters that
 * take several values, and exporting what the list shows.
 */
trait ListsTables
{
    /**
     * @var list<int>
     */
    protected static array $perPageOptions = [25, 50, 100];

    protected function perPage(Request $request): int
    {
        $asked = (int) $request->query('per_page', static::$perPageOptions[0]);

        return in_array($asked, static::$perPageOptions, true) ? $asked : static::$perPageOptions[0];
    }

    /**
     * A filter that may hold several values, sent as "a,b,c".
     *
     * @param  list<string>|null  $allowed
     * @return list<string>
     */
    protected function many(Request $request, string $key, ?array $allowed = null): array
    {
        $values = array_values(array_filter(
            array_map('trim', explode(',', (string) $request->query($key, ''))),
            fn (string $value) => $value !== '' && ($allowed === null || in_array($value, $allowed, true)),
        ));

        return array_values(array_unique($values));
    }

    /**
     * The sort asked for, as "class" or "-balance" for descending.
     *
     * @param  list<string>  $allowed
     * @return array{0: string, 1: 'asc'|'desc'}
     */
    protected function sorting(Request $request, array $allowed, string $default): array
    {
        $asked = (string) $request->query('sort', $default);
        $key = ltrim($asked, '-');

        if (! in_array($key, $allowed, true)) {
            $asked = $default;
            $key = ltrim($default, '-');
        }

        return [$key, str_starts_with($asked, '-') ? 'desc' : 'asc'];
    }

    /**
     * A date from the page address, when it is one (YYYY-MM-DD).
     */
    protected function day(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    /**
     * A translated line for a list's filters in words. A key that names
     * a translation group would come back as an array; it is used as is.
     *
     * @param  array<string, mixed>  $replace
     */
    protected function say(string $key, array $replace = []): string
    {
        $text = __($key, $replace);

        return is_string($text) ? $text : $key;
    }

    /**
     * The selected rows to export, when the person picked some.
     *
     * @return list<string>
     */
    protected function exportIds(Request $request): array
    {
        return $this->many($request, 'ids');
    }

    /**
     * Send what the list shows as a CSV file, or as a page to print.
     * The file opens with the school, what was filtered and when; every
     * export is written to the audit log, since lists hold personal data.
     *
     * @param  list<string>  $applied  the filters in words, e.g. "Level: Form 4"
     * @param  array<string, string>  $columns  key => heading
     * @param  iterable<array<string, mixed>>  $rows
     */
    protected function sendExport(Request $request, School $school, string $title, array $applied, array $columns, iterable $rows, int $count): StreamedResponse|Response
    {
        $wanted = $this->many($request, 'columns', array_keys($columns));
        $columns = $wanted === [] ? $columns : array_intersect_key($columns, array_flip($wanted));
        $format = $request->query('format') === 'print' ? 'print' : 'csv';
        $made = now()->timezone($school->timezone ?: config('app.timezone'));
        $by = $request->user()?->full_name;

        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'export',
            'entity_id' => $school->id,
            'action' => 'exported',
            'diff' => ['list' => $title, 'format' => $format, 'rows' => $count, 'filters' => $applied, 'columns' => array_keys($columns)],
        ]);

        if ($format === 'print') {
            return Inertia::render('tables/print', [
                'school' => $school->name,
                'title' => $title,
                'applied' => $applied,
                'made' => $made->toIso8601String(),
                'by' => $by,
                'columns' => collect($columns)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values(),
                'rows' => collect($rows)->map(fn (array $row) => array_intersect_key($row, $columns))->values(),
            ]);
        }

        $filename = Str::slug($school->code.' '.$title).'-'.$made->format('Y-m-d').'.csv';

        $intro = [$applied === [] ? $this->say('No filters') : implode(' · ', $applied), $this->say('Made :date by :by', ['date' => $made->format('d M Y H:i'), 'by' => $by ?? '—'])];

        return response()->streamDownload(function () use ($intro, $school, $title, $columns, $rows) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                return;
            }

            // Excel reads the file as UTF-8 only with the byte-order mark.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [$school->name.' · '.$title], escape: '');
            fputcsv($out, [$intro[0]], escape: '');
            fputcsv($out, [$intro[1]], escape: '');
            fputcsv($out, [], escape: '');
            fputcsv($out, array_values($columns), escape: '');

            foreach ($rows as $row) {
                fputcsv($out, array_map(fn (string $key) => $row[$key] ?? '', array_keys($columns)), escape: '');
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
