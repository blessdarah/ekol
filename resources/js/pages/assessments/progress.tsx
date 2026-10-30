import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    close,
    index,
    progress,
    results,
    window as moveWindow,
} from '@/actions/App/Http/Controllers/AssessmentController';
import { show as schedule } from '@/actions/App/Http/Controllers/ExamScheduleController';
import { show as sheetPage } from '@/actions/App/Http/Controllers/MarkSheetController';
import { edit as editSubject } from '@/actions/App/Http/Controllers/SubjectController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    Empty,
    type PlanSummary,
    amberText,
    day,
    linkClass,
    primaryClass,
    quietClass,
    range,
} from '../../components/assessments/ui';
import { ErrorText, Toggle } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface ProgressProps {
    tabs: AssessmentTabs;
    plans: PlanSummary[];
    plan: PlanSummary | null;
    acceptsMarks: boolean;
    termEnds: string | null;
    stats: {
        submitted: number;
        total: number;
        teachers: number;
        unstaffed: number;
    };
    classes: {
        id: string | null;
        name: string;
        form_master: string | null;
        submitted: number;
        total: number;
        missing: MissingSheet[];
    }[];
    teachers: {
        id: string | null;
        name: string | null;
        initials: string | null;
        phone: string | null;
        missing: MissingSheet[];
    }[];
}

interface MissingSheet {
    sheet_id: string;
    subject_id: string;
    subject: string | null;
    class: string | null;
    teacher: string | null;
    initials: string | null;
    entered: number;
    students: number;
}

const STEPS = [
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'held', label: 'Tests held' },
    { key: 'marks_open', label: 'Marks open' },
    { key: 'marks_closed', label: 'Marks closed' },
    { key: 'published', label: 'Published' },
];

const headClass =
    'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

function Tick() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1E7F4F"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
    );
}

/**
 * A sheet still to hand in: it opens the sheet, shows how many marks
 * are in once some are, and the teacher's initials when asked. A sheet
 * nobody teaches links to the subject to assign someone.
 */
function SheetChip({
    sheet,
    label,
    withTeacher = false,
}: {
    sheet: MissingSheet;
    label: string;
    withTeacher?: boolean;
}) {
    if (!sheet.teacher) {
        return (
            <Link
                href={editSubject.url(sheet.subject_id)}
                className="flex h-7 items-center rounded-full border border-dashed border-[#D9B979] bg-warning-tint px-[10px] text-[13px] font-medium text-[#8A5A12] hover:underline"
            >
                {t(':subject · no teacher, assign →', { subject: label })}
            </Link>
        );
    }

    return (
        <Link
            href={sheetPage.url(sheet.sheet_id, {
                query: { from: 'progress' },
            })}
            title={sheet.teacher}
            className={`flex h-7 items-center gap-[6px] rounded-full border border-solid border-border bg-white text-[13px] text-text hover:border-primary ${withTeacher ? 'pr-1 pl-[10px]' : 'px-[10px]'}`}
        >
            {label}
            {sheet.entered > 0 && (
                <span className="font-mono text-[11px] text-text-muted">
                    {sheet.entered}/{sheet.students}
                </span>
            )}
            {withTeacher && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-tint text-[10px] font-semibold text-primary">
                    {sheet.initials}
                </span>
            )}
        </Link>
    );
}

function Progress({
    tabs,
    plans,
    plan,
    acceptsMarks,
    termEnds,
    stats,
    classes,
    teachers,
}: ProgressProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [view, setView] = useState<'class' | 'teacher'>('class');
    const [onlyMissing, setOnlyMissing] = useState(true);
    const [closing, setClosing] = useState(false);
    const [extending, setExtending] = useState(false);
    const [until, setUntil] = useState(plan?.window_ends_on ?? '');

    if (!plan) {
        return (
            <div className="flex flex-col gap-5">
                <Head title={t('Marks progress')} />
                <AssessmentHeader
                    active="progress"
                    tabs={tabs}
                    trail={[{ label: t('Marks progress') }]}
                    title={t('Marks progress')}
                    meta={t(
                        'Who has handed in marks for the assessment you pick.',
                    )}
                />
                <Empty title={t('Nothing is scheduled yet')}>
                    {t(
                        'Marks progress follows an assessment once it is scheduled.',
                    )}{' '}
                    <Link
                        href={index.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Open the calendar →')}
                    </Link>
                </Empty>
            </div>
        );
    }

    const reached = {
        scheduled: 0,
        marks_open: 2,
        marks_closed: 3,
        published: 4,
        draft: -1,
    }[plan.state];
    const left = stats.total - stats.submitted;
    const canExtend = plan.state !== 'published';
    const waiting = left - stats.unstaffed;
    const complete = classes.filter(
        (row) => row.total > 0 && row.submitted >= row.total,
    ).length;
    const shownClasses = onlyMissing
        ? classes.filter((row) => row.missing.length > 0)
        : classes;
    const bar = [
        { count: stats.submitted, tone: 'bg-success' },
        { count: waiting, tone: 'bg-warning' },
        { count: stats.unstaffed, tone: 'bg-[#B8C2BD]' },
    ].filter((part) => part.count > 0);
    const deadline = {
        scheduled: t('Marks open :date', { date: day(plan.window_starts_on) }),
        marks_open: t('Marks close :date', {
            date: day(plan.window_ends_on),
        }),
        marks_closed: t('Marks closed :date', { date: day(plan.closed_on) }),
        published: t('Published :date', { date: day(plan.published_on) }),
        draft: '',
    }[plan.state];

    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Marks progress')} />
            <AssessmentHeader
                active="progress"
                tabs={tabs}
                trail={[{ label: t('Marks progress') }]}
                title={t('Marks progress')}
                meta={[
                    plan.name,
                    plan.term ? t(plan.term) : null,
                    plan.held_from && plan.held_until
                        ? t('tests held :range', {
                              range: range(plan.held_from, plan.held_until),
                          })
                        : null,
                ]
                    .filter(Boolean)
                    .join(' · ')}
                action={
                    <div className="flex flex-wrap gap-2">
                        {canExtend && (
                            <button
                                type="button"
                                onClick={() => setExtending(!extending)}
                                className={quietClass}
                            >
                                {plan.state === 'marks_closed'
                                    ? t('Reopen marks entry')
                                    : t('Extend the window')}
                            </button>
                        )}
                        {plan.state === 'marks_open' ? (
                            <button
                                type="button"
                                onClick={() => setClosing(true)}
                                className={primaryClass}
                            >
                                {t('Close marks entry →')}
                            </button>
                        ) : (
                            plan.state !== 'scheduled' && (
                                <Link
                                    href={results.url({
                                        query: { plan: plan.id },
                                    })}
                                    className={primaryClass}
                                >
                                    {t('Open results →')}
                                </Link>
                            )
                        )}
                    </div>
                }
            />

            <div className="-mt-2 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-solid border-border pb-5">
                    <nav
                        aria-label={t('Assessment')}
                        className="flex flex-wrap gap-1 rounded-[10px] bg-surface p-[3px] text-[13px] leading-4"
                    >
                        {plans.map((option) => {
                            const current = option.id === plan.id;

                            return (
                                <Link
                                    key={option.id}
                                    href={progress.url({
                                        query: { plan: option.id },
                                    })}
                                    aria-current={current ? 'page' : undefined}
                                    preserveScroll
                                    className={`flex h-[30px] items-center gap-[6px] rounded-[7px] px-3 ${
                                        current
                                            ? 'bg-white font-semibold text-text shadow-[0_1px_2px_rgba(16,25,21,0.12)]'
                                            : 'text-text-muted hover:text-text'
                                    }`}
                                >
                                    {option.state === 'marks_open' && (
                                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                    )}
                                    {option.name}
                                    {option.state === 'published' && (
                                        <span
                                            className="text-success"
                                            aria-label={t('Published')}
                                        >
                                            ✓
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                    <ol className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13px] leading-4">
                        {plan.kind === 'exam' && (
                            <li>
                                <Link
                                    href={schedule.url({
                                        query: { plan: plan.id },
                                    })}
                                    className={`flex items-center gap-[6px] hover:underline ${plan.has_schedule ? 'text-text-muted' : `font-semibold ${amberText}`}`}
                                >
                                    {plan.has_schedule && <Tick />}
                                    {plan.has_schedule
                                        ? t('Exam schedule')
                                        : t('Set the exam schedule →')}
                                </Link>
                            </li>
                        )}
                        {STEPS.map((step, position) => {
                            const done =
                                position < reached ||
                                plan.state === 'published';
                            const now =
                                position === reached &&
                                plan.state !== 'published';

                            return (
                                <li
                                    key={step.key}
                                    aria-current={now ? 'step' : undefined}
                                    className={`flex items-center gap-[6px] ${now ? 'font-semibold text-text' : 'text-text-muted'}`}
                                >
                                    {now ? (
                                        <span className="h-[7px] w-[7px] rounded-full bg-primary" />
                                    ) : (
                                        done && <Tick />
                                    )}
                                    {t(step.label)}
                                </li>
                            );
                        })}
                    </ol>
                </div>

                {extending && (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            router.post(
                                moveWindow.url(plan.id),
                                { window_ends_on: until },
                                {
                                    preserveScroll: true,
                                    onSuccess: () => setExtending(false),
                                },
                            );
                        }}
                        className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-solid border-border bg-surface p-4"
                    >
                        <label className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                            {t('Marks close on')}
                            <input
                                type="date"
                                value={until}
                                max={termEnds ?? undefined}
                                onChange={(e) => setUntil(e.target.value)}
                                className="h-9 rounded-md border border-solid border-border bg-white px-3 font-mono text-[13px] font-normal text-text outline-none focus:border-primary"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={!until}
                            className={primaryClass}
                        >
                            {t('Save the new date')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setExtending(false)}
                            className={quietClass}
                        >
                            {t('Cancel')}
                        </button>
                        <p className="basis-full text-[13px] leading-[18px] text-text-muted">
                            {plan.state === 'marks_closed'
                                ? t(
                                      'Saving reopens marks entry for teachers until this day.',
                                  )
                                : t(
                                      'Teachers can enter marks until the end of this day.',
                                  )}
                        </p>
                        <ErrorText message={errors.window_ends_on} />
                    </form>
                )}

                <div className="flex flex-wrap items-end gap-x-14 gap-y-5 pt-8 pb-7">
                    <div className="flex w-[260px] shrink-0 flex-col gap-1">
                        <p className="font-display text-[56px] leading-[56px] font-extrabold tracking-[-0.03em] text-text">
                            {stats.submitted}
                            <span className="font-light text-text-muted">
                                {' '}
                                / {stats.total}
                            </span>
                        </p>
                        <p className="text-[14px] leading-5 text-text-muted">
                            {t('mark sheets handed in')}
                        </p>
                    </div>
                    <div className="flex min-w-[280px] flex-1 flex-col gap-[14px]">
                        <div className="flex h-3 gap-[3px]" aria-hidden>
                            {bar.length === 0 ? (
                                <span className="h-3 flex-1 rounded-full bg-border" />
                            ) : (
                                bar.map((part, position) => (
                                    <span
                                        key={part.tone}
                                        className={`h-3 ${part.tone} ${position === 0 ? 'rounded-l-full' : 'rounded-l-[2px]'} ${position === bar.length - 1 ? 'rounded-r-full' : 'rounded-r-[2px]'}`}
                                        style={{ flexGrow: part.count }}
                                    />
                                ))
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] leading-4 text-text">
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-success" />
                                {t('Handed in')}
                                <span className="font-mono text-text-muted">
                                    {stats.submitted}
                                </span>
                            </span>
                            {waiting > 0 && (
                                <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-warning" />
                                    {t('Missing, from :count :teachers', {
                                        count: stats.teachers,
                                        teachers:
                                            stats.teachers === 1
                                                ? t('teacher')
                                                : t('teachers'),
                                    })}
                                    <span className="font-mono text-text-muted">
                                        {waiting}
                                    </span>
                                </span>
                            )}
                            {stats.unstaffed > 0 && (
                                <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-[#B8C2BD]" />
                                    {t('No teacher')}
                                    <span className="font-mono text-text-muted">
                                        {stats.unstaffed}
                                    </span>
                                </span>
                            )}
                            <span className="flex-1" />
                            <span className="flex items-center gap-[6px] text-text-muted">
                                {deadline}
                                {plan.state === 'marks_open' &&
                                    plan.days_left !== null && (
                                        <span
                                            className={`font-semibold ${plan.days_left < 0 ? 'text-danger' : plan.days_left <= 3 ? amberText : 'text-text-muted'}`}
                                        >
                                            ·{' '}
                                            {plan.days_left < 0
                                                ? t('ended')
                                                : plan.days_left === 0
                                                  ? t('today')
                                                  : t('in :days_left :days', {
                                                        days_left:
                                                            plan.days_left,
                                                        days:
                                                            plan.days_left === 1
                                                                ? t('day')
                                                                : t('days'),
                                                    })}
                                        </span>
                                    )}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex rounded-[9px] bg-surface p-[3px] text-[13px] leading-4">
                        {(
                            [
                                { key: 'class', label: t('By class') },
                                { key: 'teacher', label: t('By teacher') },
                            ] as const
                        ).map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                aria-pressed={view === option.key}
                                onClick={() => setView(option.key)}
                                className={`flex h-[30px] items-center rounded-[7px] px-[14px] ${
                                    view === option.key
                                        ? 'bg-white font-semibold text-text shadow-[0_1px_2px_rgba(16,25,21,0.12)]'
                                        : 'text-text-muted hover:text-text'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    {view === 'class' ? (
                        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
                            <Toggle
                                label={t('Only classes with sheets missing')}
                                checked={onlyMissing}
                                onChange={setOnlyMissing}
                            />
                            {t('Only classes with sheets missing')}
                        </label>
                    ) : (
                        <span className="text-[13px] text-text-muted">
                            {t('Who still owes sheets, most first')}
                        </span>
                    )}
                    <span className="flex-1" />
                    <span className="text-[13px] text-text-muted">
                        {view === 'class'
                            ? t(':shown of :all classes', {
                                  shown: shownClasses.length,
                                  all: classes.length,
                              })
                            : t(':teachers · :sheets', {
                                  teachers: t(':count teachers', {
                                      count: stats.teachers,
                                  }),
                                  sheets: t(':count sheets', { count: left }),
                              })}
                    </span>
                </div>
            </div>

            {classes.length === 0 ? (
                <Empty title={t('No mark sheets yet')}>
                    {t(
                        'Sheets are made for every class in the assessment’s levels, one per subject the class takes. None of those classes has subjects yet.',
                    )}
                </Empty>
            ) : view === 'class' ? (
                <div className="-mt-4 flex flex-col gap-4">
                    <div className="overflow-x-auto rounded-xl border border-solid border-border">
                        <div className="flex min-w-[820px] flex-col">
                            <div
                                className={`flex h-[38px] items-center gap-4 border-b border-solid border-border bg-surface px-5 ${headClass}`}
                            >
                                <span className="w-[200px] shrink-0">
                                    {t('Class')}
                                </span>
                                <span className="w-[200px] shrink-0">
                                    {t('Sheets in')}
                                </span>
                                <span className="flex-1">
                                    {t('Still missing')}
                                </span>
                            </div>
                            {shownClasses.length === 0 && (
                                <p className="px-5 py-10 text-center text-[13px] text-text-muted">
                                    {t(
                                        'Every class has handed in every sheet.',
                                    )}
                                </p>
                            )}
                            {shownClasses.map((row) => {
                                const ratio =
                                    row.total > 0
                                        ? row.submitted / row.total
                                        : 0;

                                return (
                                    <div
                                        key={row.id ?? row.name}
                                        className="flex min-h-[68px] items-center gap-4 border-b border-solid border-border px-5 py-3 last:border-b-0"
                                    >
                                        <span className="flex w-[200px] shrink-0 flex-col gap-[2px]">
                                            <span className="truncate text-[15px] leading-5 font-semibold text-text">
                                                {row.name}
                                            </span>
                                            <span className="truncate text-[13px] leading-4 text-text-muted">
                                                {row.form_master
                                                    ? t('Form master · :name', {
                                                          name: row.form_master,
                                                      })
                                                    : t('No form master')}
                                            </span>
                                        </span>
                                        <span className="flex w-[200px] shrink-0 items-center gap-3">
                                            <span className="flex h-[6px] w-[110px] shrink-0 overflow-hidden rounded-full bg-border">
                                                <span
                                                    className={
                                                        ratio >= 1
                                                            ? 'bg-success'
                                                            : 'bg-warning'
                                                    }
                                                    style={{
                                                        width: `${Math.round(ratio * 100)}%`,
                                                    }}
                                                />
                                            </span>
                                            <span className="font-mono text-[12px] text-text">
                                                {row.submitted}{' '}
                                                <span className="text-text-muted">
                                                    {t('of :total', {
                                                        total: row.total,
                                                    })}
                                                </span>
                                            </span>
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-wrap gap-[6px]">
                                            {row.missing.length === 0 ? (
                                                <span className="flex items-center gap-[6px] text-[13px] text-success">
                                                    <Tick />
                                                    {t('Every sheet is in')}
                                                </span>
                                            ) : (
                                                row.missing.map((sheet) => (
                                                    <SheetChip
                                                        key={sheet.sheet_id}
                                                        sheet={sheet}
                                                        label={
                                                            sheet.subject ?? ''
                                                        }
                                                        withTeacher
                                                    />
                                                ))
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] leading-[18px] text-text-muted">
                        <span className="flex items-center gap-[6px]">
                            {onlyMissing && complete > 0 && (
                                <>
                                    <Tick />
                                    {complete === 1
                                        ? t('1 class has every sheet in ·')
                                        : t(
                                              ':count classes have every sheet in ·',
                                              { count: complete },
                                          )}
                                    <button
                                        type="button"
                                        onClick={() => setOnlyMissing(false)}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {t('show them')}
                                    </button>
                                </>
                            )}
                        </span>
                        <span>
                            {t(
                                'Chips show marks entered so far · click to open the sheet',
                            )}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="-mt-4 overflow-x-auto rounded-xl border border-solid border-border">
                    <div className="flex min-w-[820px] flex-col">
                        <div
                            className={`flex h-[38px] items-center gap-4 border-b border-solid border-border bg-surface px-5 ${headClass}`}
                        >
                            <span className="w-[260px] shrink-0">
                                {t('Teacher')}
                            </span>
                            <span className="w-[90px] shrink-0">
                                {t('Missing')}
                            </span>
                            <span className="flex-1">{t('Sheets')}</span>
                        </div>
                        {teachers.length === 0 && (
                            <p className="px-5 py-10 text-center text-[13px] text-text-muted">
                                {t('Every sheet is handed in.')}
                            </p>
                        )}
                        {teachers.map((teacher) => (
                            <div
                                key={teacher.id ?? 'none'}
                                className="flex min-h-[68px] items-center gap-4 border-b border-solid border-border px-5 py-3 last:border-b-0"
                            >
                                <span className="flex w-[260px] shrink-0 items-center gap-3">
                                    {teacher.id ? (
                                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-[12px] font-semibold text-primary">
                                            {teacher.initials}
                                        </span>
                                    ) : (
                                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#D9B979] text-[14px] text-[#8A5A12]">
                                            +
                                        </span>
                                    )}
                                    <span className="flex min-w-0 flex-col gap-[2px]">
                                        <span
                                            className={`truncate text-[15px] leading-5 font-semibold ${teacher.id ? 'text-text' : amberText}`}
                                        >
                                            {teacher.name ?? t('No teacher')}
                                        </span>
                                        {teacher.id ? (
                                            teacher.phone && (
                                                <a
                                                    href={`tel:${teacher.phone.replace(/\s+/g, '')}`}
                                                    className="font-mono text-[12px] text-text-muted hover:text-text"
                                                >
                                                    {teacher.phone}
                                                </a>
                                            )
                                        ) : (
                                            <span className="text-[12px] text-text-muted">
                                                {t(
                                                    'assign one to open their sheets',
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                <span
                                    className={`w-[90px] shrink-0 text-[14px] leading-5 font-medium ${teacher.id ? 'text-text' : 'text-text-muted'}`}
                                >
                                    {t(':count sheets', {
                                        count: teacher.missing.length,
                                    })}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-wrap gap-[6px]">
                                    {teacher.missing.map((sheet) => (
                                        <SheetChip
                                            key={sheet.sheet_id}
                                            sheet={sheet}
                                            label={`${sheet.subject} · ${sheet.class}`}
                                        />
                                    ))}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <ErrorText message={errors.close} />

            <p className="-mt-3 max-w-[640px] text-[13px] leading-[19px] text-text-muted">
                {plan.state === 'scheduled' &&
                    t(
                        'Marks open on :window_starts_on. Teachers cannot enter marks before then.',
                        { window_starts_on: day(plan.window_starts_on) },
                    )}
                {plan.state === 'marks_open' &&
                    (acceptsMarks
                        ? t(
                              'Marks close on :window_ends_on. After that teachers cannot enter marks.',
                              { window_ends_on: day(plan.window_ends_on) },
                          )
                        : t(
                              'The window ended on :window_ends_on, so teachers can no longer enter marks. Extend it, or close marks entry.',
                              { window_ends_on: day(plan.window_ends_on) },
                          ))}
                {plan.state === 'marks_closed' &&
                    t(
                        'Marks entry is closed. Review the results, then publish them.',
                    )}
                {plan.state === 'published' &&
                    t(
                        'Results were published on :published_on. Marks are locked.',
                        { published_on: day(plan.published_on) },
                    )}
            </p>

            {closing && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('Close marks entry')}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4"
                >
                    <div className="flex w-full max-w-[520px] flex-col gap-4 rounded-lg bg-white p-6">
                        <div className="flex flex-col gap-2">
                            <h2 className="font-display text-[22px] leading-7 font-bold tracking-[-0.01em] text-text">
                                {t('Close marks entry for :plan?', {
                                    plan: plan.name,
                                })}
                            </h2>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {stats.submitted} {t('of')} {stats.total}{' '}
                                {t('mark sheets are in.')}
                                {left > 0
                                    ? t(
                                          ' :left :are still not submitted, from :teachers :teachers_a.',
                                          {
                                              left,
                                              are: left === 1 ? 'is' : 'are',
                                              teachers: stats.teachers,
                                              teachers_a:
                                                  stats.teachers === 1
                                                      ? 'teacher'
                                                      : 'teachers',
                                          },
                                      )
                                    : t(' Every sheet is submitted.')}
                            </p>
                        </div>
                        <ul className="flex flex-col border-y border-solid border-border">
                            {[
                                {
                                    tone: 'bg-warning',
                                    text: t(
                                        'Teachers can no longer enter or change :plan marks.',
                                        { plan: plan.name },
                                    ),
                                },
                                {
                                    tone: 'bg-warning',
                                    text: t(
                                        'Empty marks stay empty. A student with a missing mark is not ranked until it is in.',
                                    ),
                                },
                                {
                                    tone: 'bg-success',
                                    text: t(
                                        'Results open for review. Nothing is published yet.',
                                    ),
                                },
                                {
                                    tone: 'bg-success',
                                    text: t(
                                        'You can give teachers more time by reopening marks entry, until results are published.',
                                    ),
                                },
                            ].map((line) => (
                                <li
                                    key={line.text}
                                    className="flex items-start gap-[10px] border-b border-solid border-border py-[10px] text-[14px] leading-5 text-text last:border-b-0"
                                >
                                    <span
                                        className={`mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full ${line.tone}`}
                                    />
                                    {t(line.text)}
                                </li>
                            ))}
                        </ul>
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            {t('Teachers are not told automatically.')}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setClosing(false);
                                    setExtending(true);
                                }}
                                className={linkClass}
                            >
                                {t('Extend the window instead')}
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setClosing(false)}
                                    className={quietClass}
                                >
                                    {t('Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(close.url(plan.id))
                                    }
                                    className={primaryClass}
                                >
                                    {t('Close marks entry →')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withAppShell(Progress);
