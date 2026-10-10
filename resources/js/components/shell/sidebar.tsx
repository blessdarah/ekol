import { Link, usePage } from '@inertiajs/react';
import { logout } from '@/actions/App/Http/Controllers/Auth/LoginController';
import { Icons, NAV_SECTIONS } from './nav';

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
    roleLabel: string;
}

function initialsOf(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);

    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function Sidebar({
    school,
    term,
    user,
    feeBadge,
}: {
    school: ShellSchool | null;
    term: ShellTerm | null;
    user: ShellUser | null;
    feeBadge: number | null;
}) {
    const { url } = usePage();

    return (
        <aside className="font-auth sticky top-0 flex h-screen print:hidden w-[248px] shrink-0 flex-col border-r border-solid border-border bg-surface antialiased">
            <div className="flex items-center gap-3 px-5 pt-6 pb-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-[14px] font-extrabold text-white">
                    {school ? school.code.slice(0, 2).toUpperCase() : '··'}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-semibold text-text">
                        {school?.name ?? '…'}
                    </span>
                    <span className="text-[12px] text-text-muted">
                        {school?.role ?? 'Administrator'}
                    </span>
                </span>
                <span className="shrink-0 text-text-muted">
                    {Icons.chevron}
                </span>
            </div>

            {term && (
                <div className="mx-3 mb-5 flex items-center gap-[10px] rounded-md border border-solid border-border bg-white px-3 py-[10px]">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
                    <span className="flex flex-col">
                        <span className="text-[13px] font-medium text-text">
                            {term.label}
                        </span>
                        <span className="text-[12px] text-text-muted">
                            {term.weekLabel}
                        </span>
                    </span>
                </div>
            )}

            <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
                {NAV_SECTIONS.map((section) => (
                    <div key={section.label} className="flex flex-col gap-1">
                        <p className="px-2 text-[11px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                            {section.label}
                        </p>
                        {section.links.map((link) => {
                            const active =
                                url === link.href ||
                                url.startsWith(`${link.href}/`);
                            const badge =
                                link.href === '/fees' ? feeBadge : null;

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
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
                                        {link.label}
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

            <div className="flex items-center gap-3 border-t border-border px-5 py-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[12px] font-bold text-primary">
                    {user ? initialsOf(user.full_name) : '··'}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium text-text">
                        {user?.full_name ?? '…'}
                    </span>
                    <span className="text-[12px] text-text-muted">
                        {user?.roleLabel ?? ''}
                    </span>
                </span>
                <Link
                    href={logout.url()}
                    method="post"
                    as="button"
                    aria-label="Sign out"
                    title="Sign out"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-white hover:text-text"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                    </svg>
                </Link>
            </div>
        </aside>
    );
}
