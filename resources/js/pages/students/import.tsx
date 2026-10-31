import { tableRowClass } from '../../components/table/ui';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { index } from '@/actions/App/Http/Controllers/StudentRosterController';
import {
    clearMapping,
    destroy,
    mapping as saveMapping,
    problems,
    run,
    template,
    upload,
} from '@/actions/App/Http/Controllers/StudentImportController';
import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { StudentHeader, money } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Field {
    key: string;
    label: string;
    required: boolean;
}

interface FileInfo {
    name: string;
    rows: number;
    headers: string[];
}

interface Problem {
    row: number;
    name: string;
    status: 'fix' | 'duplicate';
    problem: string;
}

interface ImportProps {
    yearLabel: string | null;
    hasYear: boolean;
    fields: Field[];
    step: 'upload' | 'match' | 'check';
    file?: FileInfo;
    sample?: string[][];
    guess?: Record<string, number | null>;
    mapping?: { field: string; column: string }[];
    nextMatricule?: string;
    report?: {
        rows: number;
        ready: number;
        fix: number;
        duplicates: number;
        problems: Problem[];
    };
}

const STEPS = ['Upload', 'Match columns', 'Check and import'];

function Progress({ step }: { step: number }) {
    return (
        <ol className="flex flex-wrap items-center gap-3">
            {STEPS.map((label, position) => (
                <li key={label} className="flex items-center gap-3">
                    {position > 0 && (
                        <span
                            className={`h-px w-12 shrink-0 ${position <= step ? 'bg-primary' : 'bg-border'}`}
                        />
                    )}
                    <span className="flex items-center gap-2">
                        <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] leading-4 font-semibold ${
                                position === step
                                    ? 'bg-primary text-white'
                                    : position < step
                                      ? 'bg-primary-tint'
                                      : 'border border-solid border-border bg-surface text-text-muted'
                            }`}
                        >
                            {position < step ? (
                                <svg width="12" height="12" viewBox="0 0 12 12">
                                    <path
                                        d="M2.6 6.2 4.9 8.5 9.4 3.9"
                                        fill="none"
                                        stroke="var(--color-primary)"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            ) : (
                                position + 1
                            )}
                        </span>
                        <span
                            className={`text-[13px] leading-4 ${position <= step ? 'font-semibold text-text' : 'text-text-muted'}`}
                        >
                            {label}
                        </span>
                    </span>
                </li>
            ))}
            <li className="ml-auto text-[13px] leading-4 text-text-muted">
                {t('Step :step of :steps', {
                    step: step + 1,
                    steps: STEPS.length,
                })}
            </li>
        </ol>
    );
}

function FileBar({ file, note }: { file: FileInfo; note: string }) {
    return (
        <div className="flex items-center gap-3 rounded-md bg-surface px-4 py-3">
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                className="shrink-0"
            >
                <path
                    d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"
                    fill="none"
                    stroke="var(--color-text)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                />
            </svg>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[13px] leading-[18px] text-text">
                    {file.name}
                </span>
                <span className="text-[12px] leading-4 text-text-muted">
                    {t(':rows rows · :note', { rows: money(file.rows), note })}
                </span>
            </div>
            <button
                type="button"
                onClick={() => router.delete(destroy.url())}
                className="text-[13px] leading-4 font-medium text-primary hover:underline"
            >
                {t('Replace file')}
            </button>
        </div>
    );
}

function UploadStep({ hasYear }: { hasYear: boolean }) {
    const form = useForm({ file: null as File | null });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(upload.url());
    }

    return (
        <div className="flex flex-col gap-8 lg:flex-row">
            <form
                onSubmit={submit}
                className="flex min-w-0 flex-1 flex-col gap-4"
            >
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center hover:border-primary">
                    <span className="text-[14px] leading-[18px] font-semibold text-text">
                        {form.data.file
                            ? form.data.file.name
                            : t('Choose a CSV file')}
                    </span>
                    <span className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'One row per student, with a header line. Up to 5,000 rows and 2 MB.',
                        )}
                    </span>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={(e) =>
                            form.setData('file', e.target.files?.[0] ?? null)
                        }
                    />
                </label>
                <ErrorText message={form.errors.file} />
                {!hasYear && (
                    <p className="text-[13px] leading-[19px] text-warning">
                        {t(
                            'Students are placed in classes of an academic year. Make a year active in School Setup before importing.',
                        )}
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <a
                        href={template.url()}
                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {t('Download a template to fill in')}
                    </a>
                    <div className="flex gap-2">
                        <Link href={index.url()} className={outlineButtonClass}>
                            {t('Cancel')}
                        </Link>
                        <button
                            type="submit"
                            disabled={
                                !form.data.file || form.processing || !hasYear
                            }
                            className={solidButtonClass}
                        >
                            {t('Upload and match columns')}
                        </button>
                    </div>
                </div>
            </form>
            <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {t('What each row needs')}
                    </p>
                    <ul className="flex flex-col gap-2 text-[13px] leading-[18px] text-text-muted">
                        <li>{t('Full name, surname first')}</li>
                        <li>
                            {t('Date of birth, as 2010-03-14 or 14/03/2010')}
                        </li>
                        <li>{t('Gender: boy or girl')}</li>
                        <li>{t('Class, spelled as on the Levels page')}</li>
                        <li>{t('A guardian’s name and phone number')}</li>
                    </ul>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                    <p className="text-[13px] leading-4 font-semibold text-text">
                        {t('Using Excel or Google Sheets?')}
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Save or download the sheet as CSV first. Excel files cannot be read directly yet.',
                        )}
                    </p>
                </div>
            </aside>
        </div>
    );
}

function MatchStep({
    fields,
    file,
    sample,
    guess,
}: {
    fields: Field[];
    file: FileInfo;
    sample: string[][];
    guess: Record<string, number | null>;
}) {
    const [chosen, setChosen] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            fields.map((field) => [
                field.key,
                guess[field.key]?.toString() ?? '',
            ]),
        ),
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const matched = fields.filter((field) => chosen[field.key] !== '').length;

    function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        router.post(
            saveMapping.url(),
            {
                mapping: Object.fromEntries(
                    fields.map((field) => [
                        field.key,
                        chosen[field.key] === ''
                            ? null
                            : Number(chosen[field.key]),
                    ]),
                ),
            },
            {
                onError: (failed) => setErrors(failed),
                onFinish: () => setSaving(false),
            },
        );
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-5">
            <FileBar
                file={file}
                note={`${file.headers.length} columns found`}
            />
            <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                <div className="flex h-8 shrink-0 items-center gap-4 bg-surface px-4 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                    <span className="w-[200px] shrink-0">{t('We need')}</span>
                    <span className="w-[260px] shrink-0">
                        {t('Column in your file')}
                    </span>
                    <span className="flex-1">{t('First rows')}</span>
                </div>
                {fields.map((field) => {
                    const column = chosen[field.key];
                    const error = errors[`mapping.${field.key}`];

                    return (
                        <div
                            key={field.key}
                            className="flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-1 border-t border-solid border-border px-4 py-2"
                        >
                            <span className="flex w-[200px] shrink-0 flex-col">
                                <span className="text-[14px] leading-[18px] font-medium text-text">
                                    {t(field.label)}
                                </span>
                                {!field.required && (
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        {t('optional')}
                                    </span>
                                )}
                            </span>
                            <span className="flex w-[260px] shrink-0 flex-col gap-1">
                                <select
                                    aria-label={t('Column for :label', {
                                        label: field.label,
                                    })}
                                    value={column}
                                    onChange={(e) =>
                                        setChosen({
                                            ...chosen,
                                            [field.key]: e.target.value,
                                        })
                                    }
                                    className={`${fieldInputClass} h-9 text-[14px] ${
                                        field.required && column === ''
                                            ? 'border-warning bg-warning-tint'
                                            : ''
                                    }`}
                                >
                                    <option value="">
                                        {field.required
                                            ? t('Choose a column')
                                            : t('Not in this file')}
                                    </option>
                                    {file.headers.map((header, position) => (
                                        <option
                                            key={`${header}-${position}`}
                                            value={position}
                                        >
                                            {header ||
                                                t('Column :position', {
                                                    position: position + 1,
                                                })}
                                        </option>
                                    ))}
                                </select>
                                <ErrorText message={error} />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] leading-4 text-text-muted">
                                {column === ''
                                    ? '—'
                                    : sample
                                          .map((row) => row[Number(column)])
                                          .filter(Boolean)
                                          .join(' · ') || '—'}
                            </span>
                        </div>
                    );
                })}
            </div>
            <ErrorText message={errors.mapping} />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] leading-4 text-text-muted">
                    {t(
                        ':matched of :fields matched. Nothing is imported until you have seen the check.',
                        { matched, fields: fields.length },
                    )}
                </p>
                <div className="flex gap-2">
                    <Link href={index.url()} className={outlineButtonClass}>
                        {t('Cancel')}
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className={solidButtonClass}
                    >
                        {t('Check the rows')}
                    </button>
                </div>
            </div>
        </form>
    );
}

function CheckStep({
    file,
    mapping,
    report,
    nextMatricule,
    hasYear,
}: {
    file: FileInfo;
    mapping: { field: string; column: string }[];
    report: NonNullable<ImportProps['report']>;
    nextMatricule: string;
    hasYear: boolean;
}) {
    const [showAll, setShowAll] = useState(false);
    const [importing, setImporting] = useState(false);
    const shown = showAll ? report.problems : report.problems.slice(0, 6);
    const stats: [string, number, string][] = [
        ['Rows', report.rows, 'text-text'],
        ['Ready', report.ready, 'text-success'],
        [t('Need fixing'), report.fix, 'text-danger'],
        [t('Possible duplicates'), report.duplicates, 'text-warning-text'],
    ];

    return (
        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
                <FileBar
                    file={file}
                    note={`${mapping.length} columns matched`}
                />
                <dl className="flex border-y border-solid border-border">
                    {stats.map(([label, value, tone], position) => (
                        <div
                            key={label}
                            className={`flex flex-1 flex-col gap-1 py-[14px] ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                        >
                            <dt className={capsLabelClass}>{label}</dt>
                            <dd
                                className={`font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] ${tone}`}
                            >
                                {money(value)}
                            </dd>
                        </div>
                    ))}
                </dl>
                {report.problems.length === 0 ? (
                    <p className="rounded-md bg-success-tint p-4 text-[13px] leading-[19px] text-text">
                        {t('Every row is ready. Nothing needs fixing.')}
                    </p>
                ) : (
                    <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                        <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                            <span className="w-11 shrink-0">{t('Row')}</span>
                            <span className="w-[170px] shrink-0">
                                {t('Student')}
                            </span>
                            <span className="flex-1">{t('Problem')}</span>
                        </div>
                        {shown.map((problem, position) => (
                            <div
                                key={problem.row}
                                className={`flex min-h-[42px] items-center gap-3 border-t border-solid border-border px-3 py-2 ${tableRowClass({ index: position })}`}
                            >
                                <span className="w-11 shrink-0 font-mono text-[13px] leading-4 text-text-muted">
                                    {problem.row}
                                </span>
                                <span className="w-[170px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text">
                                    {problem.name}
                                </span>
                                <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-[18px] text-text">
                                    <span
                                        className={`h-[6px] w-[6px] shrink-0 rounded-full ${problem.status === 'duplicate' ? 'bg-warning' : 'bg-danger'}`}
                                    />
                                    {problem.problem}
                                </span>
                            </div>
                        ))}
                        <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t(':shown of :problems shown', {
                                    shown: shown.length,
                                    problems: report.problems.length,
                                })}
                            </span>
                            {report.problems.length > 6 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAll(!showAll)}
                                    className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                >
                                    {showAll
                                        ? t('Show fewer')
                                        : t('Show all :problems', {
                                              problems: report.problems.length,
                                          })}
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {report.problems.length > 0 && (
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Rows with problems are skipped. Download them, fix them in the spreadsheet and import that file afterwards.',
                        )}
                    </p>
                )}
            </div>

            <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                    <p className={capsLabelClass}>{t('When you import')}</p>
                    <p className="font-display text-[16px] leading-[22px] font-bold text-text">
                        {t(':ready students are created now.', {
                            ready: money(report.ready),
                        })}
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Matricules run from :next_matricule. A guardian and the fee plan are created with each student. Rows with problems are skipped.',
                            { next_matricule: nextMatricule },
                        )}
                    </p>
                    <button
                        type="button"
                        disabled={report.ready === 0 || importing || !hasYear}
                        onClick={() => {
                            setImporting(true);
                            router.post(
                                run.url(),
                                {},
                                { onFinish: () => setImporting(false) },
                            );
                        }}
                        className={`${solidButtonClass} w-full`}
                    >
                        {t('Import :ready students', {
                            ready: money(report.ready),
                        })}
                    </button>
                    {report.problems.length > 0 && (
                        <a
                            href={problems.url()}
                            className={`${outlineButtonClass} w-full`}
                        >
                            {t('Download the :problems problem rows', {
                                problems: report.problems.length,
                            })}
                        </a>
                    )}
                </div>
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {t('Columns matched')}
                    </p>
                    <dl className="flex flex-col gap-2">
                        {mapping.map((pair) => (
                            <div
                                key={pair.field}
                                className="flex items-baseline justify-between gap-3"
                            >
                                <dt className="truncate text-[13px] leading-[18px] text-text-muted">
                                    {pair.column}
                                </dt>
                                <dd className="shrink-0 text-[13px] leading-[18px] text-text">
                                    {pair.field}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <button
                        type="button"
                        onClick={() => router.delete(clearMapping.url())}
                        className="self-start text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {t('Change matching')}
                    </button>
                </div>
            </aside>
        </div>
    );
}

function ImportStudents(props: ImportProps) {
    const stepIndex = { upload: 0, match: 1, check: 2 }[props.step];

    return (
        <div className="flex flex-col gap-6 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Import students')} />
            <StudentHeader
                trail={[{ label: t('Import') }]}
                title={t('Import students')}
                tag={t('Enrolment:year_label', {
                    year_label: props.yearLabel ? ` · ${props.yearLabel}` : '',
                })}
                meta={t('bring in a whole intake from a spreadsheet')}
            />
            <Progress step={stepIndex} />

            {props.step === 'upload' && <UploadStep hasYear={props.hasYear} />}
            {props.step === 'match' && props.file && (
                <MatchStep
                    fields={props.fields}
                    file={props.file}
                    sample={props.sample ?? []}
                    guess={props.guess ?? {}}
                />
            )}
            {props.step === 'check' && props.file && props.report && (
                <CheckStep
                    file={props.file}
                    mapping={props.mapping ?? []}
                    report={props.report}
                    nextMatricule={props.nextMatricule ?? ''}
                    hasYear={props.hasYear}
                />
            )}
        </div>
    );
}

export default withAppShell(ImportStudents);
