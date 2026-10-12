import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { index } from '@/actions/App/Http/Controllers/StudentController';
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
                        <span className={`h-px w-12 shrink-0 ${position <= step ? 'bg-primary' : 'bg-border'}`} />
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
                                    <path d="M2.6 6.2 4.9 8.5 9.4 3.9" fill="none" stroke="#0E4D3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                position + 1
                            )}
                        </span>
                        <span className={`text-[13px] leading-4 ${position <= step ? 'font-semibold text-text' : 'text-text-muted'}`}>
                            {label}
                        </span>
                    </span>
                </li>
            ))}
            <li className="ml-auto text-[13px] leading-4 text-text-muted">
                Step {step + 1} of {STEPS.length}
            </li>
        </ol>
    );
}

function FileBar({ file, note }: { file: FileInfo; note: string }) {
    return (
        <div className="flex items-center gap-3 rounded-md bg-surface px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" fill="none" stroke="#101915" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[13px] leading-[18px] text-text">
                    {file.name}
                </span>
                <span className="text-[12px] leading-4 text-text-muted">
                    {money(file.rows)} rows · {note}
                </span>
            </div>
            <button
                type="button"
                onClick={() => router.delete(destroy.url())}
                className="text-[13px] leading-4 font-medium text-primary hover:underline"
            >
                Replace file
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
            <form onSubmit={submit} className="flex min-w-0 flex-1 flex-col gap-4">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center hover:border-primary">
                    <span className="text-[14px] leading-[18px] font-semibold text-text">
                        {form.data.file ? form.data.file.name : 'Choose a CSV file'}
                    </span>
                    <span className="text-[13px] leading-[19px] text-text-muted">
                        One row per student, with a header line. Up to 5,000
                        rows and 2 MB.
                    </span>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                    />
                </label>
                <ErrorText message={form.errors.file} />
                {!hasYear && (
                    <p className="text-[13px] leading-[19px] text-warning">
                        Students are placed in classes of an academic year.
                        Make a year active in School Setup before importing.
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <a
                        href={template.url()}
                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        Download a template to fill in
                    </a>
                    <div className="flex gap-2">
                        <Link href={index.url()} className={outlineButtonClass}>
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={!form.data.file || form.processing || !hasYear}
                            className={solidButtonClass}
                        >
                            Upload and match columns
                        </button>
                    </div>
                </div>
            </form>
            <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        What each row needs
                    </p>
                    <ul className="flex flex-col gap-2 text-[13px] leading-[18px] text-text-muted">
                        <li>Full name, surname first</li>
                        <li>Date of birth, as 2010-03-14 or 14/03/2010</li>
                        <li>Gender: boy or girl</li>
                        <li>Class, spelled as on the Levels page</li>
                        <li>A guardian’s name and phone number</li>
                    </ul>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                    <p className="text-[13px] leading-4 font-semibold text-text">
                        Using Excel or Google Sheets?
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        Save or download the sheet as CSV first. Excel files
                        cannot be read directly yet.
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
            fields.map((field) => [field.key, guess[field.key]?.toString() ?? '']),
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
                        chosen[field.key] === '' ? null : Number(chosen[field.key]),
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
            <FileBar file={file} note={`${file.headers.length} columns found`} />
            <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                <div className="flex h-8 shrink-0 items-center gap-4 bg-surface px-4 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                    <span className="w-[200px] shrink-0">We need</span>
                    <span className="w-[260px] shrink-0">Column in your file</span>
                    <span className="flex-1">First rows</span>
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
                                    {field.label}
                                </span>
                                {!field.required && (
                                    <span className="text-[12px] leading-4 text-text-muted">optional</span>
                                )}
                            </span>
                            <span className="flex w-[260px] shrink-0 flex-col gap-1">
                                <select
                                    aria-label={`Column for ${field.label}`}
                                    value={column}
                                    onChange={(e) => setChosen({ ...chosen, [field.key]: e.target.value })}
                                    className={`${fieldInputClass} h-9 text-[14px] ${
                                        field.required && column === '' ? 'border-warning bg-warning-tint' : ''
                                    }`}
                                >
                                    <option value="">
                                        {field.required ? 'Choose a column' : 'Not in this file'}
                                    </option>
                                    {file.headers.map((header, position) => (
                                        <option key={`${header}-${position}`} value={position}>
                                            {header || `Column ${position + 1}`}
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
                    {matched} of {fields.length} matched. Nothing is imported
                    until you have seen the check.
                </p>
                <div className="flex gap-2">
                    <Link href={index.url()} className={outlineButtonClass}>
                        Cancel
                    </Link>
                    <button type="submit" disabled={saving} className={solidButtonClass}>
                        Check the rows
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
        ['Need fixing', report.fix, 'text-danger'],
        ['Possible duplicates', report.duplicates, 'text-[#8A5A12]'],
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
                            <dd className={`font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] ${tone}`}>
                                {money(value)}
                            </dd>
                        </div>
                    ))}
                </dl>
                {report.problems.length === 0 ? (
                    <p className="rounded-md bg-success-tint p-4 text-[13px] leading-[19px] text-text">
                        Every row is ready. Nothing needs fixing.
                    </p>
                ) : (
                    <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                        <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                            <span className="w-11 shrink-0">Row</span>
                            <span className="w-[170px] shrink-0">Student</span>
                            <span className="flex-1">Problem</span>
                        </div>
                        {shown.map((problem, position) => (
                            <div
                                key={problem.row}
                                className={`flex min-h-[42px] items-center gap-3 border-t border-solid border-border px-3 py-2 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
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
                                {shown.length} of {report.problems.length} shown
                            </span>
                            {report.problems.length > 6 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAll(!showAll)}
                                    className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                >
                                    {showAll ? 'Show fewer' : `Show all ${report.problems.length}`}
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {report.problems.length > 0 && (
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        Rows with problems are skipped. Download them, fix
                        them in the spreadsheet and import that file
                        afterwards.
                    </p>
                )}
            </div>

            <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                    <p className={capsLabelClass}>When you import</p>
                    <p className="font-display text-[16px] leading-[22px] font-bold text-text">
                        {money(report.ready)} students are created now.
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        Matricules run from {nextMatricule}. A guardian and
                        the fee plan are created with each student. Rows with
                        problems are skipped.
                    </p>
                    <button
                        type="button"
                        disabled={report.ready === 0 || importing || !hasYear}
                        onClick={() => {
                            setImporting(true);
                            router.post(run.url(), {}, { onFinish: () => setImporting(false) });
                        }}
                        className={`${solidButtonClass} w-full`}
                    >
                        Import {money(report.ready)} students
                    </button>
                    {report.problems.length > 0 && (
                        <a href={problems.url()} className={`${outlineButtonClass} w-full`}>
                            Download the {report.problems.length} problem rows
                        </a>
                    )}
                </div>
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        Columns matched
                    </p>
                    <dl className="flex flex-col gap-2">
                        {mapping.map((pair) => (
                            <div key={pair.field} className="flex items-baseline justify-between gap-3">
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
                        Change matching
                    </button>
                </div>
            </aside>
        </div>
    );
}

function ImportStudents(props: ImportProps) {
    const stepIndex = { upload: 0, match: 1, check: 2 }[props.step];

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-6">
            <Head title="Import students" />
            <StudentHeader
                trail={[{ label: 'Import' }]}
                title="Import students"
                tag={`Enrolment${props.yearLabel ? ` · ${props.yearLabel}` : ''}`}
                meta="bring in a whole intake from a spreadsheet"
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
