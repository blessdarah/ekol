import { Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { show as profile } from '@/actions/App/Http/Controllers/ProfileController';
import { logout } from '@/actions/App/Http/Controllers/Auth/LoginController';
import { logout as platformLogout } from '@/actions/App/Http/Controllers/PlatformAuthController';
import { useT } from '../../lib/i18n';
import LanguageSwitch from './language-switch';
import { Icons, NAV_SECTIONS, TEACHER_NAV_SECTIONS } from './nav';

export interface ShellSchool {
    id: string;
    name: string;
    code: string;
    slug: string;
    role: string | null;
}

export interface ShellTerm {
    label: string;
    weekLabel: string;
}

export interface ShellUser {
    full_name: string;
    initials: string;
    email?: string | null;
    roleLabel: string;
    portal?: 'teacher' | 'admin';
    /** Every school on Campus that knows this person's email. */
    schools?: {
        name: string;
        code: string;
        role: string;
        current: boolean;
        login_url: string;
    }[];
}

function initialsOf(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);

    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const menuItemClass =
    'flex h-9 w-full items-center gap-[10px] rounded-lg px-[10px] text-left text-[14px] font-medium text-text hover:bg-surface';

/**
 * The school and role at the top of the menu, which opens onto who is
 * signed in: their profile, language, their other schools, and signing out.
 */
function AccountMenu({
    school,
    user,
}: {
    school: ShellSchool | null;
    user: ShellUser | null;
}) {
    const { props } = usePage();
    const t = useT();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement | null>(null);
    const visiting = Boolean(props.platformVisit);
    const schools = user?.schools ?? [];

    useEffect(() => {
        if (!open) {
            return;
        }

        const away = (event: MouseEvent) => {
            if (box.current && !box.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', escape);

        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    return (
        <div ref={box} className="relative px-3 pt-4 pb-4">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className={`flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left ${
                    open
                        ? 'bg-white outline outline-1 outline-primary'
                        : 'hover:bg-white'
                }`}
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-[14px] font-extrabold text-white">
                    {school ? school.code.slice(0, 2).toUpperCase() : '··'}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-semibold text-text">
                        {school?.name ?? '…'}
                    </span>
                    <span className="truncate text-[12px] text-text-muted">
                        {t(user?.roleLabel ?? 'Administrator')}
                    </span>
                </span>
                <span className="shrink-0 text-text-muted">
                    {Icons.chevron}
                </span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute top-[calc(100%-6px)] right-3 left-3 z-50 flex flex-col overflow-hidden rounded-xl border border-solid border-border bg-white shadow-[0_12px_32px_color-mix(in_srgb,var(--color-text)_14%,transparent)] lg:right-auto lg:w-[300px]"
                >
                    <div className="flex items-center gap-3 p-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[14px] font-semibold text-primary">
                            {user ? initialsOf(user.full_name) : '··'}
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[14px] font-semibold text-text">
                                {user?.full_name ?? '…'}
                            </span>
                            <span className="truncate text-[13px] text-text-muted">
                                {t(user?.roleLabel ?? '')}
                                {school ? ` · ${school.name}` : ''}
                            </span>
                            {user?.email && (
                                <span className="truncate text-[12px] text-text-muted">
                                    {user.email}
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="flex flex-col border-t border-solid border-border p-[6px]">
                        {!visiting && (
                            <Link
                                href={profile.url()}
                                role="menuitem"
                                onClick={() => setOpen(false)}
                                className={menuItemClass}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    className="shrink-0 text-text-muted"
                                >
                                    <circle cx="12" cy="8" r="4" />
                                    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
                                </svg>
                                {t('My profile')}
                            </Link>
                        )}
                        <div className="flex h-9 items-center justify-between gap-[10px] px-[10px] text-[14px] font-medium text-text">
                            <span className="flex items-center gap-[10px]">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    className="shrink-0 text-text-muted"
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
                                </svg>
                                {t('Language')}
                            </span>
                            <LanguageSwitch />
                        </div>
                    </div>

                    {schools.length > 1 && (
                        <div className="flex flex-col gap-[2px] border-t border-solid border-border px-[6px] pt-[10px] pb-[6px]">
                            <span className="px-[10px] pb-1 text-[11px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                                {t('Your schools')}
                            </span>
                            {schools.map((option) => (
                                <div
                                    key={option.login_url}
                                    className="flex h-10 items-center justify-between gap-3 rounded-lg px-[10px]"
                                >
                                    <span className="flex min-w-0 items-center gap-[10px]">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-white">
                                            {option.code
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-[13px] font-medium text-text">
                                                {option.name}
                                            </span>
                                            <span className="truncate text-[12px] text-text-muted">
                                                {t(option.role)}
                                            </span>
                                        </span>
                                    </span>
                                    {option.current ? (
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            aria-label={t('You are here')}
                                            className="shrink-0"
                                        >
                                            <path
                                                d="M5 12.5l4.5 4.5L19 7.5"
                                                fill="none"
                                                stroke="var(--color-primary)"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    ) : (
                                        <a
                                            href={option.login_url}
                                            role="menuitem"
                                            className="shrink-0 text-[12px] font-medium text-primary hover:underline"
                                        >
                                            {t('Switch')}
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex border-t border-solid border-border p-[6px]">
                        <Link
                            href={
                                visiting ? platformLogout.url() : logout.url()
                            }
                            method="post"
                            as="button"
                            role="menuitem"
                            className={`${menuItemClass} text-danger hover:bg-danger-tint`}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="shrink-0"
                            >
                                <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
                            </svg>
                            {t('Sign out')}
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Sidebar({
    school,
    user,
    feeBadge,
    open = false,
}: {
    school: ShellSchool | null;
    user: ShellUser | null;
    feeBadge: number | null;
    /** Whether the menu is slid in, on screens too narrow to keep it in view. */
    open?: boolean;
}) {
    const { url, props } = usePage<{ can: Record<string, boolean> }>();
    const t = useT();
    const sections = (
        user?.portal === 'teacher' ? TEACHER_NAV_SECTIONS : NAV_SECTIONS
    ).map((section) => ({
        ...section,
        links: section.links.map((link) =>
            link.fallback && !props.can[link.fallback.ability]
                ? {
                      ...link,
                      href: link.fallback.href,
                      activePaths: [link.href, ...(link.activePaths ?? [])],
                  }
                : link,
        ),
    }));
    const path = url.split('?')[0];
    const covers = (href: string) =>
        path === href || path.startsWith(`${href}/`);
    // The most specific link wins, so a page under Admissions does not
    // also light up Overview.
    const current = sections
        .flatMap((section) => section.links)
        .flatMap((link) =>
            [link.href, ...(link.activePaths ?? [])]
                .filter(covers)
                .map((path) => ({ href: link.href, length: path.length })),
        )
        .sort((a, b) => b.length - a.length)[0]?.href;

    return (
        <aside
            id="app-menu"
            className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[280px] max-w-[85vw] shrink-0 flex-col border-r border-solid border-border bg-surface font-auth antialiased transition-transform duration-200 lg:visible lg:sticky lg:top-0 lg:z-auto lg:w-[248px] lg:max-w-none lg:translate-x-0 print:hidden ${
                open ? 'translate-x-0' : 'invisible -translate-x-full'
            }`}
        >
            <AccountMenu school={school} user={user} />

            <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
                {sections.map((section) => (
                    <div key={section.label} className="flex flex-col gap-1">
                        {section.label && (
                            <p className="px-2 text-[11px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                                {t(section.label)}
                            </p>
                        )}
                        {section.links.map((link) => {
                            const active = link.href === current;
                            const badge =
                                link.href === '/fees' ? feeBadge : null;

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex h-[34px] items-center gap-3 rounded-lg px-2 text-[14px] ${
                                        active
                                            ? 'bg-primary-tint font-semibold text-primary'
                                            : 'font-medium text-text hover:bg-white'
                                    }`}
                                >
                                    <span className="shrink-0">
                                        {Icons[link.icon]}
                                    </span>
                                    <span className="flex-1 truncate">
                                        {t(link.label)}
                                    </span>
                                    {badge !== null && badge !== undefined && (
                                        <span className="rounded-full bg-danger-tint px-2 text-[12px] font-semibold text-danger">
                                            {badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>
        </aside>
    );
}
