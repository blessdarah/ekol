import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    create,
    edit,
    index,
    show,
} from '@/actions/App/Http/Controllers/StudentController';
import { show as importPage } from '@/actions/App/Http/Controllers/StudentImportController';
import {
    PlusIcon,
    StreamChip,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { FeePill, StudentHeader, money } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface StudentRow {
    id: string;
    name: string;
    initials: string;
    matricule: string;
    class: string | null;
    series: { code: string; stream: string } | null;
    needs_series: boolean;
    guardian: string;
    phone: string;
    fees: string | null;
    balance: number;
}

interface Filters {
    tab: string;
    q: string;
    level: string;
    class: string;
}

interface RosterProps {
    yearLabel: string | null;
    currency: string;
    counts: {
        total: number;
        classes: number;
        overdue: number;
        no_series: number;
        new: number;
    };
    filters: Filters;
    levels: { id: string; name: string }[];
    classes: { id: string; name: string; level_id: string }[];
    students: {
        rows: StudentRow[];
        page: number;
        lastPage: number;
        total: number;
    };
}

const headClass =
    'shrink-0 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

const selectClass =
    'h-9 rounded-md border border-solid border-border bg-white px-3 text-[13px] text-text outline-none focus:border-primary';

/** First three pages, then the last, as the design shows. */
function pageList(last: number, current: number): (number | 'gap')[] {
    const pages = new Set<number>([1, 2, 3, current - 1, current, current + 1, last]);
    const sorted = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);
    const list: (number | 'gap')[] = [];

    sorted.forEach((page, position) => {
        if (position > 0 && page - sorted[position - 1] > 1) {
            list.push('gap');
        }
        list.push(page);
    });

    return list;
}

function StudentRoster({ yearLabel, currency, counts, filters, levels, classes, students }: RosterProps) {
    const [search, setSearch] = useState(filters.q);
    const [showFilters, setShowFilters] = useState(
        filters.level !== '' || filters.class !== '',
    );
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tabs = [
        { value: 'all', label: t('All students') },
        { value: 'overdue', label: t('Overdue fees · :overdue', { overdue: counts.overdue }), dot: 'bg-danger' },
        { value: 'no_series', label: t('No series · :no_series', { no_series: counts.no_series }), dot: 'bg-warning' },
        { value: 'new', label: t('New this term · :new', { new: counts.new }) },
    ];
    const shownClasses = filters.level
        ? classes.filter((option) => option.level_id === filters.level)
        : classes;

    function visit(patch: Partial<Filters> & { page?: number }) {
        const next = { ...filters, ...patch };
        const query: Record<string, string | number> = {};

        if (next.tab !== 'all') {
            query.tab = next.tab;
        }
        if (next.q) {
            query.q = next.q;
        }
        if (next.level) {
            query.level = next.level;
        }
        if (next.class) {
            query.class = next.class;
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
        <div className="flex flex-col gap-6">
            <Head title={t('Students')} />
            <StudentHeader
                trail={[{ label: t('Roster') }]}
                title={t('Students')}
                tag={t('Enrolment:year_label', { year_label: yearLabel ? ` · ${yearLabel}` : '' })}
                meta={t(':total students · :classes classes', { total: money(counts.total), classes: counts.classes })}
                action={
                    <div className="flex gap-2">
                        <Link href={importPage.url()} className={`${outlineButtonClass} gap-2`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                                <path d="M12 15V4M7 9l5-5 5 5M4 17v3h16v-3" fill="none" stroke="#101915" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {t('Import')}
                        </Link>
                        <Link href={create.url()} className={solidButtonClass}>
                            <PlusIcon />
                            {t('Add student')}
                        </Link>
                    </div>
                }
            />

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => {
                        const selected = filters.tab === tab.value;

                        return (
                            <button
                                key={tab.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => visit({ tab: tab.value })}
                                className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                    selected
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {tab.dot && (
                                    <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${tab.dot}`} />
                                )}
                                {t(tab.label)}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-2">
                    <label className="flex h-9 w-[260px] items-center gap-2 rounded-md border border-solid border-border px-3 focus-within:border-primary">
                        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                            <circle cx="11" cy="11" r="7" fill="none" stroke="#56625C" strokeWidth="2" />
                            <path d="M16 16l5 5" fill="none" stroke="#56625C" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <input
                            type="search"
                            aria-label={t('Search students')}
                            placeholder={t('Name, matricule or phone')}
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted"
                        />
                    </label>
                    <button
                        type="button"
                        aria-expanded={showFilters}
                        onClick={() => setShowFilters(!showFilters)}
                        className={outlineButtonClass}
                    >
                        {t('Level and class')}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="-mt-3 flex flex-wrap items-center gap-2">
                    <select
                        aria-label={t('Level')}
                        value={filters.level}
                        onChange={(e) => visit({ level: e.target.value, class: '' })}
                        className={selectClass}
                    >
                        <option value="">{t('Any level')}</option>
                        {levels.map((level) => (
                            <option key={level.id} value={level.id}>
                                {level.name}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label={t('Class')}
                        value={filters.class}
                        onChange={(e) => visit({ class: e.target.value })}
                        className={selectClass}
                    >
                        <option value="">{t('Any class')}</option>
                        {shownClasses.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                    {(filters.level || filters.class) && (
                        <button
                            type="button"
                            onClick={() => visit({ level: '', class: '' })}
                            className="px-2 text-[13px] font-medium text-primary hover:underline"
                        >
                            {t('Clear')}
                        </button>
                    )}
                </div>
            )}

            {counts.total === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
                    <p className="text-[13px] leading-[19px] text-text">
                        {t('No students yet. Register one at a time, or bring in a whole intake from a spreadsheet.')}
                    </p>
                    <Link href={importPage.url()} className={outlineButtonClass}>
                        {t('Import students')}
                    </Link>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto lg:overflow-visible">
                        <div className="flex min-w-[1040px] flex-col rounded-lg border border-solid border-border">
                            <div className="flex h-9 shrink-0 items-center gap-4 rounded-t-lg border-b border-solid border-border bg-surface px-4">
                                <span className={`${headClass} min-w-[250px] flex-1`}>{t('Student')}</span>
                                <span className={`${headClass} w-[130px]`}>{t('Class')}</span>
                                <span className={`${headClass} w-20`}>{t('Series')}</span>
                                <span className={`${headClass} w-[230px]`}>{t('Guardian')}</span>
                                <span className={`${headClass} w-[120px]`}>{t('Fees')}</span>
                                <span className={`${headClass} w-[130px] text-right`}>{t('Balance')}</span>
                                <span className="w-10 shrink-0" />
                            </div>
                            {students.rows.length === 0 && (
                                <p className="px-4 py-8 text-center text-[13px] text-text-muted">
                                    {t('No student matches. Try another name, or clear the filters.')}
                                </p>
                            )}
                            {students.rows.map((row) => (
                                <div
                                    key={row.id}
                                    onClick={() => router.visit(show.url(row.id))}
                                    className="flex h-14 shrink-0 cursor-pointer items-center gap-4 border-b border-solid border-border px-4 last:rounded-b-lg last:border-b-0 hover:bg-surface"
                                >
                                    <span className="flex min-w-[250px] flex-1 items-center gap-[10px]">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] leading-[14px] font-semibold text-primary">
                                            {row.initials}
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <Link
                                                href={show.url(row.id)}
                                                onClick={(event) => event.stopPropagation()}
                                                className="truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                                            >
                                                {row.name}
                                            </Link>
                                            <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                                {row.matricule}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="w-[130px] shrink-0 truncate text-[14px] leading-[18px] text-text">
                                        {row.class ?? '—'}
                                    </span>
                                    <span className="flex w-20 shrink-0 items-center">
                                        {row.series ? (
                                            <StreamChip stream={row.series.stream}>
                                                {row.series.code}
                                            </StreamChip>
                                        ) : row.needs_series ? (
                                            <span className="flex items-center gap-[6px] text-[13px] leading-4 text-[#8A5A12]">
                                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                                {t('None')}
                                            </span>
                                        ) : (
                                            <span className="text-text-muted">—</span>
                                        )}
                                    </span>
                                    <span className="flex w-[230px] shrink-0 flex-col">
                                        <span className="truncate text-[13px] leading-[18px] text-text">
                                            {row.guardian}
                                        </span>
                                        <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                            {row.phone}
                                        </span>
                                    </span>
                                    <span className="flex w-[120px] shrink-0">
                                        <FeePill status={row.fees} />
                                    </span>
                                    <span className="w-[130px] shrink-0 text-right font-mono text-[14px] leading-[18px] text-text">
                                        {row.balance > 0 ? money(row.balance, currency) : '–'}
                                    </span>
                                    <span className="relative flex w-10 shrink-0 justify-center">
                                        <button
                                            type="button"
                                            aria-label={t('Actions for :row', { row: row.name })}
                                            aria-expanded={openMenu === row.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setOpenMenu(openMenu === row.id ? null : row.id);
                                            }}
                                            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-primary-tint"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 16 16">
                                                <circle cx="3" cy="8" r="1" fill="none" stroke="#56625C" strokeWidth="1.6" />
                                                <circle cx="8" cy="8" r="1" fill="none" stroke="#56625C" strokeWidth="1.6" />
                                                <circle cx="13" cy="8" r="1" fill="none" stroke="#56625C" strokeWidth="1.6" />
                                            </svg>
                                        </button>
                                        {openMenu === row.id && (
                                            <span
                                                role="menu"
                                                onClick={(event) => event.stopPropagation()}
                                                className="absolute top-full right-0 z-10 mt-1 flex w-[170px] flex-col rounded-md border border-solid border-border bg-white p-1 shadow-[0_8px_24px_rgba(16,25,21,0.12)]"
                                            >
                                                <Link role="menuitem" href={show.url(row.id)} className="flex h-8 items-center rounded-sm px-3 text-[13px] text-text hover:bg-surface">
                                                    {t('Open record')}
                                                </Link>
                                                <Link role="menuitem" href={edit.url(row.id)} className="flex h-8 items-center rounded-sm px-3 text-[13px] text-text hover:bg-surface">
                                                    {t('Edit student')}
                                                </Link>
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-[13px] text-text-muted">
                            {t(':rows of :total shown · sorted by class', { rows: students.rows.length, total: money(students.total) })}
                        </p>
                        {students.lastPage > 1 && (
                            <div className="flex items-center gap-1">
                                {pageList(students.lastPage, students.page).map((page, position) =>
                                    page === 'gap' ? (
                                        <span key={`gap-${position}`} className="px-1 text-[13px] text-text-muted">
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={page}
                                            type="button"
                                            aria-current={page === students.page ? 'page' : undefined}
                                            onClick={() => visit({ page })}
                                            className={`flex h-7 items-center rounded-md px-3 text-[13px] ${
                                                page === students.page
                                                    ? 'border border-solid border-primary bg-primary-tint font-semibold text-primary'
                                                    : 'text-text hover:bg-surface'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(StudentRoster);
