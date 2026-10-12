import type { ReactNode } from 'react';
import { index as staffIndex } from '@/actions/App/Http/Controllers/StaffController';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';

export const GENDER_LABELS: Record<string, string> = {
    female: 'Female',
    male: 'Male',
};

export const EMPLOYMENT_LABELS: Record<string, string> = {
    school_paid: 'School-paid',
    government: 'Government employee',
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const WEEKDAY_NAMES = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday',
];

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
];

export const sectionLabelClass =
    'text-[12px] leading-[1.35] font-semibold tracking-[0.06em] text-text-muted uppercase';

export const fieldLabelClass =
    'text-[12px] leading-[1.35] font-medium text-text-muted';

export const textInputClass =
    'h-[44px] w-full rounded-md border border-solid border-border bg-white px-3 text-[14px] text-text outline-none focus:border-primary';

export const primaryButtonClass =
    'flex h-9 items-center justify-center rounded-md bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50';

export const quietLinkClass =
    'flex h-9 items-center rounded-md px-[14px] text-[14px] font-medium text-primary hover:underline';

export function choiceClass(selected: boolean): string {
    return `flex h-9 items-center rounded-md border border-solid px-4 text-[13px] ${
        selected
            ? 'border-primary bg-primary-tint font-semibold text-primary'
            : 'border-border bg-white font-medium text-text hover:bg-surface'
    }`;
}

/** "02 September 2025", or without the year. */
export function longDate(iso: string | null, withYear = true): string {
    if (!iso) {
        return '—';
    }

    const [year, month, day] = iso.split('-');

    return `${day} ${MONTHS[Number(month) - 1]}${withYear ? ` ${year}` : ''}`;
}

export interface Pronouns {
    subject: string;
    possessive: string;
    object: string;
    has: string;
    does: string;
    sits: string;
    sees: string;
}

/** The designs speak of "she"; a registered gender overrides that. */
export function pronounsFor(gender: string | null | undefined): Pronouns {
    if (gender === 'male') {
        return {
            subject: 'he', possessive: 'his', object: 'him',
            has: 'has', does: 'does', sits: 'sits', sees: 'sees',
        };
    }

    if (gender === 'female') {
        return {
            subject: 'she', possessive: 'her', object: 'her',
            has: 'has', does: 'does', sits: 'sits', sees: 'sees',
        };
    }

    return {
        subject: 'they', possessive: 'their', object: 'them',
        has: 'have', does: 'do', sits: 'sit', sees: 'see',
    };
}

export function capitalise(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function PageHeader({
    crumb,
    parents = [],
    title,
    tag,
    meta,
}: {
    /** The page you are on. */
    crumb: string;
    /** Steps between Teachers & Staff and this page. */
    parents?: Crumb[];
    title: string;
    tag: string;
    meta?: string;
}) {
    return (
        <div className="flex flex-col gap-[6px]">
            <Breadcrumbs
                trail={[
                    { label: 'Teachers & Staff', href: staffIndex.url() },
                    ...parents,
                    { label: crumb },
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
    );
}

const FLOW_STEPS = ['Staff details', 'Portal access', 'Set password'];

export function FlowSteps({
    active,
    compact = false,
}: {
    active: number;
    compact?: boolean;
}) {
    return (
        <ol className="flex shrink-0 flex-wrap items-center gap-3">
            {FLOW_STEPS.map((step, index) => {
                const done = index < active;
                const current = index === active;

                return (
                    <li key={step} className="flex items-center gap-3">
                        {index > 0 && (
                            <span
                                className={`h-px shrink-0 ${compact ? 'w-8' : 'w-12'} ${
                                    index <= active
                                        ? 'bg-primary opacity-[0.32]'
                                        : 'bg-border'
                                }`}
                            />
                        )}
                        <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] leading-4 ${
                                done
                                    ? 'bg-primary'
                                    : current
                                      ? 'bg-primary-tint font-bold text-primary'
                                      : 'border border-solid border-border bg-surface font-semibold text-text-muted'
                            }`}
                        >
                            {done ? (
                                <svg width="12" height="12" viewBox="0 0 12 12">
                                    <path
                                        d="M2.6 6.2 4.9 8.5 9.4 3.9"
                                        fill="none"
                                        stroke="#fff"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            ) : (
                                index + 1
                            )}
                        </span>
                        <span
                            className={`text-[13px] leading-4 whitespace-nowrap ${
                                done || current
                                    ? 'font-semibold text-text'
                                    : 'font-medium text-text-muted'
                            }`}
                        >
                            {step}
                        </span>
                    </li>
                );
            })}
            <li className="ml-auto text-[12px] leading-4 font-medium text-text-muted">
                Step {active + 1} of {FLOW_STEPS.length}
            </li>
        </ol>
    );
}

export function Avatar({
    initials,
    photoUrl,
    size,
    bordered = false,
}: {
    initials: string;
    photoUrl?: string | null;
    size: number;
    bordered?: boolean;
}) {
    return (
        <span
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-tint font-display font-bold text-primary ${
                bordered ? 'border border-solid border-border' : ''
            }`}
            style={{
                width: size,
                height: size,
                fontSize: size >= 56 ? 20 : 13,
            }}
        >
            {photoUrl ? (
                <img
                    src={photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                />
            ) : (
                initials || '··'
            )}
        </span>
    );
}

export function StatusDot({ tone }: { tone: 'success' | 'warning' }) {
    return (
        <span
            className={`h-[6px] w-[6px] shrink-0 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
        />
    );
}

export function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }

    return (
        <span role="alert" className="text-[12px] leading-4 text-danger">
            {message}
        </span>
    );
}

/** Two columns: the work on the left, guidance and actions on the right. */
export function SplitLayout({
    children,
    aside,
}: {
    children: ReactNode;
    aside: ReactNode;
}) {
    return (
        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
            <aside className="flex shrink-0 flex-col gap-6 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                {aside}
            </aside>
        </div>
    );
}

export function Note({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 rounded-md bg-surface p-4">
            <p className="text-[13px] leading-[1.35] font-semibold text-text">
                {title}
            </p>
            <p className="text-[13px] leading-[1.5] text-text">{children}</p>
        </div>
    );
}
