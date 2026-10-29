import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    index,
    progress,
    results,
} from '@/actions/App/Http/Controllers/AssessmentController';
import { index as corrections } from '@/actions/App/Http/Controllers/CorrectionController';
import { show as schedule } from '@/actions/App/Http/Controllers/ExamScheduleController';
import { show as grading } from '@/actions/App/Http/Controllers/GradingController';
import {
    reports,
    term,
} from '@/actions/App/Http/Controllers/TermResultController';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';
import { ordinalOf, t } from '../../lib/i18n';

export interface AssessmentTabs {
    missing: number;
    clashes: number;
    pending: number;
}

export interface PlanSummary {
    id: string;
    name: string;
    kind: 'sequence' | 'exam';
    state: PlanState;
    term: string | null;
    held_from: string | null;
    held_until: string | null;
    window_starts_on: string | null;
    window_ends_on: string | null;
    days_left: number | null;
    has_schedule: boolean;
    closed_on: string | null;
    published_on: string | null;
}

export type PlanState =
    | 'draft'
    | 'scheduled'
    | 'marks_open'
    | 'marks_closed'
    | 'published';

export type TabKey =
    | 'calendar'
    | 'schedule'
    | 'progress'
    | 'results'
    | 'term'
    | 'reports'
    | 'corrections'
    | 'grading';

export const amberText = 'text-[#8A5A12]';

export const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

export const primaryClass =
    'flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40';

export const quietClass =
    'flex h-9 items-center justify-center gap-2 rounded-md border border-solid border-border bg-white px-4 text-[13px] leading-4 font-medium text-text hover:bg-surface disabled:opacity-40';

export const STATE_LABELS: Record<PlanState, string> = {
    draft: 'Draft',
    scheduled: 'Scheduled',
    marks_open: 'Marks open',
    marks_closed: 'Marks closed',
    published: 'Published',
};

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

/** "8 Oct". */
export function day(iso: string | null): string {
    if (!iso) {
        return 'not set';
    }

    const [, month, date] = iso.split('-');

    return `${Number(date)} ${t(MONTHS[Number(month) - 1])}`;
}

/** "15 – 26 Sep", or "28 Sep – 3 Oct" across months. */
export function range(from: string | null, to: string | null): string {
    if (!from || !to) {
        return t('Not set');
    }

    return from.slice(0, 7) === to.slice(0, 7)
        ? `${Number(from.slice(8))} – ${day(to)}`
        : `${day(from)} – ${day(to)}`;
}

/** A mark or average to two places, or a dash. */
export function score(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : value.toFixed(2);
}

export function ordinal(position: number): string {
    return ordinalOf(position);
}

export function KindChip({ kind }: { kind: string }) {
    return (
        <span
            className={`flex h-5 shrink-0 items-center rounded-sm px-[6px] font-mono text-[11px] leading-[14px] font-medium tracking-[0.04em] uppercase ${
                kind === 'exam'
                    ? 'bg-arts-tint text-arts'
                    : 'bg-science-tint text-science'
            }`}
        >
            {kind}
        </span>
    );
}

function Badge({
    tone,
    children,
}: {
    tone: 'amber' | 'green';
    children: ReactNode;
}) {
    return (
        <span
            className={`flex h-[18px] items-center rounded-full px-[6px] font-mono text-[11px] leading-[14px] ${
                tone === 'green'
                    ? 'bg-success-tint text-success'
                    : `bg-warning-tint ${amberText}`
            }`}
        >
            {children}
        </span>
    );
}

export function AssessmentHeader({
    active,
    tabs,
    trail = [],
    title,
    meta,
    action,
}: {
    active: TabKey;
    tabs: AssessmentTabs;
    /** Steps after Sequences & Exams; the last one is this page. */
    trail?: Crumb[];
    title: string;
    meta?: ReactNode;
    action?: ReactNode;
}) {
    const items: {
        key: TabKey;
        label: string;
        href: string;
        badge?: ReactNode;
    }[] = [
        { key: 'calendar', label: t('Calendar'), href: index.url() },
        {
            key: 'schedule',
            label: t('Exam schedule'),
            href: schedule.url(),
            badge:
                tabs.clashes > 0 ? (
                    <Badge tone="amber">
                        {tabs.clashes}{' '}
                        {tabs.clashes === 1 ? t('clash') : t('clashes')}
                    </Badge>
                ) : null,
        },
        {
            key: 'progress',
            label: t('Marks progress'),
            href: progress.url(),
            badge:
                tabs.missing > 0 ? (
                    <Badge tone="amber">
                        {t(':missing missing', { missing: tabs.missing })}
                    </Badge>
                ) : null,
        },
        { key: 'results', label: t('Results'), href: results.url() },
        { key: 'term', label: t('Term & year'), href: term.url() },
        { key: 'reports', label: t('Report cards'), href: reports.url() },
        {
            key: 'corrections',
            label: t('Corrections'),
            href: corrections.url(),
            badge:
                tabs.pending > 0 ? (
                    <Badge tone="amber">
                        {t(':pending pending', { pending: tabs.pending })}
                    </Badge>
                ) : null,
        },
        { key: 'grading', label: t('Grading'), href: grading.url() },
    ];

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <Breadcrumbs
                        trail={
                            trail.length > 0
                                ? [
                                      {
                                          label: t('Sequences & Exams'),
                                          href: index.url(),
                                      },
                                      ...trail,
                                  ]
                                : [{ label: t('Sequences & Exams') }]
                        }
                    />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {title}
                    </h1>
                    {meta && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-4 text-text-muted">
                            {meta}
                        </div>
                    )}
                </div>
                {action && <div className="flex flex-wrap gap-2">{action}</div>}
            </div>
            <nav
                aria-label={t('Sequences and exams')}
                className="flex flex-wrap gap-x-[26px] border-b border-solid border-border"
            >
                {items.map((item) => (
                    <Link
                        key={item.key}
                        href={item.href}
                        aria-current={item.key === active ? 'page' : undefined}
                        className={`-mb-px flex items-center gap-2 border-b-2 border-solid pb-[10px] text-[14px] leading-[18px] ${
                            item.key === active
                                ? 'border-primary font-semibold text-text'
                                : 'border-transparent font-medium text-text-muted hover:text-text'
                        }`}
                    >
                        {t(item.label)}
                        {item.badge}
                    </Link>
                ))}
            </nav>
        </>
    );
}

/** Pills to choose which assessment a screen is about. */
export function PlanPicker({
    plans,
    current,
    href,
    label = 'Assessment',
}: {
    plans: PlanSummary[];
    current: string | null;
    href: (id: string) => string;
    label?: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                {label}
            </span>
            {plans.map((plan) => (
                <Link
                    key={plan.id}
                    href={href(plan.id)}
                    aria-current={plan.id === current ? 'true' : undefined}
                    className={`flex h-[30px] items-center gap-[6px] rounded-full border border-solid px-3 text-[13px] leading-4 ${
                        plan.id === current
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-border font-medium text-text hover:bg-surface'
                    }`}
                >
                    {plan.state === 'marks_open' && (
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                    )}
                    {plan.name}
                </Link>
            ))}
        </div>
    );
}

export function Empty({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                {title}
            </p>
            <div className="max-w-[640px] text-[13px] leading-[19px] text-text">
                {children}
            </div>
        </div>
    );
}
