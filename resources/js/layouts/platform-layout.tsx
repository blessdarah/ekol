import { Head, Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    schools,
    demos,
    visits,
    signups,
} from '@/actions/App/Http/Controllers/PlatformController';
import { logout } from '@/actions/App/Http/Controllers/PlatformAuthController';
import Toasts from '@/components/shell/toasts';
import { useT } from '@/lib/i18n';

export default function PlatformLayout({
    title,
    eyebrow = 'Platform',
    active,
    children,
    panel,
}: {
    title: string;
    eyebrow?: string;
    active: 'schools' | 'demos' | 'visits' | 'signups';
    children: ReactNode;
    panel?: ReactNode;
}) {
    const { platformUser, pendingCount } = usePage<{
        platformUser: { full_name: string; initials: string };
        pendingCount: number;
    }>().props;
    const t = useT();
    const links = [
        { key: 'schools', label: 'Schools', href: schools.url() },
        { key: 'signups', label: 'Sign-ups waiting', href: signups.url() },
        { key: 'demos', label: 'Demo requests', href: demos.url() },
        { key: 'visits', label: 'Visit log', href: visits.url() },
    ];
    return (
        <div className="flex min-h-screen flex-col bg-white font-auth text-text lg:flex-row">
            <Head title={t(title)} />
            <aside className="flex shrink-0 flex-col justify-between gap-8 bg-[#101915] p-3 text-[#EAF2EC] lg:sticky lg:top-0 lg:h-screen lg:w-[232px] lg:py-5">
                <div className="flex flex-col gap-7">
                    <div className="flex items-center gap-2.5 px-2">
                        <span className="flex size-7 items-center justify-center rounded-[7px] bg-[#7BD8A6] font-display text-[13px] font-extrabold text-[#0B1712]">
                            C
                        </span>
                        <div>
                            <div className="font-display text-[15px] font-bold">
                                Campus
                            </div>
                            <div className="font-mono text-[11px] tracking-[0.06em] text-[#8FA89A]">
                                PLATFORM
                            </div>
                        </div>
                    </div>
                    <nav
                        className="flex flex-wrap gap-0.5 lg:flex-col"
                        aria-label={t('Platform')}
                    >
                        {links.map((link) => (
                            <Link
                                key={link.key}
                                href={link.href}
                                aria-current={
                                    active === link.key ? 'page' : undefined
                                }
                                className={`flex min-h-[34px] items-center justify-between gap-3 rounded-lg px-2.5 text-[14px] ${active === link.key ? 'bg-[#1E3329] font-semibold text-[#EAF2EC]' : 'text-[#8FA89A] hover:bg-[#1E3329]'}`}
                            >
                                {t(link.label)}
                                {link.key === 'signups' && pendingCount > 0 && (
                                    <span className="font-mono text-[12px] text-[#E8B35A]">
                                        {pendingCount}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-2.5 border-t border-[#1E3329] px-2 pt-3">
                    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#1E3329] text-xs font-semibold">
                        {platformUser.initials}
                    </span>
                    <div className="flex-1">
                        <p className="text-[13px] font-semibold">
                            {platformUser.full_name}
                        </p>
                        <p className="text-xs text-[#8FA89A]">
                            {t('Super-admin')}
                        </p>
                    </div>
                    <Link
                        href={logout()}
                        as="button"
                        className="text-xs text-[#8FA89A] hover:text-white"
                    >
                        {t('Sign out')}
                    </Link>
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
                <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-8 sm:px-8 lg:pt-9 lg:pl-10">
                    <header className="flex flex-col gap-1.5">
                        <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                            {t(eyebrow)}
                        </p>
                        <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em]">
                            {t(title)}
                        </h1>
                    </header>
                    {children}
                </main>
                {panel && (
                    <aside className="flex w-full shrink-0 flex-col gap-5 border-t border-border bg-surface p-6 xl:w-[320px] xl:border-t-0 xl:border-l">
                        {panel}
                    </aside>
                )}
            </div>
            <Toasts />
        </div>
    );
}

export function Status({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex rounded-full bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary">
            {children}
        </span>
    );
}

export function Detail({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    const t = useT();
    return (
        <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 text-[13px]">
            <dt className="text-text-muted">{t(label)}</dt>
            <dd className="text-right font-medium">{children}</dd>
        </div>
    );
}

export const tableClass = 'w-full border-collapse text-left text-[13px]';
export const thClass =
    'bg-surface px-4 py-2.5 text-xs font-semibold tracking-[0.06em] text-text-muted uppercase';
export const tdClass = 'border-t border-border px-4 py-3';
export const pillClass = (active: boolean) =>
    `inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] ${active ? 'border-primary bg-primary-tint font-semibold text-primary' : 'border-border text-text hover:bg-surface'}`;
