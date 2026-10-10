import type { ReactNode } from 'react';
import { index } from '@/actions/App/Http/Controllers/StudentController';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';

export const GENDER_LABELS: Record<string, string> = {
    female: 'Girl',
    male: 'Boy',
};

export const RELATION_LABELS: Record<string, string> = {
    father: 'Father',
    mother: 'Mother',
    guardian: 'Guardian',
};

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
];

/** "6 November 2009". */
export function fullDate(iso: string): string {
    const [year, month, day] = iso.split('-');

    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** "15 Sep". */
export function shortDate(iso: string | null): string {
    if (!iso) {
        return 'no date';
    }

    const [, month, day] = iso.split('-');

    return `${Number(day)} ${MONTHS[Number(month) - 1].slice(0, 3)}`;
}

export function money(amount: number, currency?: string): string {
    const figure = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
    }).format(amount);

    return currency ? `${figure} ${currency}` : figure;
}

const FEE_STYLES: Record<string, { label: string; pill: string; dot: string }> = {
    paid: { label: 'Paid', pill: 'bg-success-tint text-success', dot: 'bg-success' },
    partial: { label: 'Partial', pill: 'bg-warning-tint text-[#8A5A12]', dot: 'bg-warning' },
    due: { label: 'Due', pill: 'bg-surface text-text-muted', dot: 'bg-text-muted' },
    overdue: { label: 'Overdue', pill: 'bg-danger-tint text-danger', dot: 'bg-danger' },
};

export function FeePill({ status }: { status: string | null }) {
    const style = status ? FEE_STYLES[status] : undefined;

    if (!style) {
        return <span className="text-[13px] text-text-muted">—</span>;
    }

    return (
        <span
            className={`flex h-6 items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${style.pill}`}
        >
            <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${style.dot}`} />
            {style.label}
        </span>
    );
}

export function StudentHeader({
    trail,
    title,
    tag,
    meta,
    action,
}: {
    /** Steps after Students; the last one is the page you are on. */
    trail: Crumb[];
    title: string;
    tag: string;
    meta?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-[6px]">
                <Breadcrumbs
                    trail={[{ label: 'Students', href: index.url() }, ...trail]}
                />
                <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                    {title}
                </h1>
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-4 text-text-muted">
                    <span className="font-mono uppercase">{tag}</span>
                    {meta && <span>· {meta}</span>}
                </p>
            </div>
            {action}
        </div>
    );
}
