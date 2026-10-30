import { Link, router, usePage } from '@inertiajs/react';
import { leave } from '@/actions/App/Http/Controllers/PlatformController';
import { start } from '@/actions/App/Http/Controllers/DemoSchoolController';
import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import Sidebar, {
    type ShellSchool,
    type ShellTerm,
    type ShellUser,
} from '../components/shell/sidebar';
import Toasts from '../components/shell/toasts';
import { useT } from '../lib/i18n';

export interface ShellSharedProps {
    school: ShellSchool | null;
    term: ShellTerm | null;
    shellUser: ShellUser | null;
    feeBadge: number | null;
    platformVisit: { school: string; started: string; expires: string } | null;
    demoSchool: { expires: string } | null;
    [key: string]: unknown;
}

export function withAppShell<P extends object>(
    Component: ComponentType<P>,
): ComponentType<P> & { layout: (page: ReactNode) => ReactNode } {
    const Wrapped = Component as ComponentType<P> & {
        layout?: (page: ReactNode) => ReactNode;
    };
    Wrapped.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

    return Wrapped as ComponentType<P> & {
        layout: (page: ReactNode) => ReactNode;
    };
}

export default function AppLayout({ children }: { children: ReactNode }) {
    const { props, url } = usePage<ShellSharedProps>();
    const [menuOpen, setMenuOpen] = useState(false);
    const t = useT();
    const school = props.school ?? null;

    // The menu slides away once a link in it has been followed.
    useEffect(() => {
        if (!props.platformVisit) {
            return;
        }
        const timer = window.setTimeout(
            () => {
                router.post(leave.url());
            },
            Math.max(0, Date.parse(props.platformVisit.expires) - Date.now()),
        );
        return () => window.clearTimeout(timer);
    }, [props.platformVisit]);

    useEffect(() => {
        setMenuOpen(false);
    }, [url]);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
            }
        };

        document.addEventListener('keydown', onKey);

        return () => document.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    return (
        <div className="min-h-screen bg-white text-text antialiased">
            {props.platformVisit && (
                <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-warning-tint px-6 py-3 font-auth text-[13px] text-warning print:hidden">
                    <div>
                        <strong>
                            {t('You are in :school as Campus super-admin', {
                                school: props.platformVisit.school,
                            })}
                        </strong>
                        <span className="ml-3">
                            {t('Full access')} · {t('since')}{' '}
                            {new Date(
                                props.platformVisit.started,
                            ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>
                    <Link
                        href={leave()}
                        as="button"
                        className="rounded-md border border-warning px-3 py-1.5 font-semibold"
                    >
                        {t('Back to all schools')}
                    </Link>
                </div>
            )}
            {props.demoSchool && (
                <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-science-tint px-6 py-3 font-auth text-[13px] text-science print:hidden">
                    <div>
                        <strong>
                            {t('Demo school · everything here is sample data')}
                        </strong>
                        <p>
                            {t('Open until')} {props.demoSchool.expires} ·{' '}
                            {t('mobile money and messages are off')}
                        </p>
                    </div>
                    <Link
                        href={start()}
                        as="button"
                        className="rounded-md border border-science px-3 py-1.5 font-semibold"
                    >
                        {t('Start our real school')} →
                    </Link>
                </div>
            )}
            <div className="flex min-h-screen flex-col lg:flex-row">
                <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-solid border-border bg-white px-4 font-auth lg:hidden print:hidden">
                    <button
                        type="button"
                        aria-label={t('Open menu')}
                        aria-expanded={menuOpen}
                        aria-controls="app-menu"
                        onClick={() => setMenuOpen(true)}
                        className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text hover:bg-surface"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
                        </svg>
                    </button>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary font-display text-[11px] font-extrabold text-white">
                        {school ? school.code.slice(0, 2).toUpperCase() : '··'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-semibold text-text">
                        {school?.name ?? ''}
                    </span>
                    {props.term && (
                        <span className="shrink-0 text-[12px] leading-4 text-text-muted">
                            {t(props.term.label)}
                        </span>
                    )}
                </header>
                {menuOpen && (
                    <button
                        type="button"
                        aria-label={t('Close menu')}
                        onClick={() => setMenuOpen(false)}
                        className="fixed inset-0 z-40 bg-text/40 lg:hidden print:hidden"
                    />
                )}
                <Sidebar
                    school={school}
                    user={props.shellUser ?? null}
                    feeBadge={props.feeBadge ?? null}
                    open={menuOpen}
                />
                <main className="flex min-w-0 flex-1 justify-center px-4 py-5 font-auth sm:px-6 lg:px-10 lg:py-7 print:block print:p-0">
                    <div className="w-full max-w-[1112px] min-w-0 print:max-w-none">
                        {children}
                    </div>
                </main>
                <Toasts />
            </div>
        </div>
    );
}
