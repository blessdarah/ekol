import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    access,
    create,
    edit,
    index,
    remind,
    show,
} from '@/actions/App/Http/Controllers/StaffController';
import {
    Avatar,
    EMPLOYMENT_LABELS,
    GENDER_LABELS,
    PageHeader,
    StatusDot,
} from '../../components/staff/ui';
import { withAppShell } from '../../layouts/app-layout';

interface StaffRow {
    id: string;
    name: string;
    initials: string;
    photo_url: string | null;
    role_label: string;
    subjects: string[];
    gender: string | null;
    employment_type: string | null;
    email: string;
    phone: string;
    has_account: boolean;
    invited_on: string | null;
}

interface Filters {
    filter: string;
    q: string;
    role: string;
    gender: string;
}

interface RosterProps {
    yearLabel: string | null;
    counts: {
        total: number;
        government: number;
        school_paid: number;
        no_account: number;
    };
    filters: Filters;
    roles: { value: string; label: string }[];
    staff: {
        rows: StaffRow[];
        page: number;
        lastPage: number;
        total: number;
    };
}

const TABS = [
    { value: 'all', label: 'All staff' },
    { value: 'government', label: 'Government employees' },
    { value: 'school_paid', label: 'School-paid' },
    { value: 'no_account', label: 'No account yet', dot: true },
];

const headCellClass =
    'shrink-0 text-[12px] leading-[1.35] font-semibold tracking-[0.06em] text-text-muted';

const selectClass =
    'h-9 rounded-md border border-solid border-border bg-white px-3 text-[13px] text-text outline-none focus:border-primary';

function RowMenu({
    row,
    open,
    onToggle,
}: {
    row: StaffRow;
    open: boolean;
    onToggle: () => void;
}) {
    const itemClass =
        'flex h-8 w-full items-center rounded-sm px-3 text-left text-[13px] text-text hover:bg-surface';

    return (
        <div className="relative w-10 shrink-0">
            <button
                type="button"
                aria-label={`Actions for ${row.name}`}
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-primary-tint"
            >
                <svg width="16" height="16" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="1.6" fill="#56625C" />
                    <circle cx="12" cy="12" r="1.6" fill="#56625C" />
                    <circle cx="19" cy="12" r="1.6" fill="#56625C" />
                </svg>
            </button>
            {open && (
                <div
                    role="menu"
                    onClick={(event) => event.stopPropagation()}
                    className="absolute top-full right-0 z-10 mt-1 flex w-[190px] flex-col rounded-md border border-solid border-border bg-white p-1 shadow-[0_8px_24px_rgba(16,25,21,0.12)]"
                >
                    <Link role="menuitem" href={show.url(row.id)} className={itemClass}>
                        Open record
                    </Link>
                    <Link role="menuitem" href={edit.url(row.id)} className={itemClass}>
                        Edit details
                    </Link>
                    <Link role="menuitem" href={access.url(row.id)} className={itemClass}>
                        Portal access
                    </Link>
                    {!row.has_account && row.invited_on && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                onToggle();
                                router.post(
                                    remind.url(row.id),
                                    {},
                                    { preserveScroll: true },
                                );
                            }}
                            className={itemClass}
                        >
                            Send a reminder
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function Roster({ yearLabel, counts, filters, roles, staff }: RosterProps) {
    const [search, setSearch] = useState(filters.q);
    const [showFilters, setShowFilters] = useState(
        filters.role !== '' || filters.gender !== '',
    );
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const extraFilters = [filters.role, filters.gender].filter(Boolean).length;

    function visit(patch: Partial<Filters> & { page?: number }) {
        const next = { ...filters, ...patch };
        const query: Record<string, string | number> = {};

        if (next.filter !== 'all') {
            query.filter = next.filter;
        }
        if (next.q) {
            query.q = next.q;
        }
        if (next.role) {
            query.role = next.role;
        }
        if (next.gender) {
            query.gender = next.gender;
        }
        if (patch.page && patch.page > 1) {
            query.page = patch.page;
        }

        router.get(
            index.url({ query }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    function onSearch(value: string) {
        setSearch(value);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => visit({ q: value.trim() }), 300);
    }

    useEffect(() => {
        function close() {
            setOpenMenu(null);
        }

        document.addEventListener('click', close);

        return () => {
            document.removeEventListener('click', close);
            if (timer.current) {
                clearTimeout(timer.current);
            }
        };
    }, []);

    return (
        <div className="flex min-h-[calc(100vh-56px)] flex-col gap-7">
            <Head title="The staff roster" />
            <PageHeader
                crumb="Roster"
                title="The staff roster"
                tag={`Roster${yearLabel ? ` · ${yearLabel}` : ''}`}
                meta={`${counts.total} staff · ${counts.government} government employees · ${counts.school_paid} school-paid · ${counts.no_account} with no account yet`}
            />

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex flex-wrap gap-2">
                    {TABS.map((tab) => {
                        const selected = filters.filter === tab.value;

                        return (
                            <button
                                key={tab.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => visit({ filter: tab.value })}
                                className={`flex h-8 items-center gap-2 rounded-md border border-solid px-3 text-[13px] ${
                                    selected
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border bg-white font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {tab.dot && <StatusDot tone="warning" />}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex h-9 w-[260px] items-center gap-2 rounded-md border border-solid border-border bg-white px-3 focus-within:border-primary">
                        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                            <circle cx="11" cy="11" r="7" fill="none" stroke="#56625C" strokeWidth="2" />
                            <path d="M16.5 16.5L21 21" fill="none" stroke="#56625C" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <input
                            type="search"
                            aria-label="Search staff"
                            placeholder="A name, a subject or a town"
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
                        />
                    </label>
                    <button
                        type="button"
                        aria-expanded={showFilters}
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex h-9 items-center justify-center rounded-md border border-solid border-border px-4 text-[14px] font-medium text-primary hover:bg-surface"
                    >
                        Filter{extraFilters > 0 ? ` · ${extraFilters}` : ''}
                    </button>
                    <Link
                        href={create.url()}
                        className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14">
                            <path d="M7 2.4v9.2M2.4 7h9.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        Add a staff member
                    </Link>
                </div>
            </div>

            {showFilters && (
                <div className="-mt-3 flex flex-wrap items-center gap-2">
                    <select
                        aria-label="Portal role"
                        value={filters.role}
                        onChange={(e) => visit({ role: e.target.value })}
                        className={selectClass}
                    >
                        <option value="">Any portal role</option>
                        {roles.map((role) => (
                            <option key={role.value} value={role.value}>
                                {role.label}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Gender"
                        value={filters.gender}
                        onChange={(e) => visit({ gender: e.target.value })}
                        className={selectClass}
                    >
                        <option value="">Any gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                    </select>
                    {extraFilters > 0 && (
                        <button
                            type="button"
                            onClick={() => visit({ role: '', gender: '' })}
                            className="px-2 text-[13px] font-medium text-primary hover:underline"
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}

            <div className="flex flex-1 flex-col gap-4">
                <div className="overflow-x-auto lg:overflow-visible">
                    <div className="flex min-w-[980px] flex-col rounded-lg border border-solid border-border bg-white">
                        <div className="flex items-center gap-4 rounded-t-lg border-b border-solid border-border bg-surface px-4 py-2">
                            <span className={`${headCellClass} min-w-0 flex-1`}>Staff member</span>
                            <span className={`${headCellClass} w-[88px]`}>Gender</span>
                            <span className={`${headCellClass} w-[176px]`}>Employment</span>
                            <span className={`${headCellClass} w-[218px]`}>Contact</span>
                            <span className={`${headCellClass} w-[140px]`}>Portal</span>
                            <span className="w-10 shrink-0" />
                        </div>
                        {staff.rows.length === 0 && (
                            <p className="px-4 py-8 text-center text-[13px] text-text-muted">
                                Nobody on the roster matches. Try another name,
                                or clear the filters.
                            </p>
                        )}
                        {staff.rows.map((row, position) => (
                            <div
                                key={row.id}
                                onClick={() => router.visit(show.url(row.id))}
                                className={`flex cursor-pointer items-center gap-4 border-b border-solid border-border px-4 py-3 last:rounded-b-lg last:border-b-0 hover:bg-surface ${
                                    position % 2 === 1 ? 'bg-row-alt' : 'bg-white'
                                }`}
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <Avatar
                                        initials={row.initials}
                                        photoUrl={row.photo_url}
                                        size={36}
                                    />
                                    <div className="flex min-w-0 flex-col">
                                        <Link
                                            href={show.url(row.id)}
                                            onClick={(event) => event.stopPropagation()}
                                            className="truncate text-[14px] leading-[1.35] font-semibold text-text hover:underline"
                                        >
                                            {row.name}
                                        </Link>
                                        <span className="truncate text-[13px] leading-[1.35] text-text-muted">
                                            {[row.role_label, row.subjects.join(', ')]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </div>
                                </div>
                                <span className="w-[88px] shrink-0 text-[14px] text-text">
                                    {row.gender ? GENDER_LABELS[row.gender] : '—'}
                                </span>
                                <span className="w-[176px] shrink-0 text-[14px] text-text">
                                    {row.employment_type
                                        ? EMPLOYMENT_LABELS[row.employment_type]
                                        : '—'}
                                </span>
                                <span className="flex w-[218px] shrink-0 flex-col">
                                    <span className="truncate text-[14px] leading-[1.35] text-text">
                                        {row.email}
                                    </span>
                                    <span className="text-[13px] leading-[1.35] text-text-muted">
                                        {row.phone}
                                    </span>
                                </span>
                                <span className="flex w-[140px] shrink-0 items-center gap-2 text-[13px] text-text">
                                    <StatusDot tone={row.has_account ? 'success' : 'warning'} />
                                    {row.has_account ? 'Portal on' : 'No account yet'}
                                </span>
                                <RowMenu
                                    row={row}
                                    open={openMenu === row.id}
                                    onToggle={() =>
                                        setOpenMenu(openMenu === row.id ? null : row.id)
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
                    <p className="text-[13px] text-text-muted">
                        {staff.rows.length} of {staff.total} shown · sorted by
                        family name
                    </p>
                    <div className="flex items-center gap-2">
                        {staff.lastPage > 1 &&
                            Array.from({ length: staff.lastPage }, (_, i) => i + 1).map(
                                (page) => (
                                    <button
                                        key={page}
                                        type="button"
                                        aria-current={page === staff.page ? 'page' : undefined}
                                        onClick={() => visit({ page })}
                                        className={`flex h-7 items-center rounded-md px-3 text-[13px] text-primary ${
                                            page === staff.page
                                                ? 'border border-solid border-primary bg-primary-tint font-semibold'
                                                : 'hover:bg-surface'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ),
                            )}
                        <span className="text-[13px] text-text-muted">
                            {counts.total} staff
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withAppShell(Roster);
