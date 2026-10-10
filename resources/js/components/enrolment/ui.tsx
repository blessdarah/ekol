import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { index as applications } from '@/actions/App/Http/Controllers/ApplicationController';
import {
    confirm,
    index,
    placement,
    reEnrolment,
} from '@/actions/App/Http/Controllers/EnrolmentController';
import { capsLabelClass } from '../structure/ui';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';

/** Where enrolment stands; every enrolment page receives it. */
export interface EnrolmentProgress {
    year: string;
    confirmed: boolean;
    ready: boolean;
    to_review: number;
    undecided: number;
    unplaced: number;
    expected: number;
    classes: number;
    over_levels: string[];
    over_classes: number;
    has_fee_plan: boolean;
}

export type EnrolmentTab = 'overview' | 'applications' | 're-enrolment' | 'placement' | 'confirm';

export const amberText = 'text-[#8A5A12]';

export const linkClass = 'text-[13px] leading-4 font-medium text-primary hover:underline';

export const nextStepClass =
    'flex h-[34px] items-center rounded-md border border-solid border-primary bg-white px-4 text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint';

export function count(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

/** "Form 2", "Form 2 and Form 4", "Form 1, Form 2 and Form 4". */
export function listed(names: string[]): string {
    if (names.length <= 1) {
        return names.join('');
    }

    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export const STAGES: Record<string, { label: string; pill: string; dot?: string }> = {
    to_review: { label: 'To review', pill: `bg-warning-tint ${amberText}`, dot: 'bg-warning' },
    documents: { label: 'Needs documents', pill: `bg-warning-tint ${amberText}`, dot: 'bg-warning' },
    admitted: { label: 'Admitted', pill: 'bg-success-tint text-success', dot: 'bg-success' },
    waitlist: { label: 'Waitlist', pill: 'border border-solid border-border bg-surface text-text' },
    declined: { label: 'Declined', pill: 'border border-solid border-border bg-surface text-text' },
};

export function StagePill({ stage, small = false }: { stage: string; small?: boolean }) {
    const style = STAGES[stage] ?? STAGES.to_review;

    return (
        <span
            className={`flex shrink-0 items-center gap-[6px] rounded-full text-[12px] leading-4 font-medium ${
                small ? 'h-[22px] px-2' : 'h-6 px-[10px]'
            } ${style.pill}`}
        >
            {style.dot && <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${style.dot}`} />}
            {style.label}
        </span>
    );
}

function TabBadge({ tone, children }: { tone: 'todo' | 'quiet' | 'done'; children: ReactNode }) {
    const tones = {
        todo: `bg-warning-tint ${amberText}`,
        quiet: 'bg-surface text-text-muted',
        done: 'bg-success-tint text-success',
    };

    return (
        <span className={`flex h-[18px] items-center rounded-full px-[6px] font-mono text-[11px] leading-[14px] ${tones[tone]}`}>
            {children}
        </span>
    );
}

export function EnrolmentTabs({ active, progress }: { active: EnrolmentTab; progress: EnrolmentProgress }) {
    const done = progress.confirmed || progress.ready;
    const badge = (left: number, label: string = count(left)) =>
        left > 0 ? <TabBadge tone="todo">{label}</TabBadge> : done ? <TabBadge tone="done">done</TabBadge> : null;

    const tabs: { key: EnrolmentTab; label: string; href: string; badge?: ReactNode; locked?: boolean }[] = [
        { key: 'overview', label: 'Overview', href: index.url() },
        { key: 'applications', label: 'Applications', href: applications.url(), badge: badge(progress.to_review) },
        { key: 're-enrolment', label: 'Re-enrolment', href: reEnrolment.url(), badge: badge(progress.undecided) },
        {
            key: 'placement',
            label: 'Class placement',
            href: placement.url(),
            badge:
                progress.unplaced > 0 ? (
                    <TabBadge tone="quiet">{count(progress.unplaced)} left</TabBadge>
                ) : (
                    badge(0)
                ),
        },
        { key: 'confirm', label: 'Confirm', href: confirm.url(), locked: !done },
    ];

    return (
        <nav aria-label="Enrolment steps" className="flex flex-wrap gap-x-7 border-b border-solid border-border">
            {tabs.map((tab) => (
                <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={tab.key === active ? 'page' : undefined}
                    className={`-mb-px flex items-center gap-2 border-b-2 border-solid pb-[10px] text-[14px] leading-[18px] ${
                        tab.key === active
                            ? 'border-primary font-semibold text-text'
                            : `border-transparent font-medium text-text-muted hover:text-text ${tab.locked ? 'opacity-60' : ''}`
                    }`}
                >
                    {tab.label}
                    {tab.badge}
                </Link>
            ))}
        </nav>
    );
}

export function EnrolmentHeader({
    active,
    progress,
    trail = [],
    title,
    meta,
    status,
    action,
}: {
    active: EnrolmentTab;
    progress: EnrolmentProgress;
    /** Steps after Enrolment; the last one is the page you are on. */
    trail?: Crumb[];
    title: string;
    meta?: string;
    /** Replaces the "ENROLMENT · year" tag, for pages about one record. */
    status?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <Breadcrumbs
                        trail={
                            trail.length > 0
                                ? [{ label: 'Enrolment', href: index.url() }, ...trail]
                                : [{ label: 'Enrolment' }]
                        }
                    />
                    <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                        {title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-4 text-text-muted">
                        {status ?? <span className="font-mono uppercase">Enrolment · {progress.year}</span>}
                        {meta && <span>· {meta}</span>}
                    </div>
                </div>
                {action}
            </div>
            <EnrolmentTabs active={active} progress={progress} />
        </>
    );
}

/** A bar of how full something is; red and solid when it is over. */
export function FillBar({
    value,
    max,
    height = 6,
    track = 'bg-border',
    tone,
}: {
    value: number;
    max: number;
    height?: number;
    track?: string;
    tone?: string;
}) {
    const over = value > max;
    const share = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

    return (
        <span className={`flex shrink-0 rounded-full ${over ? 'bg-danger' : track}`} style={{ height }}>
            {!over && (
                <span
                    className={`rounded-full ${tone ?? 'bg-primary'}`}
                    style={{ height, width: `${share}%` }}
                />
            )}
        </span>
    );
}

export function CheckLine({ done, children }: { done: boolean; children: ReactNode }) {
    return (
        <li className="flex items-center gap-2 text-[13px] leading-4 text-text">
            <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${done ? 'bg-success' : 'bg-warning'}`} />
            <span>{children}</span>
        </li>
    );
}

/** A labelled section of bordered rows, as on the review and confirm pages. */
export function RowSection({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <p className={capsLabelClass}>{label}</p>
            <div className="flex flex-col border-b border-solid border-border">{children}</div>
        </section>
    );
}

export function NoYear({ currentLabel, setupHref }: { currentLabel: string | null; setupHref: string }) {
    return (
        <div className="flex flex-col gap-3 rounded-md bg-surface p-5">
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                There is no next year to enrol for yet
            </p>
            <p className="max-w-[640px] text-[13px] leading-[19px] text-text">
                Enrolment prepares the academic year after
                {currentLabel ? ` ${currentLabel}` : ' the current one'}: new
                applications, who is promoted or repeats, and which class each
                student sits in. Add that year in School Setup and it opens here.
            </p>
            <Link href={setupHref} className={linkClass}>
                Open School Setup →
            </Link>
        </div>
    );
}
