import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { LogoMark } from '../../layouts/auth-layout';
import LanguageSwitch from '../shell/language-switch';
import Toasts from '../shell/toasts';
import { numberLocale, useT } from '../../lib/i18n';

export interface Issuer {
    name: string;
    code: string;
}

export interface ChildCard {
    name: string;
    matricule: string;
    class: string | null;
    year: string | null;
    line: string;
}

/** "25 000 FCFA": amounts parents read are always in whole francs. */
export function francs(amount: number): string {
    return `${new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 0 }).format(amount)} FCFA`;
}

/** Which network a Cameroonian number is on, from its first digits. */
export function operatorOf(phone: string): 'MTN' | 'Orange' | null {
    const digits = localDigits(phone);

    if (!/^6\d{8}$/.test(digits)) {
        return null;
    }

    const prefix = Number(digits.slice(0, 3));

    if (prefix >= 670 && prefix <= 679) {
        return 'MTN';
    }
    if ((prefix >= 680 && prefix <= 684) || (prefix >= 650 && prefix <= 654)) {
        return 'MTN';
    }
    if ((prefix >= 690 && prefix <= 699) || (prefix >= 655 && prefix <= 659)) {
        return 'Orange';
    }

    return null;
}

/** The nine local digits, without spaces or the 237 country code. */
export function localDigits(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    return digits.length === 12 && digits.startsWith('237')
        ? digits.slice(3)
        : digits;
}

/** "6 77 12 34 56", the way numbers are written on receipts. */
export function spacedPhone(phone: string): string {
    const digits = localDigits(phone);

    return digits.length === 9
        ? `${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`
        : phone;
}

export function OperatorBadge({ operator }: { operator: string | null }) {
    if (!operator) {
        return null;
    }

    return (
        <span
            className={`flex h-6 shrink-0 items-center rounded-full px-[10px] text-[12px] leading-4 font-semibold ${
                operator === 'MTN'
                    ? 'bg-mtn text-mtn-ink'
                    : 'bg-orange-money text-white'
            }`}
        >
            {operator === 'MTN' ? 'MTN MoMo' : 'Orange Money'}
        </span>
    );
}

/**
 * The page a parent pays on: the school's name above, one column below,
 * sized for a phone first.
 */
export function PayShell({
    issuer,
    step,
    back,
    children,
}: {
    /** The child's school; without one the page belongs to Campus. */
    issuer?: Issuer | null;
    /** Where the parent is in paying: step one or two. */
    step?: number;
    back?: string;
    children: ReactNode;
}) {
    const t = useT();

    return (
        <div className="flex min-h-screen flex-col bg-bg font-auth text-text antialiased">
            <Toasts />
            <header className="border-b border-border bg-surface">
                <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 px-4 py-3">
                    {issuer ? (
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-[13px] font-extrabold text-white">
                                {initialsOf(issuer.name)}
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate text-[14px] leading-[18px] font-semibold">
                                    {issuer.name}
                                </span>
                                <span className="text-[12px] leading-4 text-text-muted">
                                    {t('Parent services')}
                                </span>
                            </span>
                        </span>
                    ) : (
                        <LogoMark />
                    )}
                    <LanguageSwitch />
                </div>
            </header>
            <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-6 px-4 py-6">
                {(back || step) && (
                    <div className="flex items-center justify-between text-[13px] text-text-muted">
                        {back ? (
                            <Link
                                href={back}
                                className="font-medium hover:text-text"
                            >
                                ← {t('Back')}
                            </Link>
                        ) : (
                            <span />
                        )}
                        {step && (
                            <span>
                                {t('Step :step of :total', { step, total: 2 })}
                            </span>
                        )}
                    </div>
                )}
                {children}
            </main>
            <footer className="mx-auto w-full max-w-[520px] px-4 pb-6 text-[12px] leading-4 text-text-muted">
                {t(
                    'Campus works for your child’s school. Payments go straight to the school, with a receipt as soon as they go through.',
                )}
            </footer>
        </div>
    );
}

export function PayHeading({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="flex flex-col gap-2">
            <h1 className="font-display text-[26px] leading-[30px] font-extrabold tracking-[-0.02em]">
                {title}
            </h1>
            {sub && (
                <p className="text-[15px] leading-[1.5] text-text-muted">
                    {sub}
                </p>
            )}
        </div>
    );
}

/** Who is being paid for, so a parent with several children can tell. */
export function ChildSummary({
    student,
    trailing,
}: {
    student: ChildCard;
    trailing?: ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-solid border-border bg-white px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint font-display text-[14px] font-bold text-primary">
                {initialsOf(student.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-5 font-semibold">
                    {student.name}
                </span>
                <span className="truncate text-[13px] leading-[18px] text-text-muted">
                    {[student.class, student.matricule]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
            </span>
            {trailing}
        </div>
    );
}

export const payButtonClass =
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-white hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50';

export const payInputClass =
    'h-12 w-full rounded-xl border border-solid border-border bg-white px-4 text-[16px] font-normal text-text outline-none focus:border-primary';

function initialsOf(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);

    return (
        ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '··'
    );
}

export const SERVICES: Record<
    string,
    { title: string; body: string; soon?: boolean }
> = {
    pay: {
        title: 'Pay school fees',
        body: 'With MTN Mobile Money or Orange Money, and get a receipt at once.',
    },
    attendance: {
        title: 'Attendance',
        body: 'Days present this term, and every absence or late arrival.',
    },
    announcements: {
        title: 'Announcements',
        body: 'News and notices from the school.',
        soon: true,
    },
};

export function ServiceIcon({ service }: { service: string }) {
    return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {service === 'pay' && (
                    <>
                        <rect x="7" y="2.5" width="10" height="19" rx="2" />
                        <path d="M11 18.5h2" />
                    </>
                )}
                {service === 'attendance' && (
                    <>
                        <rect x="3.5" y="5" width="17" height="15" rx="2" />
                        <path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" />
                    </>
                )}
                {service === 'announcements' && (
                    <path d="M4 10v4h3l6 4V6L7 10H4zM17 9a4 4 0 010 6" />
                )}
            </svg>
        </span>
    );
}
