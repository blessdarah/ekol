import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import Sidebar, {
    type ShellSchool,
    type ShellTerm,
    type ShellUser,
} from '../components/shell/sidebar';
import Toasts from '../components/shell/toasts';

export interface ShellSharedProps {
    school: ShellSchool | null;
    term: ShellTerm | null;
    shellUser: ShellUser | null;
    feeBadge: number | null;
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
    const school = props.school ?? null;

    // The menu slides away once a link in it has been followed.
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
        <div className="flex min-h-screen flex-col bg-white text-text antialiased lg:flex-row">
            <header className="font-auth sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-solid border-border bg-white px-4 lg:hidden print:hidden">
                <button
                    type="button"
                    aria-label="Open menu"
                    aria-expanded={menuOpen}
                    aria-controls="app-menu"
                    onClick={() => setMenuOpen(true)}
                    className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text hover:bg-surface"
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M3 5.5h14M3 10h14M3 14.5h14" />
                    </svg>
                </button>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary font-display text-[11px] font-extrabold text-white">
                    {school ? school.code.slice(0, 2).toUpperCase() : '··'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-semibold text-text">{school?.name ?? ''}</span>
                {props.term && <span className="shrink-0 text-[12px] leading-4 text-text-muted">{props.term.label}</span>}
            </header>
            {menuOpen && (
                <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 bg-text/40 lg:hidden print:hidden"
                />
            )}
            <Sidebar
                school={school}
                term={props.term ?? null}
                user={props.shellUser ?? null}
                feeBadge={props.feeBadge ?? null}
                open={menuOpen}
            />
            <main className="font-auth flex min-w-0 flex-1 justify-center px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
                <div className="w-full max-w-[1112px] min-w-0">{children}</div>
            </main>
            <Toasts />
        </div>
    );
}
