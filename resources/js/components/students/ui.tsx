import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { studentTab } from '@/actions/App/Http/Controllers/FeeController';
import { show as academicsTab } from '@/actions/App/Http/Controllers/StudentAcademicsController';
import { show as attendanceTab } from '@/actions/App/Http/Controllers/StudentAttendanceController';
import { index, show } from '@/actions/App/Http/Controllers/StudentController';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';
import { numberLocale, t } from '../../lib/i18n';

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
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

/** "6 November 2009". */
export function fullDate(iso: string): string {
    const [year, month, day] = iso.split('-');

    return `${Number(day)} ${t(MONTHS[Number(month) - 1])} ${year}`;
}

/** "15 Sep". */
export function shortDate(iso: string | null): string {
    if (!iso) {
        return 'no date';
    }

    const [, month, day] = iso.split('-');

    return `${Number(day)} ${t(MONTHS[Number(month) - 1]).slice(0, 3)}`;
}

export function money(amount: number, currency?: string): string {
    const figure = new Intl.NumberFormat(numberLocale(), {
        maximumFractionDigits: 0,
    }).format(amount);

    return currency ? `${figure} ${currency}` : figure;
}

const FEE_STYLES: Record<string, { label: string; pill: string; dot: string }> =
    {
        paid: {
            label: 'Paid',
            pill: 'bg-success-tint text-success',
            dot: 'bg-success',
        },
        partial: {
            label: 'Partial',
            pill: 'bg-warning-tint text-[#8A5A12]',
            dot: 'bg-warning',
        },
        due: {
            label: 'Due',
            pill: 'bg-surface text-text-muted',
            dot: 'bg-text-muted',
        },
        overdue: {
            label: 'Overdue',
            pill: 'bg-danger-tint text-danger',
            dot: 'bg-danger',
        },
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
            <span
                className={`h-[6px] w-[6px] shrink-0 rounded-full ${style.dot}`}
            />
            {t(style.label)}
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
                    trail={[
                        { label: t('Students'), href: index.url() },
                        ...trail,
                    ]}
                />
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
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

/** The tabs of one student record. */
export function StudentTabs({
    studentId,
    active,
    overview = true,
}: {
    studentId: string;
    active: 'overview' | 'academics' | 'fees' | 'attendance';
    /** False for roles that handle fees but do not keep student records. */
    overview?: boolean;
}) {
    const tabs = [
        {
            key: 'overview',
            label: t('Overview'),
            href: overview ? show.url(studentId) : null,
            arrives: null,
        },
        {
            key: 'academics',
            label: t('Academics'),
            href: overview ? academicsTab.url(studentId) : null,
            arrives: null,
        },
        {
            key: 'fees',
            label: t('Fees'),
            href: studentTab.url(studentId),
            arrives: null,
        },
        {
            key: 'attendance',
            label: t('Attendance'),
            href: overview ? attendanceTab.url(studentId) : null,
            arrives: null,
        },
    ];

    return (
        <nav
            aria-label={t('Student record')}
            className="flex gap-6 overflow-x-auto border-b border-solid border-border whitespace-nowrap"
        >
            {tabs.map((tab) =>
                tab.key === active ? (
                    <span
                        key={tab.key}
                        aria-current="page"
                        className="-mb-px border-b-2 border-solid border-primary pb-[10px] text-[14px] leading-[18px] font-semibold text-text"
                    >
                        {t(tab.label)}
                    </span>
                ) : tab.href ? (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        className="pb-[10px] text-[14px] leading-[18px] font-medium text-text-muted hover:text-text"
                    >
                        {t(tab.label)}
                    </Link>
                ) : (
                    <span
                        key={tab.key}
                        aria-disabled="true"
                        title={
                            tab.arrives
                                ? t('Arrives with :arrives', {
                                      arrives: tab.arrives,
                                  })
                                : t('Not open to your role')
                        }
                        className="cursor-not-allowed pb-[10px] text-[14px] leading-[18px] font-medium text-text-muted opacity-60"
                    >
                        {t(tab.label)}
                    </span>
                ),
            )}
        </nav>
    );
}
