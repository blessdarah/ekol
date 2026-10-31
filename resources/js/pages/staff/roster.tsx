import { TableRowMenu, TableEmptyState } from '../../components/table/ui';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    access,
    remind,
} from '@/actions/App/Http/Controllers/StaffAccessController';
import {
    create,
    edit,
    show,
} from '@/actions/App/Http/Controllers/StaffController';
import { exportMethod } from '@/actions/App/Http/Controllers/StaffRosterController';
import { index } from '@/actions/App/Http/Controllers/StaffRosterController';
import {
    Avatar,
    EMPLOYMENT_LABELS,
    GENDER_LABELS,
    PageHeader,
    StatusDot,
} from '../../components/staff/ui';
import {
    BulkBar,
    Checkbox,
    DownloadIcon,
    ExportDialog,
    type FilterField,
    FilterChips,
    type QuickPick,
    TableFooter,
    TableToolbar,
    bulkButtonClass,
    count,
    toQuery,
    useSelection,
    useTableQuery,
} from '../../components/table/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

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
    q: string;
    employment: string[];
    portal: string[];
    role: string[];
    gender: string;
    sort: string;
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
        perPage: number;
        from: number | null;
        to: number | null;
    };
}

const headCellClass =
    'shrink-0 text-[12px] leading-[1.35] font-semibold tracking-[0.06em] text-text-muted';

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
        <TableRowMenu
            className="w-10"
            label={t('Actions for :row', { row: row.name })}
            open={open}
            onToggle={onToggle}
            onClose={onToggle}
        >
            <Link role="menuitem" href={show.url(row.id)} className={itemClass}>
                {t('Open record')}
            </Link>
            <Link role="menuitem" href={edit.url(row.id)} className={itemClass}>
                {t('Edit details')}
            </Link>
            <Link
                role="menuitem"
                href={access.url(row.id)}
                className={itemClass}
            >
                {t('Portal access')}
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
                    {t('Send a reminder')}
                </button>
            )}
        </TableRowMenu>
    );
}

function Roster({ yearLabel, counts, filters, roles, staff }: RosterProps) {
    const { sort, ...values } = filters;
    const table = useTableQuery((query) => index.url({ query }), values, {
        sort,
        per_page: staff.perPage,
    });
    const selection = useSelection(staff.rows.map((row) => row.id));
    const [exporting, setExporting] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    const fields: FilterField[] = [
        {
            kind: 'chips',
            key: 'employment',
            label: t('Employment'),
            options: [
                { value: 'government', label: t('Government employee') },
                { value: 'school_paid', label: t('School-paid') },
            ],
        },
        {
            kind: 'chips',
            key: 'role',
            label: t('Portal role'),
            options: roles.map((role) => ({
                value: role.value,
                label: t(role.label),
            })),
        },
        {
            kind: 'chips',
            key: 'portal',
            label: t('Portal'),
            options: [
                { value: 'on', label: t('Portal on') },
                { value: 'none', label: t('No account yet') },
            ],
        },
        {
            kind: 'segments',
            key: 'gender',
            label: t('Gender'),
            anyLabel: t('Any'),
            options: [
                { value: 'female', label: t('Female') },
                { value: 'male', label: t('Male') },
            ],
        },
    ];

    const quickPicks: QuickPick[] = [
        {
            label: t('Government employees'),
            count: counts.government,
            values: { employment: ['government'] },
        },
        {
            label: t('School-paid'),
            count: counts.school_paid,
            values: { employment: ['school_paid'] },
        },
        {
            label: t('No account yet'),
            count: counts.no_account,
            dot: 'bg-warning',
            values: { portal: ['none'] },
        },
    ];

    function filter(patch: Record<string, string | string[]>) {
        table.set(patch);
        selection.clear();
    }

    return (
        <div className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('The staff roster')} />
            <PageHeader
                crumb="Roster"
                title={t('The staff roster')}
                tag={t('Roster:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t(
                    ':total staff · :government government employees · :school_paid school-paid · :no_account with no account yet',
                    {
                        total: counts.total,
                        government: counts.government,
                        school_paid: counts.school_paid,
                        no_account: counts.no_account,
                    },
                )}
                action={
                    <Link
                        href={create.url()}
                        className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14">
                            <path
                                d="M7 2.4v9.2M2.4 7h9.2"
                                fill="none"
                                stroke="var(--color-bg)"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                            />
                        </svg>
                        {t('Add a staff member')}
                    </Link>
                }
            />

            <div className="flex flex-col gap-3">
                {selection.ids.length > 0 || selection.allMatching ? (
                    <BulkBar
                        selected={selection.ids.length}
                        total={staff.total}
                        allMatching={selection.allMatching}
                        onSelectAll={selection.selectAllMatching}
                        onClear={selection.clear}
                    >
                        <button
                            type="button"
                            onClick={() => setExporting(true)}
                            className={bulkButtonClass}
                        >
                            <DownloadIcon colour="var(--color-bg)" />
                            {t('Export :count', {
                                count: count(
                                    selection.allMatching
                                        ? staff.total
                                        : selection.ids.length,
                                ),
                            })}
                        </button>
                    </BulkBar>
                ) : (
                    <TableToolbar
                        searchLabel={t('Search staff')}
                        searchPlaceholder={t('A name, a subject or a town')}
                        search={table.search}
                        onSearch={(value) => {
                            table.onSearch(value);
                            selection.clear();
                        }}
                        filterTitle={t('Filter staff')}
                        fields={fields}
                        quickPicks={quickPicks}
                        values={values}
                        onFilter={filter}
                        sorts={[
                            { value: 'name', label: t('Family name') },
                            { value: 'role', label: t('Portal role') },
                            { value: '-joined', label: t('Newest first') },
                        ]}
                        sort={sort}
                        onSort={table.sort}
                        countLabel={t(':total staff', {
                            total: count(staff.total),
                        })}
                        total={staff.total}
                        onExport={() => setExporting(true)}
                    />
                )}
                <FilterChips
                    fields={fields}
                    values={values}
                    onFilter={filter}
                />
            </div>

            <div className="flex flex-1 flex-col gap-4">
                <div className="overflow-x-auto xl:overflow-visible">
                    <div className="flex min-w-[920px] flex-col rounded-lg border border-solid border-border bg-white">
                        <div className="flex items-center gap-3 rounded-t-lg border-b border-solid border-border bg-surface px-4 py-2">
                            <span className="flex w-4 shrink-0">
                                <Checkbox
                                    label={t('Select this page')}
                                    checked={selection.pageState === 'all'}
                                    mixed={selection.pageState === 'some'}
                                    onChange={selection.togglePage}
                                />
                            </span>
                            <span className={`${headCellClass} min-w-0 flex-1`}>
                                {t('Staff member')}
                            </span>
                            <span className={`${headCellClass} w-[88px]`}>
                                {t('Gender')}
                            </span>
                            <span className={`${headCellClass} w-[150px]`}>
                                {t('Employment')}
                            </span>
                            <span className={`${headCellClass} w-[200px]`}>
                                {t('Contact')}
                            </span>
                            <span className={`${headCellClass} w-[140px]`}>
                                {t('Portal')}
                            </span>
                            <span className="w-10 shrink-0" />
                        </div>
                        {staff.rows.length === 0 && (
                            <TableEmptyState>
                                {t(
                                    'Nobody on the roster matches. Try another name, or clear the filters.',
                                )}
                            </TableEmptyState>
                        )}
                        {staff.rows.map((row, position) => (
                            <div
                                key={row.id}
                                onClick={() => router.visit(show.url(row.id))}
                                className={`flex cursor-pointer items-center gap-3 border-b border-solid border-border px-4 py-3 last:rounded-b-lg last:border-b-0 hover:bg-surface ${
                                    selection.has(row.id)
                                        ? 'bg-primary-tint/60'
                                        : position % 2 === 1
                                          ? 'bg-row-alt'
                                          : 'bg-white'
                                }`}
                            >
                                <span className="flex w-4 shrink-0">
                                    <Checkbox
                                        label={t('Select :row', {
                                            row: row.name,
                                        })}
                                        checked={selection.has(row.id)}
                                        onChange={() =>
                                            selection.toggle(row.id)
                                        }
                                    />
                                </span>
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <Avatar
                                        initials={row.initials}
                                        photoUrl={row.photo_url}
                                        size={36}
                                    />
                                    <div className="flex min-w-0 flex-col">
                                        <Link
                                            href={show.url(row.id)}
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                            className="truncate text-[14px] leading-[1.35] font-semibold text-text hover:underline"
                                        >
                                            {row.name}
                                        </Link>
                                        <span className="truncate text-[13px] leading-[1.35] text-text-muted">
                                            {[
                                                row.role_label,
                                                row.subjects.join(', '),
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </div>
                                </div>
                                <span className="w-[88px] shrink-0 text-[14px] text-text">
                                    {row.gender
                                        ? GENDER_LABELS[row.gender]
                                        : '—'}
                                </span>
                                <span className="w-[150px] shrink-0 text-[14px] text-text">
                                    {row.employment_type
                                        ? EMPLOYMENT_LABELS[row.employment_type]
                                        : '—'}
                                </span>
                                <span className="flex w-[200px] shrink-0 flex-col">
                                    <span className="truncate text-[14px] leading-[1.35] text-text">
                                        {row.email}
                                    </span>
                                    <span className="text-[13px] leading-[1.35] text-text-muted">
                                        {row.phone}
                                    </span>
                                </span>
                                <span className="flex w-[140px] shrink-0 items-center gap-2 text-[13px] text-text">
                                    <StatusDot
                                        tone={
                                            row.has_account
                                                ? 'success'
                                                : 'warning'
                                        }
                                    />
                                    {row.has_account
                                        ? t('Portal on')
                                        : t('No account yet')}
                                </span>
                                <RowMenu
                                    row={row}
                                    open={openMenu === row.id}
                                    onToggle={() =>
                                        setOpenMenu(
                                            openMenu === row.id ? null : row.id,
                                        )
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto">
                    <TableFooter
                        paged={staff}
                        onPage={table.page}
                        onPerPage={table.perPage}
                    />
                </div>
            </div>

            {exporting && (
                <ExportDialog
                    title={t('Export staff')}
                    subtitle={t(':year · as filtered on screen', {
                        year: yearLabel ?? t('Staff'),
                    })}
                    noun={t('staff')}
                    matching={staff.total}
                    selected={selection.allMatching ? 'all' : selection.ids}
                    everyone={counts.total}
                    columns={[
                        { key: 'name', label: t('Name'), on: true },
                        {
                            key: 'staff_code',
                            label: t('Staff code'),
                            on: false,
                        },
                        { key: 'role', label: t('Portal role'), on: true },
                        { key: 'subjects', label: t('Subjects'), on: true },
                        { key: 'gender', label: t('Gender'), on: true },
                        { key: 'employment', label: t('Employment'), on: true },
                        { key: 'email', label: t('Email'), on: true },
                        { key: 'phone', label: t('Phone'), on: true },
                        { key: 'portal', label: t('Portal'), on: true },
                        { key: 'joined_on', label: t('Joined'), on: false },
                    ]}
                    href={({ scope, format, columns }) =>
                        exportMethod.url({
                            query: toQuery(scope === 'everyone' ? {} : values, {
                                sort,
                                format:
                                    format === 'print' ? 'print' : undefined,
                                columns: columns.join(','),
                                ids:
                                    scope === 'selected' &&
                                    !selection.allMatching
                                        ? selection.ids.join(',')
                                        : undefined,
                            }),
                        })
                    }
                    onClose={() => setExporting(false)}
                />
            )}
        </div>
    );
}

export default withAppShell(Roster);
