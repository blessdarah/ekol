import { Link } from '@inertiajs/react';
import { Fragment, type ReactNode } from 'react';
import { index as changes } from '@/actions/App/Http/Controllers/TimetableChangeController';
import {
    checks,
    generator,
    index,
    publishing,
    setup,
} from '@/actions/App/Http/Controllers/TimetableController';
import { show as review } from '@/actions/App/Http/Controllers/TimetableReviewController';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';
import { numberLocale, t } from '../../lib/i18n';

/** Where the term's timetable stands; every timetable page receives it. */
export interface TimetablePhase {
    term: string;
    draft: number;
    has_draft: boolean;
    live: number | null;
    live_since: string | null;
    setup: boolean;
    checks: boolean;
    generated: boolean;
    reviewed: boolean;
    blocking: number;
    to_fix: number | null;
    current: StepKey;
}

export type StepKey = 'setup' | 'checks' | 'generate' | 'review' | 'publish';

export type TimetablePage = StepKey | 'overview' | 'changes';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const amberText = 'text-[#8A5A12]';

export const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

export const primaryActionClass =
    'flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40';

export const quietActionClass =
    'flex h-9 items-center justify-center gap-2 rounded-md border border-solid border-border bg-white px-4 text-[13px] leading-4 font-medium text-text hover:bg-surface disabled:opacity-40';

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${new Intl.NumberFormat(numberLocale()).format(count)} ${count === 1 ? t(one) : t(many)}`;
}

export function CheckMark({
    size = 12,
    tone = '#FFFFFF',
}: {
    size?: number;
    tone?: string;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className="shrink-0"
        >
            <path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke={tone}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/** A tick box drawn the way the designs draw it. */
export function TickBox({
    checked,
    disabled = false,
    onChange,
    children,
}: {
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
    children: ReactNode;
}) {
    return (
        <label
            className={`flex items-start gap-[10px] text-[13px] leading-[18px] text-text ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
        >
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                className="peer sr-only"
            />
            <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-solid peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary ${
                    checked
                        ? 'border-primary bg-primary-tint'
                        : 'border-border bg-white'
                }`}
            >
                {checked && <CheckMark tone="#0E4D3A" />}
            </span>
            <span>{children}</span>
        </label>
    );
}

function PhaseBar({
    page,
    phase,
}: {
    page: TimetablePage;
    phase: TimetablePhase;
}) {
    const allDone = !phase.has_draft && phase.live !== null;
    const steps: {
        key: StepKey;
        label: string;
        href: string;
        done: boolean;
        badge?: ReactNode;
    }[] = [
        {
            key: 'setup',
            label: t('Setup'),
            href: setup.url(),
            done: phase.setup,
        },
        {
            key: 'checks',
            label: t('Check inputs'),
            href: checks.url(),
            done: phase.checks,
            badge:
                page === 'checks' && phase.blocking > 0 ? (
                    <span className="flex h-[18px] items-center rounded-full bg-danger-tint px-[6px] font-mono text-[11px] leading-[14px] text-danger">
                        {t(':blocking to fix', { blocking: phase.blocking })}
                    </span>
                ) : null,
        },
        {
            key: 'generate',
            label: t('Generate'),
            href: generator.url(),
            done: phase.generated,
        },
        {
            key: 'review',
            label: t('Review'),
            href: review.url(),
            done: phase.reviewed,
            badge:
                phase.to_fix !== null && phase.to_fix > 0 ? (
                    <span
                        className={`flex h-[18px] items-center rounded-full bg-warning-tint px-[6px] font-mono text-[11px] leading-[14px] ${amberText}`}
                    >
                        {t(':to_fix to fix', { to_fix: phase.to_fix })}
                    </span>
                ) : null,
        },
        {
            key: 'publish',
            label: t('Publish'),
            href: phase.has_draft ? publishing.url() : index.url(),
            done: false,
        },
    ];

    return (
        <nav
            aria-label={t('Timetable phases')}
            className="flex flex-wrap items-center gap-x-[10px] gap-y-2 border-b border-solid border-border pb-[14px]"
        >
            <Link
                href={index.url()}
                aria-current={page === 'overview' ? 'page' : undefined}
                className={`flex h-[30px] items-center rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                    page === 'overview'
                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                        : 'border-border font-medium text-text hover:bg-surface'
                }`}
            >
                {t('Overview')}
            </Link>
            <span className="mx-[6px] h-[22px] w-px shrink-0 bg-border" />
            {steps.map((step, position) => {
                const done = step.done || allDone;
                const active = page === step.key;
                const waiting =
                    !done &&
                    !active &&
                    phase.current === step.key &&
                    page === 'overview';

                return (
                    <Fragment key={step.key}>
                        {position > 0 && (
                            <span
                                className={`h-px w-6 shrink-0 ${steps[position - 1].done || allDone ? 'bg-success' : 'bg-border'}`}
                            />
                        )}
                        <Link
                            href={step.href}
                            aria-current={active ? 'step' : undefined}
                            className="flex items-center gap-2 rounded-sm hover:opacity-80"
                        >
                            <span
                                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] leading-4 ${
                                    active
                                        ? 'bg-primary font-semibold text-white'
                                        : done
                                          ? 'bg-success'
                                          : waiting
                                            ? 'bg-warning font-semibold text-white'
                                            : 'border border-solid border-border text-text-muted'
                                }`}
                            >
                                {done && !active ? <CheckMark /> : position + 1}
                            </span>
                            <span
                                className={`text-[13px] leading-4 ${
                                    active
                                        ? 'font-semibold text-primary'
                                        : done
                                          ? 'font-medium text-text'
                                          : waiting
                                            ? `font-semibold ${amberText}`
                                            : 'font-medium text-text-muted'
                                }`}
                            >
                                {t(step.label)}
                            </span>
                            {step.badge}
                        </Link>
                    </Fragment>
                );
            })}
            <span className="flex-1" />
            <span className="text-[12px] leading-4 text-text-muted">
                {t('After publishing')}
            </span>
            <Link
                href={changes.url()}
                aria-current={page === 'changes' ? 'page' : undefined}
                className={`flex h-[30px] items-center rounded-full border px-[14px] text-[13px] leading-4 ${
                    page === 'changes'
                        ? 'border-solid border-primary bg-primary-tint font-semibold text-primary'
                        : 'border-dashed border-border font-medium text-text-muted hover:text-text'
                }`}
            >
                {t('Changes')}
            </Link>
        </nav>
    );
}

export function TimetableHeader({
    page,
    phase,
    trail = [],
    title,
    meta,
    action,
}: {
    page: TimetablePage;
    phase: TimetablePhase;
    /** Steps after Timetable; the last one is the page you are on. */
    trail?: Crumb[];
    title: string;
    meta: ReactNode;
    action?: ReactNode;
}) {
    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <Breadcrumbs
                        trail={
                            trail.length > 0
                                ? [
                                      {
                                          label: t('Timetable'),
                                          href: index.url(),
                                      },
                                      ...trail,
                                  ]
                                : [{ label: t('Timetable') }]
                        }
                    />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {title}
                    </h1>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {meta}
                    </p>
                </div>
                {action && <div className="flex flex-wrap gap-2">{action}</div>}
            </div>
            <PhaseBar page={page} phase={phase} />
        </>
    );
}

export function NoTerm({ setupHref }: { setupHref: string }) {
    return (
        <div className="flex flex-col gap-3 rounded-md bg-surface p-5">
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                {t('No term is active')}
            </p>
            <p className="max-w-[640px] text-[13px] leading-[19px] text-text">
                {t(
                    'A timetable is built for a term. Make a term active in School Setup and the timetable opens here.',
                )}
            </p>
            <Link href={setupHref} className={linkClass}>
                {t('Open School Setup →')}
            </Link>
        </div>
    );
}
