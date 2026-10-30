import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    create,
    edit,
    exportMethod,
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
import {
    BulkBar,
    Checkbox,
    DownloadIcon,
    ExportDialog,
    type FilterField,
    FilterChips,
    type FilterValues,
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
    q: string;
    fees: string[];
    series: string[];
    level: string;
    class: string[];
    gender: string;
    from: string;
    to: string;
    sort: string;
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
    termStartsOn: string | null;
    filters: Filters;
    levels: { id: string; name: string }[];
    classes: { id: string; name: string; level_id: string }[];
    series: { id: string; code: string; stream: string }[];
    students: {
        rows: StudentRow[];
        page: number;
        lastPage: number;
        total: number;
        perPage: number;
        from: number | null;
        to: number | null;
    };
}

const headClass =
    'shrink-0 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

function StudentRoster({
    yearLabel,
    currency,
    counts,
    termStartsOn,
    filters,
    levels,
    classes,
    series,
    students,
}: RosterProps) {
    const { sort, ...values } = filters;
    const table = useTableQuery((query) => index.url({ query }), values, {
        sort,
        per_page: students.perPage,
    });
    const selection = useSelection(students.rows.map((row) => row.id));
    const [exporting, setExporting] = useState<'toolbar' | 'selected' | null>(
        null,
    );
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const shownClasses = values.level
        ? classes.filter((option) => option.level_id === values.level)
        : classes;

    const fields: FilterField[] = [
        {
            kind: 'chips',
            key: 'fees',
            label: t('Fees'),
            options: [
                { value: 'paid', label: t('Paid') },
                { value: 'partial', label: t('Partial') },
                { value: 'due', label: t('Due') },
                { value: 'overdue', label: t('Overdue') },
                { value: 'none', label: t('No invoice') },
            ],
        },
        {
            kind: 'select',
            key: 'level',
            label: t('Level'),
            anyLabel: t('Any level'),
            options: levels.map((level) => ({
                value: level.id,
                label: level.name,
            })),
        },
        {
            kind: 'chips',
            key: 'class',
            label: t('Class'),
            options: shownClasses.map((option) => ({
                value: option.id,
                label: option.name,
            })),
        },
        ...(series.length > 0
            ? [
                  {
                      kind: 'chips' as const,
                      key: 'series',
                      label: t('Series'),
                      options: [
                          ...series.map((option) => ({
                              value: option.code,
                              label: option.code,
                          })),
                          { value: 'none', label: t('No series') },
                      ],
                  },
              ]
            : []),
        {
            kind: 'segments',
            key: 'gender',
            label: t('Gender'),
            anyLabel: t('Any'),
            options: [
                { value: 'female', label: t('Girls') },
                { value: 'male', label: t('Boys') },
            ],
        },
        { kind: 'dates', from: 'from', to: 'to', label: t('Admitted') },
    ];

    const quickPicks: QuickPick[] = [
        {
            label: t('Overdue fees'),
            count: counts.overdue,
            dot: 'bg-danger',
            values: { fees: ['overdue'] },
        },
        ...(series.length > 0
            ? [
                  {
                      label: t('No series'),
                      count: counts.no_series,
                      dot: 'bg-warning',
                      values: { series: ['none'] },
                  },
              ]
            : []),
        ...(termStartsOn
            ? [
                  {
                      label: t('New this term'),
                      count: counts.new,
                      values: { from: termStartsOn, to: '' },
                  },
              ]
            : []),
    ];

    /** A level change drops classes that are not in it. */
    function filter(patch: FilterValues) {
        if (typeof patch.level === 'string' && patch.level !== values.level) {
            const kept = values.class.filter((id) =>
                classes.some(
                    (option) =>
                        option.id === id &&
                        (!patch.level || option.level_id === patch.level),
                ),
            );
            table.set({ ...patch, class: kept });
        } else {
            table.set(patch);
        }
        selection.clear();
    }

    useEffect(() => {
        function close() {
            setOpenMenu(null);
        }

        document.addEventListener('click', close);

        return () => document.removeEventListener('click', close);
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <Head title={t('Students')} />
            <StudentHeader
                trail={[{ label: t('Roster') }]}
                title={t('Students')}
                tag={t('Enrolment:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t(':total students · :classes classes', {
                    total: money(counts.total),
                    classes: counts.classes,
                })}
                action={
                    <div className="flex gap-2">
                        <Link
                            href={importPage.url()}
                            className={`${outlineButtonClass} gap-2`}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                className="shrink-0"
                            >
                                <path
                                    d="M12 15V4M7 9l5-5 5 5M4 17v3h16v-3"
                                    fill="none"
                                    stroke="#101915"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
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

            {counts.total === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
                    <p className="text-[13px] leading-[19px] text-text">
                        {t(
                            'No students yet. Register one at a time, or bring in a whole intake from a spreadsheet.',
                        )}
                    </p>
                    <Link
                        href={importPage.url()}
                        className={outlineButtonClass}
                    >
                        {t('Import students')}
                    </Link>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-3">
                        {selection.ids.length > 0 || selection.allMatching ? (
                            <BulkBar
                                selected={selection.ids.length}
                                total={students.total}
                                allMatching={selection.allMatching}
                                onSelectAll={selection.selectAllMatching}
                                onClear={selection.clear}
                            >
                                <button
                                    type="button"
                                    onClick={() => setExporting('selected')}
                                    className={bulkButtonClass}
                                >
                                    <DownloadIcon colour="#FFFFFF" />
                                    {t('Export :count', {
                                        count: count(
                                            selection.allMatching
                                                ? students.total
                                                : selection.ids.length,
                                        ),
                                    })}
                                </button>
                            </BulkBar>
                        ) : (
                            <TableToolbar
                                searchLabel={t('Search students')}
                                searchPlaceholder={t(
                                    'Name, matricule or phone',
                                )}
                                search={table.search}
                                onSearch={(value) => {
                                    table.onSearch(value);
                                    selection.clear();
                                }}
                                filterTitle={t('Filter students')}
                                fields={fields}
                                quickPicks={quickPicks}
                                values={values}
                                onFilter={filter}
                                sorts={[
                                    { value: 'class', label: t('Class') },
                                    { value: 'name', label: t('Name') },
                                    {
                                        value: 'matricule',
                                        label: t('Matricule'),
                                    },
                                    {
                                        value: '-admitted',
                                        label: t('Newest first'),
                                    },
                                ]}
                                sort={sort}
                                onSort={table.sort}
                                countLabel={t(':count students', {
                                    count: count(students.total),
                                })}
                                total={students.total}
                                onExport={() => setExporting('toolbar')}
                            />
                        )}
                        <FilterChips
                            fields={fields}
                            values={values}
                            onFilter={filter}
                        />
                    </div>

                    <div className="overflow-x-auto xl:overflow-visible">
                        <div className="flex min-w-[912px] flex-col rounded-lg border border-solid border-border">
                            <div className="flex h-9 shrink-0 items-center gap-3 rounded-t-lg border-b border-solid border-border bg-surface px-4">
                                <span className="flex w-4 shrink-0">
                                    <Checkbox
                                        label={t('Select this page')}
                                        checked={selection.pageState === 'all'}
                                        mixed={selection.pageState === 'some'}
                                        onChange={selection.togglePage}
                                    />
                                </span>
                                <span
                                    className={`${headClass} min-w-[200px] flex-[3]`}
                                >
                                    {t('Student')}
                                </span>
                                <span className={`${headClass} w-[100px]`}>
                                    {t('Class')}
                                </span>
                                <span className={`${headClass} w-16`}>
                                    {t('Series')}
                                </span>
                                <span
                                    className={`${headClass} min-w-[160px] flex-[2]`}
                                >
                                    {t('Guardian')}
                                </span>
                                <span className={`${headClass} w-[112px]`}>
                                    {t('Fees')}
                                </span>
                                <span
                                    className={`${headClass} w-[110px] text-right`}
                                >
                                    {t('Balance')}
                                </span>
                                <span className="w-8 shrink-0" />
                            </div>
                            {students.rows.length === 0 && (
                                <p className="px-4 py-8 text-center text-[13px] text-text-muted">
                                    {t(
                                        'No student matches. Try another name, or clear the filters.',
                                    )}
                                </p>
                            )}
                            {students.rows.map((row) => (
                                <div
                                    key={row.id}
                                    onClick={() =>
                                        router.visit(show.url(row.id))
                                    }
                                    className={`flex h-14 shrink-0 cursor-pointer items-center gap-3 border-b border-solid border-border px-4 last:rounded-b-lg last:border-b-0 ${
                                        selection.has(row.id)
                                            ? 'bg-primary-tint/60'
                                            : 'hover:bg-surface'
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
                                    <span className="flex min-w-[200px] flex-[3] items-center gap-[10px]">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] leading-[14px] font-semibold text-primary">
                                            {row.initials}
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <Link
                                                href={show.url(row.id)}
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                                className="truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                                            >
                                                {row.name}
                                            </Link>
                                            <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                                {row.matricule}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="w-[100px] shrink-0 truncate text-[14px] leading-[18px] text-text">
                                        {row.class ?? '—'}
                                    </span>
                                    <span className="flex w-16 shrink-0 items-center">
                                        {row.series ? (
                                            <StreamChip
                                                stream={row.series.stream}
                                            >
                                                {row.series.code}
                                            </StreamChip>
                                        ) : row.needs_series ? (
                                            <span className="flex items-center gap-[6px] text-[13px] leading-4 text-[#8A5A12]">
                                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                                {t('None')}
                                            </span>
                                        ) : (
                                            <span className="text-text-muted">
                                                —
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex min-w-[160px] flex-[2] flex-col">
                                        <span className="truncate text-[13px] leading-[18px] text-text">
                                            {row.guardian}
                                        </span>
                                        <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                            {row.phone}
                                        </span>
                                    </span>
                                    <span className="flex w-[112px] shrink-0">
                                        <FeePill status={row.fees} />
                                    </span>
                                    <span className="w-[110px] shrink-0 text-right font-mono text-[14px] leading-[18px] text-text">
                                        {row.balance > 0
                                            ? money(row.balance, currency)
                                            : '–'}
                                    </span>
                                    <span className="relative flex w-8 shrink-0 justify-center">
                                        <button
                                            type="button"
                                            aria-label={t('Actions for :row', {
                                                row: row.name,
                                            })}
                                            aria-expanded={openMenu === row.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setOpenMenu(
                                                    openMenu === row.id
                                                        ? null
                                                        : row.id,
                                                );
                                            }}
                                            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-primary-tint"
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                            >
                                                <circle
                                                    cx="3"
                                                    cy="8"
                                                    r="1"
                                                    fill="none"
                                                    stroke="#56625C"
                                                    strokeWidth="1.6"
                                                />
                                                <circle
                                                    cx="8"
                                                    cy="8"
                                                    r="1"
                                                    fill="none"
                                                    stroke="#56625C"
                                                    strokeWidth="1.6"
                                                />
                                                <circle
                                                    cx="13"
                                                    cy="8"
                                                    r="1"
                                                    fill="none"
                                                    stroke="#56625C"
                                                    strokeWidth="1.6"
                                                />
                                            </svg>
                                        </button>
                                        {openMenu === row.id && (
                                            <span
                                                role="menu"
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
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
                                                    {t('Edit student')}
                                                </Link>
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <TableFooter
                        paged={students}
                        onPage={table.page}
                        onPerPage={table.perPage}
                    />
                </>
            )}

            {exporting && (
                <ExportDialog
                    title={t('Export students')}
                    subtitle={t(':year · as filtered on screen', {
                        year: yearLabel ?? t('Students'),
                    })}
                    noun={t('students')}
                    matching={students.total}
                    selected={selection.allMatching ? 'all' : selection.ids}
                    everyone={counts.total}
                    columns={[
                        { key: 'name', label: t('Name'), on: true },
                        { key: 'matricule', label: t('Matricule'), on: true },
                        { key: 'class', label: t('Class'), on: true },
                        { key: 'series', label: t('Series'), on: true },
                        { key: 'gender', label: t('Gender'), on: false },
                        {
                            key: 'date_of_birth',
                            label: t('Date of birth'),
                            on: false,
                        },
                        { key: 'guardian', label: t('Guardian'), on: true },
                        { key: 'phone', label: t('Guardian phone'), on: true },
                        { key: 'fees', label: t('Fees'), on: true },
                        { key: 'balance', label: t('Balance'), on: true },
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
                    onClose={() => setExporting(null)}
                />
            )}
        </div>
    );
}

export default withAppShell(StudentRoster);
