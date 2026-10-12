import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    create,
    edit,
    index,
    show,
    templates,
} from '@/actions/App/Http/Controllers/SubjectController';
import {
    PlusIcon,
    StructureHeader,
    StructureTabs,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface SubjectRow {
    id: string;
    name: string;
    code: string;
    department: string;
    kind: string;
    levels: string[];
    coefficient: number | null;
    classes: number;
    teachers: number;
    unstaffed: number;
    not_taught: string[];
    periods: number;
}

interface Filters {
    department: string;
    needs: boolean;
    level: string;
    q: string;
}

interface RosterProps {
    yearLabel: string | null;
    counts: { total: number; departments: number; needs_teacher: number };
    departments: string[];
    levels: { id: string; name: string }[];
    filters: Filters;
    subjects: {
        rows: SubjectRow[];
        page: number;
        lastPage: number;
        total: number;
    };
}

const headClass =
    'shrink-0 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

function tabClass(selected: boolean): string {
    return `flex h-8 items-center gap-2 rounded-md border border-solid px-3 text-[13px] ${
        selected
            ? 'border-primary bg-primary-tint font-semibold text-primary'
            : 'border-border bg-white font-medium text-text hover:bg-surface'
    }`;
}

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? t(one) : t(many)}`;
}

function Staffing({ row }: { row: SubjectRow }) {
    if (row.classes === 0) {
        return (
            <span className="flex items-center gap-[6px] text-[13px] leading-4 text-text">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                {t('No classes yet')}
            </span>
        );
    }

    if (row.not_taught.length > 0 && row.unstaffed === 0) {
        return (
            <span className="flex items-start gap-[6px] text-[13px] leading-4 text-text">
                <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                <span>
                    {plural(row.classes, 'class', 'classes')} {t('· in a series but not taught in')}{' '}
                    {row.not_taught.join(', ')}
                </span>
            </span>
        );
    }

    if (row.unstaffed > 0) {
        return (
            <span className="flex items-center gap-[6px] text-[13px] leading-4 text-text">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                {plural(row.classes, 'class', 'classes')} ·{' '}
                {row.teachers === 0
                    ? t('no teacher yet')
                    : t(':unstaffed without a teacher', { unstaffed: row.unstaffed })}
            </span>
        );
    }

    return (
        <span className="text-[13px] leading-4 text-text">
            {plural(row.classes, 'class', 'classes')} ·{' '}
            {plural(row.teachers, 'teacher', 'teachers')}
        </span>
    );
}

function SubjectRoster({ yearLabel, counts, departments, levels, filters, subjects }: RosterProps) {
    const [search, setSearch] = useState(filters.q);
    const [showFilters, setShowFilters] = useState(filters.level !== '');
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function visit(patch: Partial<Filters> & { page?: number }) {
        const next = { ...filters, ...patch };
        const query: Record<string, string | number> = {};

        if (next.department) {
            query.department = next.department;
        }
        if (next.needs) {
            query.needs = 1;
        }
        if (next.level) {
            query.level = next.level;
        }
        if (next.q) {
            query.q = next.q;
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
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-7">
            <Head title={t('The subject roster')} />
            <StructureHeader
                trail={[{ label: t('Subjects') }]}
                title={t('The subject roster')}
                tag={t('Subjects:year_label', { year_label: yearLabel ? ` · ${yearLabel}` : '' })}
                meta={t(':subjects · :departments · :needs_teacher :need a teacher', { subjects: plural(counts.total, 'subject', 'subjects'), departments: plural(counts.departments, 'department', 'departments'), needs_teacher: counts.needs_teacher, need: counts.needs_teacher === 1 ? 'needs' : 'need' })}
            />
            <StructureTabs active="subjects" />

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        aria-pressed={!filters.department && !filters.needs}
                        onClick={() => visit({ department: '', needs: false })}
                        className={tabClass(!filters.department && !filters.needs)}
                    >
                        {t('All subjects')}
                    </button>
                    {departments.map((department) => (
                        <button
                            key={department}
                            type="button"
                            aria-pressed={filters.department === department}
                            onClick={() => visit({ department, needs: false })}
                            className={tabClass(filters.department === department)}
                        >
                            {department}
                        </button>
                    ))}
                    <button
                        type="button"
                        aria-pressed={filters.needs}
                        onClick={() => visit({ department: '', needs: true })}
                        className={tabClass(filters.needs)}
                    >
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                        {t('Needs teacher')}
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex h-9 w-[260px] items-center gap-2 rounded-md border border-solid border-border bg-white px-3 focus-within:border-primary">
                        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                            <circle cx="11" cy="11" r="7" fill="none" stroke="#56625C" strokeWidth="2" />
                            <path d="M16.5 16.5L21 21" fill="none" stroke="#56625C" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <input
                            type="search"
                            aria-label={t('Search subjects')}
                            placeholder={t('A subject, code or teacher')}
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
                        {t('Filter')}{filters.level ? ' · 1' : ''}
                    </button>
                    <Link href={create.url()} className={solidButtonClass}>
                        <PlusIcon />
                        {t('Add subject')}
                    </Link>
                </div>
            </div>

            {showFilters && (
                <div className="-mt-3 flex flex-wrap items-center gap-2">
                    <select
                        aria-label={t('Level')}
                        value={filters.level}
                        onChange={(e) => visit({ level: e.target.value })}
                        className="h-9 rounded-md border border-solid border-border bg-white px-3 text-[13px] text-text outline-none focus:border-primary"
                    >
                        <option value="">{t('Any level')}</option>
                        {levels.map((level) => (
                            <option key={level.id} value={level.id}>
                                {level.name}
                            </option>
                        ))}
                    </select>
                    {filters.level && (
                        <button
                            type="button"
                            onClick={() => visit({ level: '' })}
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
                        {t('No subjects yet. Register one from scratch, or start from a prepared set and give each subject its classes and teachers in one go.')}
                    </p>
                    <Link href={templates.url()} className={outlineButtonClass}>
                        {t('Use a template')}
                    </Link>
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-4">
                    <div className="overflow-x-auto lg:overflow-visible">
                        <div className="flex min-w-[1080px] flex-col rounded-lg border border-solid border-border bg-white">
                            <div className="flex items-center gap-4 rounded-t-lg border-b border-solid border-border bg-surface px-4 py-2">
                                <span className={`${headClass} min-w-[200px] flex-1`}>{t('Subject')}</span>
                                <span className={`${headClass} w-[88px]`}>{t('Code')}</span>
                                <span className={`${headClass} w-[120px]`}>{t('Department')}</span>
                                <span className={`${headClass} w-[130px]`}>{t('Levels')}</span>
                                <span className={`${headClass} w-16`}>{t('Coeff.')}</span>
                                <span className={`${headClass} w-[220px]`}>{t('Classes & teachers')}</span>
                                <span className={`${headClass} w-[100px]`}>{t('Periods')}</span>
                                <span className="w-10 shrink-0" />
                            </div>
                            {subjects.rows.length === 0 && (
                                <p className="px-4 py-8 text-center text-[13px] text-text-muted">
                                    {t('No subject matches. Try another name, or clear the filters.')}
                                </p>
                            )}
                            {subjects.rows.map((row) => (
                                <div
                                    key={row.id}
                                    onClick={() => router.visit(show.url(row.id))}
                                    className="flex h-[62px] shrink-0 cursor-pointer items-center gap-4 border-b border-solid border-border px-4 py-2 last:rounded-b-lg last:border-b-0 hover:bg-surface"
                                >
                                    <span className="flex min-w-[200px] flex-1 flex-col">
                                        <Link
                                            href={show.url(row.id)}
                                            onClick={(event) => event.stopPropagation()}
                                            className="truncate text-[16px] leading-5 font-medium text-text hover:underline"
                                        >
                                            {row.name}
                                        </Link>
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {row.kind}
                                        </span>
                                    </span>
                                    <span className="w-[88px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {row.code}
                                    </span>
                                    <span className="w-[120px] shrink-0 truncate text-[13px] leading-4 text-text">
                                        {row.department}
                                    </span>
                                    <span className="w-[130px] shrink-0 truncate text-[13px] leading-4 text-text-muted">
                                        {row.levels.join(', ') || '—'}
                                    </span>
                                    <span className="w-16 shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {row.coefficient ?? '—'}
                                    </span>
                                    <span className="w-[220px] shrink-0">
                                        <Staffing row={row} />
                                    </span>
                                    <span className="w-[100px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {t(':periods / wk', { periods: row.periods })}
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
                                                <Link
                                                    role="menuitem"
                                                    href={show.url(row.id)}
                                                    className="flex h-8 items-center rounded-sm px-3 text-[13px] text-text hover:bg-surface"
                                                >
                                                    {t('Open record')}
                                                </Link>
                                                <Link
                                                    role="menuitem"
                                                    href={edit.url(row.id)}
                                                    className="flex h-8 items-center rounded-sm px-3 text-[13px] text-text hover:bg-surface"
                                                >
                                                    {t('Edit subject')}
                                                </Link>
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
                        <p className="text-[13px] text-text-muted">
                            {t(':rows of :total shown · sorted by code', { rows: subjects.rows.length, total: subjects.total })}
                        </p>
                        <div className="flex items-center gap-2">
                            {subjects.lastPage > 1 &&
                                Array.from({ length: subjects.lastPage }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        type="button"
                                        aria-current={page === subjects.page ? 'page' : undefined}
                                        onClick={() => visit({ page })}
                                        className={`flex h-7 items-center rounded-md px-3 text-[13px] text-primary ${
                                            page === subjects.page
                                                ? 'border border-solid border-primary bg-primary-tint font-semibold'
                                                : 'hover:bg-surface'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            <span className="text-[13px] text-text-muted">
                                {plural(counts.total, 'subject', 'subjects')}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withAppShell(SubjectRoster);
