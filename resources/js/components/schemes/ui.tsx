import SharedPageHeader from '../shell/page-header';
import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { closing } from '@/actions/App/Http/Controllers/SchemeClosingController';
import { index } from '@/actions/App/Http/Controllers/SchemeController';
import { opening } from '@/actions/App/Http/Controllers/SchemeOpeningController';
import { show as syllabus } from '@/actions/App/Http/Controllers/SyllabusController';
import { index as levelsIndex } from '@/actions/App/Http/Controllers/StructureController';
import { type Crumb } from '../shell/breadcrumbs';
import { dayMonth } from '../fees/ui';
import { t } from '../../lib/i18n';

export interface Steps {
    term: {
        id: string;
        label: string;
        week: number | null;
        weeks: number;
        ends_on: string;
    } | null;
    syllabus: boolean;
    opened: boolean;
    to_approve: number;
    closed: boolean;
}

export interface Week {
    week: number;
    starts_on: string;
    ends_on: string;
    /** The tests or exam held that week, which keeps it free of new topics. */
    free: string | null;
}

export interface Item {
    id: string;
    topic: string;
    name: string | null;
    week: number | null;
    periods: number;
    from_syllabus: boolean;
    added: boolean;
    carried: boolean;
    taught_on: string | null;
}

export const schemesCrumb: Crumb = {
    label: 'Schemes of work',
    href: index.url(),
};

/** "1 – 5 Sep", the days a week of the term covers. */
export function weekDates(week: Week): string {
    const [, startMonth] = week.starts_on.split('-');
    const [, endMonth, endDay] = week.ends_on.split('-');

    return startMonth === endMonth
        ? `${Number(week.starts_on.split('-')[2])} – ${Number(endDay)} ${dayMonth(week.ends_on, false).split(' ')[1]}`
        : `${dayMonth(week.starts_on, false)} – ${dayMonth(week.ends_on, false)}`;
}

/** The sub-topic's own name, or the topic when it has no parts. */
export function itemLabel(item: Pick<Item, 'topic' | 'name'>): string {
    return item.name ?? item.topic;
}

export function SchemesHeader({
    trail,
    title,
    tag,
    meta,
    badge,
    sub,
    action,
}: {
    /** Steps after Schemes of work; the last is the page you are on. */
    trail?: Crumb[];
    title: string;
    /** The mono line under the title, e.g. "Schemes · Term 1", as on the other Classes & Subjects tabs. */
    tag: string;
    /** Short facts after the tag. */
    meta?: string;
    /** A status shown before the tag. */
    badge?: ReactNode;
    /** A sentence explaining the page, under the tag line. */
    sub?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <SharedPageHeader
            root={{ label: t('Classes & Subjects'), href: levelsIndex.url() }}
            trail={[schemesCrumb, ...(trail ?? [])]}
            title={title}
            tag={tag}
            meta={meta}
            badge={badge}
            sub={sub}
            action={action}
        />
    );
}

type StepKey = 'syllabus' | 'open' | 'review' | 'progress' | 'close';

/**
 * The five steps, with the ones done ticked and the page you are on
 * filled in. Every step is a link once there is something behind it.
 */
export function StepBar({
    steps,
    active,
    reviewHref,
}: {
    steps: Steps;
    active: StepKey;
    reviewHref?: string;
}) {
    const items: {
        key: StepKey;
        label: string;
        done: boolean;
        href?: string;
        badge?: string;
    }[] = [
        {
            key: 'syllabus',
            label: t('Syllabus'),
            done: steps.syllabus,
            href: syllabus.url(),
        },
        {
            key: 'open',
            label: t('Open schemes'),
            done: steps.opened,
            href: opening.url(),
        },
        {
            key: 'review',
            label: t('Review'),
            done: steps.opened && steps.to_approve === 0,
            href: steps.opened
                ? (reviewHref ?? index.url({ query: { state: 'to_approve' } }))
                : undefined,
            badge:
                steps.to_approve > 0
                    ? t(':count to approve', { count: steps.to_approve })
                    : undefined,
        },
        {
            key: 'progress',
            label: t('Follow progress'),
            done: steps.closed,
            href: steps.opened ? index.url() : undefined,
        },
        {
            key: 'close',
            label: t('Close the term'),
            done: steps.closed,
            href: steps.opened ? closing.url() : undefined,
        },
    ];

    return (
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-solid border-border pb-4">
            {items.map((item, position) => {
                const current = item.key === active;
                const circle = current
                    ? 'bg-primary text-white'
                    : item.done
                      ? 'bg-success text-white'
                      : item.badge
                        ? 'bg-warning text-white'
                        : 'border border-solid border-border text-text-muted';
                const body = (
                    <>
                        <span
                            className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${circle}`}
                        >
                            {item.done && !current ? (
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                                </svg>
                            ) : (
                                position + 1
                            )}
                        </span>
                        <span
                            className={`text-[13px] leading-4 ${current ? 'font-semibold text-text' : 'text-text-muted'}`}
                        >
                            {item.label}
                        </span>
                        {item.badge && (
                            <span className="rounded-full bg-warning-tint px-2 py-[2px] font-mono text-[11px] text-warning-text">
                                {item.badge}
                            </span>
                        )}
                    </>
                );

                return (
                    <li key={item.key} className="flex items-center gap-3">
                        {item.href && !current ? (
                            <Link
                                href={item.href}
                                className="flex items-center gap-2 hover:underline"
                            >
                                {body}
                            </Link>
                        ) : (
                            <span
                                aria-current={current ? 'step' : undefined}
                                className="flex items-center gap-2"
                            >
                                {body}
                            </span>
                        )}
                        {position < items.length - 1 && (
                            <span aria-hidden className="h-px w-6 bg-border" />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * The term at a glance for the progress page: where the term is, week
 * by week, and the five steps as a quiet line of links.
 */
export function TermStrip({ steps }: { steps: Steps }) {
    const week = steps.term?.week ?? 0;
    const weeks = steps.term?.weeks ?? 0;
    const items = [
        { label: t('Syllabus'), done: steps.syllabus, href: syllabus.url() },
        { label: t('Open'), done: steps.opened, href: opening.url() },
        {
            label: t('Review'),
            done: steps.opened && steps.to_approve === 0,
            href: index.url({ query: { state: 'to_approve' } }),
        },
        {
            label: t('Follow progress'),
            done: false,
            current: true,
            href: index.url(),
        },
        { label: t('Close term'), done: steps.closed, href: closing.url() },
    ];

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-solid border-border pb-5">
            {steps.term && (
                <div className="flex flex-wrap items-center gap-x-[14px] gap-y-2">
                    <span className="font-mono text-[12px] leading-4 tracking-[0.04em] text-text-muted uppercase">
                        {t('Week')}{' '}
                        <span className="text-[13px] text-text">{week}</span>{' '}
                        {t('of :weeks', { weeks })}
                    </span>
                    <span className="flex items-center gap-[3px]" aria-hidden>
                        {Array.from({ length: weeks }, (_, index) => (
                            <span
                                key={index}
                                className={`w-[14px] rounded-[3px] sm:w-[22px] ${
                                    index + 1 <= week
                                        ? 'bg-primary'
                                        : 'bg-border'
                                } ${index + 1 === week ? 'h-[10px]' : 'h-[6px]'}`}
                            />
                        ))}
                    </span>
                    <span className="text-[13px] leading-4 text-text-muted">
                        {t('ends :date', {
                            date: dayMonth(steps.term.ends_on, false),
                        })}
                    </span>
                </div>
            )}
            <nav
                aria-label={t('Steps')}
                className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13px] leading-4"
            >
                {items.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        aria-current={item.current ? 'step' : undefined}
                        className={`flex items-center gap-[6px] hover:text-text ${
                            item.current
                                ? 'font-semibold text-text'
                                : 'text-text-muted'
                        }`}
                    >
                        {item.current ? (
                            <span className="h-[7px] w-[7px] rounded-full bg-primary" />
                        ) : (
                            item.done && (
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--color-success)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                >
                                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                                </svg>
                            )
                        )}
                        {item.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}

export const STATES: Record<
    string,
    { label: string; dot: string; text: string }
> = {
    on_track: { label: 'On track', dot: 'bg-success', text: 'text-success' },
    behind: { label: 'Behind', dot: 'bg-warning', text: 'text-warning-text' },
    to_approve: {
        label: 'To approve',
        dot: 'bg-science',
        text: 'text-science',
    },
    sent_back: {
        label: 'Sent back',
        dot: 'bg-warning',
        text: 'text-warning-text',
    },
    not_submitted: {
        label: 'Not submitted',
        dot: 'bg-danger',
        text: 'text-danger',
    },
    waiting: {
        label: 'No teacher yet',
        dot: 'bg-text-muted',
        text: 'text-text-muted',
    },
    closed: { label: 'Closed', dot: 'bg-text-muted', text: 'text-text-muted' },
};

export function StateLabel({ state }: { state: string }) {
    const style = STATES[state] ?? STATES.waiting;

    return (
        <span
            className={`flex items-center gap-[6px] text-[13px] leading-4 ${style.text}`}
        >
            <span
                className={`h-[7px] w-[7px] shrink-0 rounded-full ${style.dot}`}
            />
            {t(style.label)}
        </span>
    );
}

export const STATUSES: Record<string, { label: string; pill: string }> = {
    not_started: { label: 'Not started', pill: 'bg-danger-tint text-danger' },
    draft: { label: 'Draft', pill: 'bg-warning-tint text-warning-text' },
    submitted: {
        label: 'Waiting for approval',
        pill: 'bg-science-tint text-science',
    },
    changes_requested: {
        label: 'Changes asked for',
        pill: 'bg-warning-tint text-warning-text',
    },
    approved: { label: 'Approved', pill: 'bg-success-tint text-success' },
    closed: { label: 'Closed', pill: 'bg-surface text-text-muted' },
};

export function StatusPill({ status }: { status: string }) {
    const style = STATUSES[status] ?? STATUSES.draft;

    return (
        <span
            className={`flex h-6 w-fit shrink-0 items-center rounded-full px-[10px] text-[12px] leading-4 font-medium ${style.pill}`}
        >
            {t(style.label)}
        </span>
    );
}

export const STATUS_DOTS: Record<string, string> = {
    not_started: 'bg-danger',
    draft: 'bg-warning',
    submitted: 'bg-science',
    changes_requested: 'bg-warning',
    approved: 'bg-success',
    closed: 'bg-text-muted',
};
