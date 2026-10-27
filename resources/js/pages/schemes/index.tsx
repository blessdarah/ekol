import { Form, Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    index,
    note,
    show,
} from '@/actions/App/Http/Controllers/SchemeController';
import { dayMonth } from '../../components/fees/ui';
import {
    SchemesHeader,
    StateLabel,
    StepBar,
    type Steps,
} from '../../components/schemes/ui';
import {
    StructureTabs,
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Row {
    id: string;
    subject: string | null;
    class: string | null;
    teacher: string | null;
    status: string;
    topics: number;
    state: string;
    progress: { planned: number; taught: number };
}

interface Panel {
    id: string;
    subject: string | null;
    class: string | null;
    teacher: string | null;
    status: string;
    topics: number;
    state: string;
    approved_on: string | null;
    approved_by: string | null;
    late: number;
    late_weeks: number[];
    items: {
        id: string;
        week: number;
        label: string;
        state: 'taught' | 'late' | 'this_week' | 'planned';
    }[];
}

interface IndexProps {
    steps: Steps;
    week: number | null;
    dueOn: string;
    canManage: boolean;
    totals: {
        all: number;
        submitted: number;
        to_approve: number;
        behind: number;
        not_submitted: number;
    };
    filters: { show: string };
    rows: Row[];
    picked: Panel | null;
}

const ITEM_STATES: Record<
    Panel['items'][number]['state'],
    { label: string; text: string }
> = {
    taught: { label: 'Taught', text: 'text-success' },
    late: { label: 'Not yet', text: 'text-[#8A5A12]' },
    this_week: { label: 'This week', text: 'text-text' },
    planned: { label: 'Planned', text: 'text-text-muted' },
};

function SchemesIndex({
    steps,
    week,
    dueOn,
    canManage,
    totals,
    filters,
    rows,
    picked,
}: IndexProps) {
    const [writing, setWriting] = useState(false);
    const tabs = [
        { key: 'all', label: t('All'), count: totals.all },
        { key: 'to_approve', label: t('To approve'), count: totals.to_approve },
        { key: 'behind', label: t('Behind'), count: totals.behind },
        {
            key: 'not_submitted',
            label: t('Not submitted'),
            count: totals.not_submitted,
        },
    ];
    const stats = [
        {
            label: t('Submitted'),
            value: t(':count of :total', {
                count: totals.submitted,
                total: totals.all,
            }),
            tone: 'text-text',
        },
        {
            label: t('Waiting for approval'),
            value: String(totals.to_approve),
            tone: 'text-text',
        },
        {
            label: t('Behind the plan'),
            value: String(totals.behind),
            tone: totals.behind > 0 ? 'text-[#8A5A12]' : 'text-text',
        },
        {
            label: t('Not submitted'),
            value: String(totals.not_submitted),
            tone: totals.not_submitted > 0 ? 'text-danger' : 'text-text',
        },
    ];

    function pick(id: string | null) {
        const query: Record<string, string> = {};

        if (filters.show !== 'all') {
            query.show = filters.show;
        }
        if (id) {
            query.scheme = id;
        }

        setWriting(false);
        router.get(
            index.url({ query }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Schemes of work')} />
            {canManage && <StructureTabs active="schemes" />}
            <SchemesHeader
                title={t('Schemes of work')}
                sub={
                    steps.term
                        ? t(
                              'What each teacher plans to teach, week by week, and how far they have got. :term · week :week of :weeks · due :due.',
                              {
                                  term: t(steps.term.label),
                                  week: week ?? 0,
                                  weeks: steps.term.weeks,
                                  due: dayMonth(dueOn, false),
                              },
                          )
                        : undefined
                }
                action={
                    totals.to_approve > 0 ? (
                        <Link
                            href={index.url({ query: { show: 'to_approve' } })}
                            className={outlineButtonClass}
                        >
                            {t('Approve :count waiting →', {
                                count: totals.to_approve,
                            })}
                        </Link>
                    ) : undefined
                }
            />
            <StepBar steps={steps} active="progress" />

            <div className="flex flex-wrap border-y border-solid border-border">
                {stats.map((stat, position) => (
                    <div
                        key={stat.label}
                        className={`flex min-w-[150px] flex-1 flex-col gap-1 py-3 ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                    >
                        <span className={capsLabelClass}>{stat.label}</span>
                        <span
                            className={`font-display text-[24px] leading-7 font-bold ${stat.tone}`}
                        >
                            {stat.value}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => (
                            <Link
                                key={tab.key}
                                href={index.url({
                                    query:
                                        tab.key === 'all'
                                            ? {}
                                            : { show: tab.key },
                                })}
                                preserveScroll
                                className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] ${
                                    filters.show === tab.key
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {tab.label} · {tab.count}
                            </Link>
                        ))}
                    </div>
                    {rows.length === 0 ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] text-text">
                            {t('No scheme matches.')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[640px] flex-col">
                                <div
                                    className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                                >
                                    <span className="flex-1">
                                        {t('Subject · class')}
                                    </span>
                                    <span className="w-[130px] shrink-0">
                                        {t('Teacher')}
                                    </span>
                                    <span className="w-[130px] shrink-0">
                                        {t('Taught · week :week', {
                                            week: week ?? 0,
                                        })}
                                    </span>
                                    <span className="w-[130px] shrink-0">
                                        {t('Status')}
                                    </span>
                                </div>
                                {rows.map((row) => (
                                    <button
                                        key={row.id}
                                        type="button"
                                        onClick={() =>
                                            row.state === 'to_approve'
                                                ? router.visit(show.url(row.id))
                                                : pick(row.id)
                                        }
                                        className={`flex min-h-[46px] items-center gap-4 border-b border-solid border-border px-4 text-left last:border-b-0 hover:bg-surface ${picked?.id === row.id ? 'bg-primary-tint' : ''}`}
                                    >
                                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-text">
                                            {row.subject} · {row.class}
                                        </span>
                                        <span
                                            className={`w-[130px] shrink-0 truncate text-[13px] ${row.teacher ? 'text-text' : 'text-[#8A5A12]'}`}
                                        >
                                            {row.teacher ?? t('No teacher')}
                                        </span>
                                        <span
                                            className={`w-[130px] shrink-0 font-mono text-[13px] ${row.state === 'behind' ? 'text-[#8A5A12]' : 'text-text'}`}
                                        >
                                            {['on_track', 'behind'].includes(
                                                row.state,
                                            )
                                                ? t(':taught of :planned', {
                                                      taught: row.progress
                                                          .taught,
                                                      planned:
                                                          row.progress.planned,
                                                  })
                                                : '—'}
                                        </span>
                                        <span className="w-[130px] shrink-0">
                                            <StateLabel state={row.state} />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Teachers write their scheme and tick each sub-topic as taught in their portal. Here the school approves schemes and follows progress.',
                        )}
                    </p>
                </div>

                <aside className="flex shrink-0 flex-col gap-3 xl:w-[310px] xl:border-l xl:border-solid xl:border-border xl:pl-6">
                    {!picked ? (
                        <p className="text-[13px] text-text-muted">
                            {t('Pick a scheme to see its plan week by week.')}
                        </p>
                    ) : (
                        <>
                            <span className={capsLabelClass}>
                                {t('Scheme · :term', {
                                    term: t(steps.term?.label ?? ''),
                                })}
                            </span>
                            <div className="flex flex-col gap-1">
                                <h2 className="font-display text-[20px] leading-6 font-bold text-text">
                                    {picked.subject} · {picked.class}
                                </h2>
                                <p className="text-[13px] text-text-muted">
                                    {picked.teacher ?? t('No teacher yet')}
                                    {picked.approved_on &&
                                        ` · ${t('approved :date', { date: dayMonth(picked.approved_on, false) })}`}
                                    {picked.approved_by &&
                                        ` ${t('by :name', { name: picked.approved_by })}`}
                                </p>
                            </div>
                            {picked.late > 0 && (
                                <p className="rounded-md bg-warning-tint px-3 py-2 text-[13px] leading-[19px] text-text">
                                    {t(
                                        ':count planned for weeks :weeks are not taught yet.',
                                        {
                                            count: picked.late,
                                            weeks: picked.late_weeks.join(', '),
                                        },
                                    )}
                                </p>
                            )}
                            {picked.items.length === 0 ? (
                                <p className="text-[13px] text-text-muted">
                                    {t('Nothing is placed in a week yet.')}
                                </p>
                            ) : (
                                <ul className="flex flex-col divide-y divide-border border-y border-solid border-border">
                                    {picked.items.slice(0, 12).map((item) => (
                                        <li
                                            key={item.id}
                                            className={`flex items-center gap-3 py-2 text-[13px] ${item.state === 'late' ? 'bg-warning-tint' : ''}`}
                                        >
                                            <span className="w-8 shrink-0 font-mono text-[12px] text-text-muted">
                                                W{item.week}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-text">
                                                {item.label}
                                            </span>
                                            <span
                                                className={`shrink-0 ${ITEM_STATES[item.state].text}`}
                                            >
                                                {t(
                                                    ITEM_STATES[item.state]
                                                        .label,
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {picked.items.length > 12 && (
                                <p className="text-[12px] text-text-muted">
                                    {t(':count more not shown', {
                                        count: picked.items.length - 12,
                                    })}
                                </p>
                            )}
                            {writing ? (
                                <Form
                                    action={note.url(picked.id)}
                                    method="post"
                                    resetOnSuccess
                                    onSuccess={() => setWriting(false)}
                                    className="flex flex-col gap-2"
                                >
                                    {({ errors, processing }) => (
                                        <>
                                            <label className="flex flex-col gap-1 text-[13px] font-medium text-text">
                                                {t('Note to :name', {
                                                    name:
                                                        picked.teacher ??
                                                        t('the teacher'),
                                                })}
                                                <textarea
                                                    name="note"
                                                    rows={3}
                                                    className="rounded-md border border-solid border-border bg-white px-3 py-2 text-[14px] font-normal outline-none focus:border-primary"
                                                />
                                            </label>
                                            {errors.note && (
                                                <p className="text-[13px] text-danger">
                                                    {errors.note}
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className={solidButtonClass}
                                                >
                                                    {t('Send')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setWriting(false)
                                                    }
                                                    className={
                                                        outlineButtonClass
                                                    }
                                                >
                                                    {t('Cancel')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setWriting(true)}
                                        className={`${solidButtonClass} flex-1`}
                                    >
                                        {t('Send a note')}
                                    </button>
                                    <Link
                                        href={show.url(picked.id)}
                                        className={`${outlineButtonClass} flex-1`}
                                    >
                                        {t('Open scheme →')}
                                    </Link>
                                </div>
                            )}
                            <p className="text-[12px] leading-[17px] text-text-muted">
                                {t(
                                    'The teacher sees the note on their scheme. Open scheme shows the full plan and its history.',
                                )}
                            </p>
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(SchemesIndex);
