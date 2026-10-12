import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { progress } from '@/actions/App/Http/Controllers/AssessmentController';
import { store as askCorrection } from '@/actions/App/Http/Controllers/CorrectionController';
import { index as sheetsIndex, show, update } from '@/actions/App/Http/Controllers/MarkSheetController';
import { type PlanSummary, amberText, day, primaryClass, quietClass, score } from '../../components/assessments/ui';
import Breadcrumbs from '../../components/shell/breadcrumbs';
import { ErrorText, LockIcon, capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface Row {
    student_id: string;
    name: string;
    mark_id: string | null;
    score: number | null;
    absent: boolean;
    remark: string | null;
    previous: number | null;
    correction: number | null;
}

interface SheetProps {
    canManage: boolean;
    passMark: number;
    sheet: { id: string; subject: string | null; class: string | null; max: number; submitted_on: string | null; teacher: string | null };
    plan: PlanSummary;
    open: boolean;
    siblings: { id: string; name: string | null; state: string | null; opens_on: string | null }[];
    previous: string | null;
    rows: Row[];
}

interface Entry {
    score: string;
    absent: boolean;
    remark: string;
}

function Correction({ row, max, onClose }: { row: Row; max: number; onClose: () => void }) {
    const form = useForm({ mark_id: row.mark_id ?? '', new_score: '', reason: '' });
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((data) => ({ ...data, new_score: Number(data.new_score) }));
                form.post(askCorrection.url(), { preserveScroll: true, onSuccess: onClose });
            }}
            className="flex flex-wrap items-start gap-3 border-b border-solid border-border bg-surface px-4 py-3"
        >
            <label className="flex flex-col gap-[6px] text-[12px] leading-4 font-medium text-text">
                Corrected mark / {max}
                <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={form.data.new_score}
                    onChange={(e) => form.setData('new_score', e.target.value.replace(/[^\d.]/g, ''))}
                    className="h-9 w-[110px] rounded-md border border-solid border-border bg-white px-3 text-right font-mono text-[14px] font-normal text-text outline-none focus:border-primary"
                />
            </label>
            <label className="flex min-w-[240px] flex-1 flex-col gap-[6px] text-[12px] leading-4 font-medium text-text">
                Reason
                <input
                    type="text"
                    value={form.data.reason}
                    onChange={(e) => form.setData('reason', e.target.value)}
                    placeholder="What was wrong, and how you know"
                    className="h-9 w-full rounded-md border border-solid border-border bg-white px-3 text-[13px] font-normal text-text outline-none focus:border-primary"
                />
            </label>
            <div className="flex gap-2 pt-[22px]">
                <button type="submit" disabled={form.processing || form.data.new_score === ''} className={primaryClass}>
                    Ask the principal
                </button>
                <button type="button" onClick={onClose} className={quietClass}>
                    Cancel
                </button>
            </div>
            <div className="basis-full">
                <ErrorText message={errors.new_score ?? errors.reason ?? errors.mark_id} />
            </div>
        </form>
    );
}

function Sheet({ canManage, passMark, sheet, plan, open, siblings, previous, rows }: SheetProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [entries, setEntries] = useState<Record<string, Entry>>(() =>
        Object.fromEntries(
            rows.map((row) => [row.student_id, { score: row.score === null ? '' : String(row.score), absent: row.absent, remark: row.remark ?? '' }]),
        ),
    );
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [correcting, setCorrecting] = useState<string | null>(null);
    const inputs = useRef<Record<string, HTMLInputElement | null>>({});
    const published = plan.state === 'published';

    const valueOf = (id: string): number | null => {
        const raw = entries[id]?.score ?? '';

        return raw.trim() === '' || Number.isNaN(Number(raw)) ? null : Number(raw);
    };
    const invalid = rows.filter((row) => !entries[row.student_id].absent && (valueOf(row.student_id) ?? 0) > sheet.max).length;
    const empty = rows.filter((row) => !entries[row.student_id].absent && valueOf(row.student_id) === null).length;
    const scores = rows.map((row) => (entries[row.student_id].absent ? null : valueOf(row.student_id))).filter((value): value is number => value !== null && value <= sheet.max);
    const average = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
    const passed = scores.filter((value) => value >= passMark).length;

    function patch(id: string, change: Partial<Entry>) {
        setEntries({ ...entries, [id]: { ...entries[id], ...change } });
        setDirty(true);
    }

    function save(submit: boolean) {
        router.patch(
            update.url(sheet.id),
            {
                submit,
                marks: rows.map((row) => ({
                    student_id: row.student_id,
                    score: entries[row.student_id].absent ? null : valueOf(row.student_id),
                    absent: entries[row.student_id].absent,
                    remark: entries[row.student_id].remark.trim() || null,
                })),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setDirty(false),
            },
        );
    }

    const firstError = Object.entries(errors).find(([key]) => key.startsWith('marks'))?.[1];

    return (
        <div className="flex flex-col gap-5">
            <Head title={`${sheet.subject} · ${sheet.class}`} />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <Breadcrumbs
                        trail={[
                            canManage ? { label: 'Marks progress', href: progress.url({ query: { plan: plan.id } }) } : { label: 'Marks', href: sheetsIndex.url() },
                            { label: sheet.class ?? 'Class' },
                        ]}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">{sheet.subject}</h1>
                        <span
                            className={`flex h-6 items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${
                                open ? 'bg-success-tint text-success' : 'border border-solid border-border bg-surface text-text-muted'
                            }`}
                        >
                            {open && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />}
                            {open
                                ? `Open · closes ${day(plan.window_ends_on)}`
                                : plan.state === 'scheduled'
                                  ? `Opens ${day(plan.window_starts_on)}`
                                  : published
                                    ? `Published ${day(plan.published_on)} · locked`
                                    : 'Marks entry is closed'}
                        </span>
                    </div>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {sheet.class} · {plan.name}
                        {sheet.teacher ? ` · ${sheet.teacher}` : ''}
                        {sheet.submitted_on ? ` · submitted ${day(sheet.submitted_on)}` : ''}
                    </p>
                </div>
                {open && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[13px] leading-4 text-text-muted">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
                        <button type="button" disabled={saving || !dirty || invalid > 0} onClick={() => save(false)} className={quietClass}>
                            Save draft
                        </button>
                        <button type="button" disabled={saving || invalid > 0 || empty > 0} onClick={() => save(true)} className={primaryClass}>
                            {sheet.submitted_on ? 'Submit again' : 'Submit marks'}
                        </button>
                    </div>
                )}
            </div>

            <nav aria-label="Assessments" className="flex flex-wrap gap-x-7 border-b border-solid border-border">
                {siblings.map((option) => {
                    const active = option.id === sheet.id;
                    const locked = option.state === 'published' || option.state === 'marks_closed';

                    return (
                        <Link
                            key={option.id}
                            href={show.url(option.id)}
                            aria-current={active ? 'page' : undefined}
                            className={`-mb-px flex items-center gap-[6px] border-b-2 border-solid pb-[10px] text-[14px] leading-[18px] ${
                                active ? 'border-primary font-semibold text-text' : 'border-transparent font-medium text-text-muted hover:text-text'
                            }`}
                        >
                            {locked && <LockIcon />}
                            {option.name}
                            {option.state === 'scheduled' && <span className="font-normal">· opens {day(option.opens_on)}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
                <div className="flex h-[46px] items-center gap-3 rounded-md bg-surface px-[14px]">
                    <span className="text-[13px] leading-4 font-medium text-text">Pass mark</span>
                    <span className="font-mono text-[14px] leading-[18px] text-text">
                        {passMark} <span className="text-text-muted">/ {sheet.max}</span>
                    </span>
                </div>
                {[
                    { label: 'Entered', value: `${rows.length - empty} / ${rows.length}`, tone: 'text-text' },
                    { label: 'Class average', value: average === null ? '—' : average.toFixed(2), tone: 'text-text' },
                    { label: 'Passed', value: scores.length > 0 ? `${passed} · ${Math.round((passed / scores.length) * 100)}%` : '—', tone: 'text-success' },
                    { label: 'Below pass', value: String(scores.length - passed), tone: scores.length - passed > 0 ? 'text-danger' : 'text-text' },
                ].map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-[2px]">
                        <span className={capsLabelClass}>{stat.label}</span>
                        <span className={`font-mono text-[16px] leading-5 ${stat.tone}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {rows.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">No student is enrolled in {sheet.class} yet.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[760px] flex-col">
                        <div className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}>
                            <span className="w-7 shrink-0">#</span>
                            <span className="flex-1">Student</span>
                            <span className="w-[70px] shrink-0 text-right">{previous ? previous.replace('Sequence', 'Seq') : ''}</span>
                            <span className="w-[112px] shrink-0 text-right text-text">/ {sheet.max}</span>
                            <span className="w-[250px] shrink-0">Remark</span>
                            <span className="w-[130px] shrink-0">Result</span>
                        </div>
                        {rows.map((row, position) => {
                            const entry = entries[row.student_id];
                            const value = valueOf(row.student_id);
                            const over = !entry.absent && value !== null && value > sheet.max;
                            const below = !entry.absent && value !== null && !over && value < passMark;

                            return (
                                <div key={row.student_id} className="flex flex-col border-b border-solid border-border last:border-b-0">
                                    <div className={`flex min-h-12 items-center gap-4 px-4 py-[6px] ${position % 2 === 1 ? 'bg-row-alt' : ''}`}>
                                        <span className="w-7 shrink-0 font-mono text-[12px] leading-4 text-text-muted">{String(position + 1).padStart(2, '0')}</span>
                                        <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium text-text">{row.name}</span>
                                        <span className="w-[70px] shrink-0 text-right font-mono text-[13px] leading-4 text-text-muted">{score(row.previous)}</span>
                                        <span className="w-[112px] shrink-0">
                                            {open ? (
                                                <input
                                                    ref={(element) => {
                                                        inputs.current[row.student_id] = element;
                                                    }}
                                                    type="text"
                                                    inputMode="decimal"
                                                    aria-label={`Mark for ${row.name}`}
                                                    value={entry.absent ? '' : entry.score}
                                                    disabled={entry.absent}
                                                    placeholder={entry.absent ? 'ABS' : '—'}
                                                    onChange={(e) => patch(row.student_id, { score: e.target.value.replace(/[^\d.]/g, '') })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            inputs.current[rows[position + 1]?.student_id ?? '']?.focus();
                                                        }
                                                    }}
                                                    className={`h-8 w-full rounded-sm border border-solid px-[10px] text-right font-mono text-[14px] leading-[18px] outline-none focus:border-2 focus:border-primary disabled:bg-surface ${
                                                        over ? 'border-danger bg-danger-tint text-danger' : below ? 'border-border text-danger' : value === null ? 'border-dashed border-border text-text' : 'border-border text-text'
                                                    }`}
                                                />
                                            ) : (
                                                <span className={`block text-right font-mono text-[14px] leading-[18px] ${below ? 'text-danger' : 'text-text'}`}>
                                                    {entry.absent ? 'ABS' : score(value)}
                                                </span>
                                            )}
                                        </span>
                                        <span className="w-[250px] shrink-0">
                                            {over ? (
                                                <span className="text-[13px] leading-4 text-danger">Mark can’t be above {sheet.max}</span>
                                            ) : open ? (
                                                <input
                                                    type="text"
                                                    aria-label={`Remark for ${row.name}`}
                                                    value={entry.remark}
                                                    onChange={(e) => patch(row.student_id, { remark: e.target.value })}
                                                    placeholder="Add a remark…"
                                                    className="h-8 w-full rounded-sm bg-transparent text-[13px] leading-4 text-text outline-none placeholder:text-text-muted focus:bg-white focus:px-2 focus:outline focus:outline-1 focus:outline-primary"
                                                />
                                            ) : (
                                                <span className="text-[13px] leading-4 text-text-muted">{entry.remark}</span>
                                            )}
                                        </span>
                                        <span className="flex w-[130px] shrink-0 items-center">
                                            {published && row.mark_id ? (
                                                row.correction !== null ? (
                                                    <span className={`text-[12px] leading-4 ${amberText}`}>Correction to {score(row.correction)} waiting</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrecting(correcting === row.student_id ? null : row.student_id)}
                                                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                                    >
                                                        Ask correction
                                                    </button>
                                                )
                                            ) : entry.absent ? (
                                                open ? (
                                                    <button type="button" onClick={() => patch(row.student_id, { absent: false })} className="text-[13px] leading-4 font-medium text-primary hover:underline">
                                                        Not absent
                                                    </button>
                                                ) : (
                                                    <span className="text-[13px] leading-4 text-text-muted">Absent</span>
                                                )
                                            ) : value === null ? (
                                                open && (
                                                    <button
                                                        type="button"
                                                        onClick={() => patch(row.student_id, { absent: true, score: '' })}
                                                        className="flex h-6 items-center rounded-full border border-solid border-border bg-surface px-[10px] text-[12px] leading-4 font-medium text-text hover:bg-white"
                                                    >
                                                        Absent?
                                                    </button>
                                                )
                                            ) : over ? null : (
                                                <span
                                                    className={`flex h-6 items-center rounded-full px-[10px] text-[12px] leading-4 font-medium ${
                                                        below ? 'bg-danger-tint text-danger' : 'bg-success-tint text-success'
                                                    }`}
                                                >
                                                    {below ? 'Below' : 'Pass'}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {correcting === row.student_id && <Correction row={row} max={sheet.max} onClose={() => setCorrecting(null)} />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={`text-[13px] leading-4 ${invalid > 0 || firstError ? 'text-danger' : 'text-text-muted'}`}>
                    {firstError ??
                        (open
                            ? invalid > 0 || empty > 0
                                ? `${invalid > 0 ? `Fix ${invalid} invalid ${invalid === 1 ? 'mark' : 'marks'}${empty > 0 ? ' and ' : ''}` : ''}${empty > 0 ? `${invalid > 0 ? 'fill' : 'Fill'} ${empty} empty ${empty === 1 ? 'mark' : 'marks'}` : ''} before submitting.`
                                : 'Every mark is in. Submit when you are done.'
                            : published
                              ? 'These marks are published and locked. A change needs a correction approved by the principal.'
                              : 'Marks cannot be entered now.')}
                </p>
                <p className="text-[13px] leading-4 text-text-muted">
                    {rows.length} {rows.length === 1 ? 'student' : 'students'} · Enter moves to the next student
                </p>
            </div>
        </div>
    );
}

export default withAppShell(Sheet);
