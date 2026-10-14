import { Head, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import {
    index,
    structure,
    student,
} from '@/actions/App/Http/Controllers/FeeController';
import {
    FeesHeader,
    StatePill,
    amberText,
    figure,
} from '../../components/fees/ui';
import {
    capsLabelClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Filters {
    show: string;
    q: string;
}

interface FeesProps {
    yearLabel: string | null;
    currency: string;
    totals: {
        billed: number;
        collected: number;
        outstanding: number;
        overdue: number;
    };
    counts: Record<string, number>;
    filters: Filters;
    students: {
        rows: {
            id: string;
            name: string;
            matricule: string;
            class: string | null;
            due: number;
            paid: number;
            balance: number;
            overdue: number;
            state: string;
        }[];
        page: number;
        lastPage: number;
        total: number;
    };
    hasPlans: boolean;
}

const TABS = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'owing', label: 'Owing, not late' },
    { key: 'paid', label: 'Paid' },
    { key: 'unbilled', label: 'Not billed' },
];

function Fees({
    yearLabel,
    currency,
    totals,
    counts,
    filters,
    students,
    hasPlans,
}: FeesProps) {
    const [search, setSearch] = useState(filters.q);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const share =
        totals.billed > 0
            ? Math.round((totals.collected / totals.billed) * 100)
            : 0;

    function visit(patch: Partial<Filters> & { page?: number }) {
        const next = { ...filters, ...patch };
        const query: Record<string, string | number> = {};

        if (next.show !== 'all') {
            query.show = next.show;
        }
        if (next.q) {
            query.q = next.q;
        }
        if (patch.page && patch.page > 1) {
            query.page = patch.page;
        }

        router.get(
            index.url({ query }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    function onSearch(value: string) {
        setSearch(value);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => visit({ q: value.trim() }), 300);
    }

    const stats = [
        {
            label: t('Billed'),
            value: totals.billed,
            tone: 'text-text',
            note: t(':unbilled of :all students', {
                unbilled: counts.all - counts.unbilled,
                all: counts.all,
            }),
        },
        {
            label: t('Collected'),
            value: totals.collected,
            tone: 'text-success',
            note: t(':share% of what was billed', { share }),
        },
        {
            label: t('Outstanding'),
            value: totals.outstanding,
            tone: totals.outstanding > 0 ? amberText : 'text-text',
            note: t(':owing students owe', {
                owing: counts.overdue + counts.owing,
            }),
        },
        {
            label: t('Overdue'),
            value: totals.overdue,
            tone: totals.overdue > 0 ? 'text-danger' : 'text-text',
            note: t(':overdue students are late', { overdue: counts.overdue }),
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Fees')} />
            <FeesHeader
                active="students"
                title={t('Fees')}
                tag={yearLabel}
                meta={t(
                    'what each student was billed, has paid and still owes',
                )}
            />

            {!yearLabel ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'Fees are billed for an academic year, and no year is active. Make one active in School Setup first.',
                    )}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap border-y border-solid border-border">
                        {stats.map((stat, position) => (
                            <div
                                key={stat.label}
                                className={`flex min-w-[160px] flex-1 flex-col gap-[2px] py-3 ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                            >
                                <span className={capsLabelClass}>
                                    {t(stat.label)}
                                </span>
                                <span
                                    className={`font-mono text-[20px] leading-7 ${stat.tone}`}
                                >
                                    {figure(stat.value)}
                                </span>
                                <span className="text-[12px] leading-4 text-text-muted">
                                    {currency} · {stat.note}
                                </span>
                            </div>
                        ))}
                    </div>

                    {(!hasPlans || counts.unbilled > 0) && (
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
                            <p className="min-w-0 flex-1 text-[13px] leading-[19px] text-text">
                                {!hasPlans
                                    ? t(
                                          'No level has a fee for :year_label yet, so nobody can be billed.',
                                          { year_label: yearLabel },
                                      )
                                    : t(
                                          ':unbilled :have no invoice for :year_label.',
                                          {
                                              unbilled: counts.unbilled,
                                              have:
                                                  counts.unbilled === 1
                                                      ? 'student has'
                                                      : 'students have',
                                              year_label: yearLabel,
                                          },
                                      )}{' '}
                                {t(
                                    'Set fees and bill students under Fee structure.',
                                )}
                            </p>
                            <Link
                                href={structure.url()}
                                className={solidButtonClass}
                            >
                                {t('Open Fee structure →')}
                            </Link>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                            {TABS.map((tab) => {
                                const active = filters.show === tab.key;

                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => visit({ show: tab.key })}
                                        className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                            active
                                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                : 'border-border font-medium text-text hover:bg-surface'
                                        }`}
                                    >
                                        {tab.key === 'overdue' &&
                                            counts.overdue > 0 && (
                                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-danger" />
                                            )}
                                        {t(tab.label)} · {counts[tab.key] ?? 0}
                                    </button>
                                );
                            })}
                        </div>
                        <label className="flex h-9 w-[260px] items-center gap-2 rounded-md border border-solid border-border px-3 focus-within:border-primary">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                className="shrink-0"
                            >
                                <circle
                                    cx="11"
                                    cy="11"
                                    r="7"
                                    fill="none"
                                    stroke="#56625C"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M16 16l5 5"
                                    fill="none"
                                    stroke="#56625C"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="sr-only">
                                {t('Search students')}
                            </span>
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => onSearch(e.target.value)}
                                placeholder={t('Name or matricule')}
                                className="w-full bg-transparent text-[14px] leading-[18px] text-text outline-none placeholder:text-text-muted"
                            />
                        </label>
                    </div>

                    {students.rows.length === 0 ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            {counts.all === 0
                                ? t(
                                      'No student is enrolled in :year_label yet.',
                                      { year_label: yearLabel },
                                  )
                                : t('No student matches.')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[860px] flex-col">
                                <div
                                    className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                                >
                                    <span className="flex-1">
                                        {t('Student')}
                                    </span>
                                    <span className="w-[110px] shrink-0">
                                        {t('Class')}
                                    </span>
                                    <span className="w-[100px] shrink-0 text-right">
                                        {t('Annual fees')}
                                    </span>
                                    <span className="w-[100px] shrink-0 text-right">
                                        {t('Paid')}
                                    </span>
                                    <span className="w-[100px] shrink-0 text-right">
                                        {t('Balance')}
                                    </span>
                                    <span className="w-[110px] shrink-0">
                                        {t('Status')}
                                    </span>
                                    <span className="w-[60px] shrink-0" />
                                </div>
                                {students.rows.map((row, position) => (
                                    <Link
                                        key={row.id}
                                        href={student.url(row.id)}
                                        className={`flex h-[52px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 hover:bg-surface ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                    >
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-[14px] leading-[18px] font-medium text-text">
                                                {row.name}
                                            </span>
                                            <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                                {row.matricule}
                                            </span>
                                        </span>
                                        <span className="w-[110px] shrink-0 truncate text-[13px] leading-4 text-text">
                                            {row.class ?? '—'}
                                        </span>
                                        <span className="w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                            {row.state === 'unbilled'
                                                ? '—'
                                                : figure(row.due)}
                                        </span>
                                        <span className="w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 text-success">
                                            {row.state === 'unbilled'
                                                ? '—'
                                                : figure(row.paid)}
                                        </span>
                                        <span
                                            className={`w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 ${row.overdue > 0 ? 'text-danger' : row.balance > 0 ? amberText : 'text-text-muted'}`}
                                        >
                                            {row.state === 'unbilled'
                                                ? '—'
                                                : figure(row.balance)}
                                        </span>
                                        <span className="flex w-[110px] shrink-0">
                                            <StatePill state={row.state} />
                                        </span>
                                        <span className="w-[60px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary">
                                            {t('Open')}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t(':rows of :total shown · most overdue first', {
                                rows: students.rows.length,
                                total: students.total,
                            })}
                        </p>
                        {students.lastPage > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    disabled={students.page <= 1}
                                    onClick={() =>
                                        visit({ page: students.page - 1 })
                                    }
                                    className="flex h-7 items-center rounded-md px-3 text-[13px] text-text hover:bg-surface disabled:opacity-40"
                                >
                                    {t('← Previous')}
                                </button>
                                <span className="px-1 font-mono text-[12px] text-text-muted">
                                    {students.page} / {students.lastPage}
                                </span>
                                <button
                                    type="button"
                                    disabled={
                                        students.page >= students.lastPage
                                    }
                                    onClick={() =>
                                        visit({ page: students.page + 1 })
                                    }
                                    className="flex h-7 items-center rounded-md px-3 text-[13px] text-text hover:bg-surface disabled:opacity-40"
                                >
                                    {t('Next →')}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(Fees);
