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
    PlanPicker,
    type PlanSummary,
    amberText,
    day,
    linkClass,
    primaryClass,
    quietClass,
    range,
} from '../../components/assessments/ui';
import { ErrorText, capsLabelClass } from '../../components/structure/ui';
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
        missing: {
            sheet_id: string;
            subject_id: string;
            subject: string | null;
            teacher: string | null;
            entered: number;
        }[];
    }[];
}

const STEPS = [
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'held', label: 'Tests held' },
    { key: 'marks_open', label: 'Marks open' },
    { key: 'marks_closed', label: 'Marks closed' },
    { key: 'published', label: 'Published' },
];

function Progress({
    tabs,
    plans,
    plan,
    acceptsMarks,
    termEnds,
    stats,
    classes,
}: ProgressProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
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
    const share =
        stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
    const left = stats.total - stats.submitted;
    const canExtend = plan.state !== 'published';
    const sub = [
        'dates set',
        range(plan.held_from, plan.held_until),
        plan.state === 'scheduled'
            ? `from ${day(plan.window_starts_on)}`
            : `until ${day(plan.window_ends_on)}`,
        'results can be reviewed',
        'marks locked',
    ];

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Marks progress')} />
            <AssessmentHeader
                active="progress"
                tabs={tabs}
                trail={[{ label: t('Marks progress') }]}
                title={t('Marks progress')}
                meta={t('Who has handed in marks for the assessment you pick.')}
                action={
                    canExtend && (
                        <button
                            type="button"
                            onClick={() => setExtending(!extending)}
                            className={quietClass}
                        >
                            {plan.state === 'marks_closed'
                                ? t('Reopen marks entry')
                                : t('Extend the marks window')}
                        </button>
                    )
                }
            />

            <PlanPicker
                plans={plans}
                current={plan.id}
                href={(id) => progress.url({ query: { plan: id } })}
            />

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
                    className="flex flex-wrap items-end gap-3 rounded-md border border-solid border-border bg-surface p-4"
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

            <div className="flex flex-col gap-3 rounded-lg bg-surface p-4">
                <ol className="flex flex-wrap items-center gap-x-3 gap-y-3">
                    {STEPS.map((step, position) => {
                        const done =
                            position < reached || plan.state === 'published';
                        const now =
                            position === reached && plan.state !== 'published';

                        return (
                            <li
                                key={step.key}
                                className="flex min-w-[150px] flex-1 items-center gap-3"
                            >
                                {position > 0 && (
                                    <span
                                        className={`hidden h-px w-8 shrink-0 md:block ${done || now ? 'bg-success' : 'bg-border'}`}
                                    />
                                )}
                                <span
                                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                                        done
                                            ? 'bg-success'
                                            : now
                                              ? 'bg-primary'
                                              : 'border border-solid border-border bg-white'
                                    }`}
                                >
                                    {done ? (
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                d="M5 12.5l4.5 4.5L19 7.5"
                                                fill="none"
                                                stroke="#FFFFFF"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    ) : now ? (
                                        <span className="size-2 rounded-full bg-white" />
                                    ) : null}
                                </span>
                                <span className="flex flex-col">
                                    <span
                                        className={`text-[13px] leading-4 ${done || now ? 'font-semibold text-text' : 'font-medium text-text-muted'}`}
                                    >
                                        {t(step.label)}
                                    </span>
                                    <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                        {sub[position]}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
                {plan.kind === 'exam' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-3">
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t(
                                'An exam adds a step first: its schedule, with one paper per subject and level.',
                            )}
                        </p>
                        <Link
                            href={schedule.url({ query: { plan: plan.id } })}
                            className={`${quietClass} h-8`}
                        >
                            {plan.has_schedule
                                ? t('Open the exam schedule →')
                                : t('Set the :plan schedule →', {
                                      plan: plan.name,
                                  })}
                        </Link>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap border-y border-solid border-border">
                <div className="flex min-w-[200px] flex-1 flex-col gap-[2px] py-[10px] pr-4">
                    <span className={capsLabelClass}>
                        {t('Mark sheets submitted')}
                    </span>
                    <span className="flex items-baseline gap-2">
                        <span className="font-display text-[24px] leading-7 font-extrabold text-text">
                            {stats.submitted}
                        </span>
                        <span className="font-mono text-[12px] leading-4 text-text-muted">
                            {t('of :total · :share%', {
                                total: stats.total,
                                share,
                            })}
                        </span>
                    </span>
                </div>
                <div className="flex min-w-[200px] flex-1 flex-col gap-[2px] border-l border-solid border-border px-4 py-[10px]">
                    <span className={capsLabelClass}>
                        {t('Teachers still to submit')}
                    </span>
                    <span
                        className={`font-display text-[24px] leading-7 font-extrabold ${stats.teachers > 0 ? amberText : 'text-text'}`}
                    >
                        {stats.teachers}
                    </span>
                </div>
                <div className="flex min-w-[200px] flex-1 flex-col gap-[2px] border-l border-solid border-border py-[10px] pl-4">
                    <span className={capsLabelClass}>
                        {plan.state === 'scheduled'
                            ? t('Window opens')
                            : t('Window closes')}
                    </span>
                    <span className="flex items-baseline gap-2">
                        <span className="font-display text-[24px] leading-7 font-extrabold text-text">
                            {day(
                                plan.state === 'scheduled'
                                    ? plan.window_starts_on
                                    : plan.window_ends_on,
                            )}
                        </span>
                        {plan.state === 'marks_open' &&
                            plan.days_left !== null && (
                                <span
                                    className={`font-mono text-[12px] leading-4 ${plan.days_left < 0 ? 'text-danger' : 'text-text-muted'}`}
                                >
                                    {plan.days_left < 0
                                        ? t('ended')
                                        : plan.days_left === 0
                                          ? t('today')
                                          : t('in :days_left :days', {
                                                days_left: plan.days_left,
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

            {classes.length === 0 ? (
                <Empty title={t('No mark sheets yet')}>
                    {t(
                        'Sheets are made for every class in the assessment’s levels, one per subject the class takes. None of those classes has subjects yet.',
                    )}
                </Empty>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[820px] flex-col">
                        <div
                            className={`flex h-[34px] items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                        >
                            <span className="w-[130px] shrink-0">
                                {t('Class')}
                            </span>
                            <span className="w-[130px] shrink-0">
                                {t('Form master')}
                            </span>
                            <span className="w-[230px] shrink-0">
                                {t('Sheets submitted')}
                            </span>
                            <span className="flex-1">
                                {t('Still missing from')}
                            </span>
                        </div>
                        {classes.map((row, position) => {
                            const ratio =
                                row.total > 0 ? row.submitted / row.total : 0;

                            return (
                                <div
                                    key={row.id ?? row.name}
                                    className={`flex min-h-10 items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                >
                                    <span className="w-[130px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text">
                                        {row.name}
                                    </span>
                                    <span className="w-[130px] shrink-0 truncate text-[13px] leading-4 text-text">
                                        {row.form_master ?? '—'}
                                    </span>
                                    <span className="flex w-[230px] shrink-0 items-center gap-3">
                                        <span className="flex h-1 flex-1 rounded-full bg-border">
                                            <span
                                                className={`h-1 rounded-full ${ratio >= 1 ? 'bg-success' : ratio < 0.7 ? 'bg-danger' : 'bg-warning'}`}
                                                style={{
                                                    width: `${Math.round(ratio * 100)}%`,
                                                }}
                                            />
                                        </span>
                                        <span className="w-[54px] shrink-0 font-mono text-[12px] leading-4 text-text">
                                            {row.submitted} / {row.total}
                                        </span>
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-1 text-[13px] leading-4">
                                        {row.missing.length === 0 ? (
                                            <span className="text-text-muted">
                                                {t('Complete')}
                                            </span>
                                        ) : (
                                            row.missing.map((sheet, index_) => (
                                                <span
                                                    key={sheet.sheet_id}
                                                    className="flex items-center gap-1"
                                                >
                                                    {index_ > 0 && (
                                                        <span className="text-text-muted">
                                                            ·
                                                        </span>
                                                    )}
                                                    {sheet.teacher ? (
                                                        <Link
                                                            href={sheetPage.url(
                                                                sheet.sheet_id,
                                                                {
                                                                    query: {
                                                                        from: 'progress',
                                                                    },
                                                                },
                                                            )}
                                                            className="text-text hover:underline"
                                                        >
                                                            {sheet.subject} (
                                                            {sheet.teacher})
                                                        </Link>
                                                    ) : (
                                                        <Link
                                                            href={editSubject.url(
                                                                sheet.subject_id,
                                                            )}
                                                            className={`font-medium hover:underline ${amberText}`}
                                                        >
                                                            {t(
                                                                ':subject · no teacher, assign →',
                                                                {
                                                                    subject:
                                                                        sheet.subject,
                                                                },
                                                            )}
                                                        </Link>
                                                    )}
                                                </span>
                                            ))
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <ErrorText message={errors.close} />

            <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-[520px] text-[13px] leading-[19px] text-text">
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
                <div className="flex flex-wrap gap-2">
                    {plan.state !== 'scheduled' && (
                        <Link
                            href={results.url({ query: { plan: plan.id } })}
                            className={quietClass}
                        >
                            {plan.state === 'marks_open'
                                ? t('See results so far')
                                : t('Open results')}
                        </Link>
                    )}
                    {plan.state === 'marks_open' && (
                        <button
                            type="button"
                            onClick={() => setClosing(true)}
                            className="flex h-9 items-center rounded-md border border-solid border-primary bg-white px-4 text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint"
                        >
                            {t('Close marks entry and review results →')}
                        </button>
                    )}
                </div>
            </div>

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
