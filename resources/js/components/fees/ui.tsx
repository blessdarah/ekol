import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { index, structure } from '@/actions/App/Http/Controllers/FeeController';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';

export const amberText = 'text-[#8A5A12]';

export function figure(amount: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "15 Sep 2025", or "15 Sep" without the year. */
export function dayMonth(iso: string | null, withYear = true): string {
    if (!iso) {
        return 'no date';
    }

    const [year, month, day] = iso.split('-');

    return `${Number(day)} ${MONTHS[Number(month) - 1]}${withYear ? ` ${year}` : ''}`;
}

export const FEE_STATES: Record<string, { label: string; pill: string }> = {
    paid: { label: 'Paid', pill: 'bg-success-tint text-success' },
    overdue: { label: 'Overdue', pill: 'bg-danger-tint text-danger' },
    partial: { label: 'Partial', pill: `bg-warning-tint ${amberText}` },
    owing: { label: 'Owing', pill: `bg-warning-tint ${amberText}` },
    upcoming: { label: 'Upcoming', pill: 'border border-solid border-border bg-surface text-text-muted' },
    unbilled: { label: 'Not billed', pill: 'border border-solid border-border bg-surface text-text-muted' },
};

export function StatePill({ state }: { state: string }) {
    const style = FEE_STATES[state] ?? FEE_STATES.upcoming;

    return (
        <span className={`flex h-6 shrink-0 items-center rounded-full px-[10px] text-[12px] leading-4 font-medium ${style.pill}`}>
            {style.label}
        </span>
    );
}

export function FeesHeader({
    active,
    trail = [],
    title,
    tag,
    meta,
    action,
}: {
    active: 'students' | 'structure';
    /** Steps after Fees; the last one is the page you are on. */
    trail?: Crumb[];
    title: string;
    tag?: string | null;
    meta?: string;
    action?: ReactNode;
}) {
    const tabs = [
        { key: 'students', label: 'Students', href: index.url() },
        { key: 'structure', label: 'Fee structure', href: structure.url() },
    ];

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <Breadcrumbs trail={trail.length > 0 ? [{ label: 'Fees', href: index.url() }, ...trail] : [{ label: 'Fees' }]} />
                    <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                        {title}
                    </h1>
                    {(tag || meta) && (
                        <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-4 text-text-muted">
                            {tag && <span className="font-mono uppercase">{tag}</span>}
                            {meta && <span>{tag ? '· ' : ''}{meta}</span>}
                        </p>
                    )}
                </div>
                {action}
            </div>
            <nav className="flex gap-6 border-b border-solid border-border">
                {tabs.map((tab) => (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        aria-current={tab.key === active ? 'page' : undefined}
                        className={`-mb-px border-b-2 border-solid pb-[10px] text-[14px] leading-[18px] ${
                            tab.key === active
                                ? 'border-primary font-semibold text-text'
                                : 'border-transparent font-medium text-text-muted hover:text-text'
                        }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </nav>
        </>
    );
}
