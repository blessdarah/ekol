import {
    TableRowMenu,
    TableEmptyState,
    tableRowClass,
} from '../../components/table/ui';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    create,
    edit,
} from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import {
    exportMethod,
    index,
    show,
} from '@/actions/App/Http/Controllers/SubjectController';
import { templates } from '@/actions/App/Http/Controllers/SubjectTemplateController';
import {
    PlusIcon,
    StructureHeader,
    StructureTabs,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
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
    q: string;
    department: string[];
    level: string[];
    staffing: string;
    sort: string;
}

interface RosterProps {
    yearLabel: string | null;
    counts: { total: number; departments: number; needs_teacher: number };
    departments: { name: string; count: number }[];
    levels: { id: string; name: string }[];
    filters: Filters;
    subjects: {
        rows: SubjectRow[];
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
                    {plural(row.classes, 'class', 'classes')}{' '}
                    {t('· in a series but not taught in')}{' '}
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
                    : t(':unstaffed without a teacher', {
                          unstaffed: row.unstaffed,
                      })}
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

function SubjectRoster({
    yearLabel,
    counts,
    departments,
    levels,
    filters,
    subjects,
}: RosterProps) {
    const { sort, ...values } = filters;
    const table = useTableQuery((query) => index.url({ query }), values, {
        sort,
        per_page: subjects.perPage,
    });
    const selection = useSelection(subjects.rows.map((row) => row.id));
    const [exporting, setExporting] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    const fields: FilterField[] = [
        {
            kind: 'chips',
            key: 'department',
            label: t('Department'),
            options: departments.map((department) => ({
                value: department.name,
                label: t(department.name),
            })),
        },
        {
            kind: 'chips',
            key: 'level',
            label: t('Taught in'),
            options: levels.map((level) => ({
                value: level.id,
                label: level.name,
            })),
        },
        {
            kind: 'segments',
            key: 'staffing',
            label: t('Teachers'),
            anyLabel: t('Any'),
            options: [
                { value: 'needs', label: t('Needs a teacher') },
                { value: 'staffed', label: t('Fully staffed') },
            ],
        },
    ];
    const quickPicks: QuickPick[] = [
        {
            label: t('Needs a teacher'),
            count: counts.needs_teacher,
            dot: 'bg-warning',
            values: { staffing: 'needs' },
        },
        ...departments.slice(0, 3).map((department) => ({
            label: t(department.name),
            count: department.count,
            values: { department: [department.name] },
        })),
    ];

    function filter(patch: Record<string, string | string[]>) {
        table.set(patch);
        selection.clear();
    }

    return (
        <div className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('The subject roster')} />
            <StructureHeader
                trail={[{ label: t('Subjects') }]}
                title={t('The subject roster')}
                tag={t('Subjects:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t(
                    ':subjects · :departments · :needs_teacher :need a teacher',
                    {
                        subjects: plural(counts.total, 'subject', 'subjects'),
                        departments: plural(
                            counts.departments,
                            'department',
                            'departments',
                        ),
                        needs_teacher: counts.needs_teacher,
                        need: counts.needs_teacher === 1 ? 'needs' : 'need',
                    },
                )}
                action={
                    <Link href={create.url()} className={solidButtonClass}>
                        <PlusIcon />
                        {t('Add subject')}
                    </Link>
                }
            />
            <StructureTabs active="subjects" />

            {counts.total === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
                    <p className="text-[13px] leading-[19px] text-text">
                        {t(
                            'No subjects yet. Register one from scratch, or start from a prepared set and give each subject its classes and teachers in one go.',
                        )}
                    </p>
                    <Link href={templates.url()} className={outlineButtonClass}>
                        {t('Use a template')}
                    </Link>
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-4">
                    <div className="flex flex-col gap-3">
                        {selection.ids.length > 0 || selection.allMatching ? (
                            <BulkBar
                                selected={selection.ids.length}
                                total={subjects.total}
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
                                                ? subjects.total
                                                : selection.ids.length,
                                        ),
                                    })}
                                </button>
                            </BulkBar>
                        ) : (
                            <TableToolbar
                                searchLabel={t('Search subjects')}
                                searchPlaceholder={t(
                                    'A subject, code or teacher',
                                )}
                                search={table.search}
                                onSearch={(value) => {
                                    table.onSearch(value);
                                    selection.clear();
                                }}
                                filterTitle={t('Filter subjects')}
                                fields={fields}
                                quickPicks={quickPicks}
                                values={values}
                                onFilter={filter}
                                sorts={[
                                    { value: 'code', label: t('Code') },
                                    { value: 'name', label: t('Name') },
                                    {
                                        value: 'department',
                                        label: t('Department'),
                                    },
                                ]}
                                sort={sort}
                                onSort={table.sort}
                                countLabel={plural(
                                    subjects.total,
                                    'subject',
                                    'subjects',
                                )}
                                total={subjects.total}
                                onExport={() => setExporting(true)}
                            />
                        )}
                        <FilterChips
                            fields={fields}
                            values={values}
                            onFilter={filter}
                        />
                    </div>
                    <div className="overflow-x-auto xl:overflow-visible">
                        <div className="flex min-w-[930px] flex-col rounded-lg border border-solid border-border bg-white">
                            <div className="flex items-center gap-3 rounded-t-lg border-b border-solid border-border bg-surface px-4 py-2">
                                <span className="flex w-4 shrink-0">
                                    <Checkbox
                                        label={t('Select this page')}
                                        checked={selection.pageState === 'all'}
                                        mixed={selection.pageState === 'some'}
                                        onChange={selection.togglePage}
                                    />
                                </span>
                                <span
                                    className={`${headClass} min-w-[180px] flex-1`}
                                >
                                    {t('Subject')}
                                </span>
                                <span className={`${headClass} w-[72px]`}>
                                    {t('Code')}
                                </span>
                                <span className={`${headClass} w-[104px]`}>
                                    {t('Department')}
                                </span>
                                <span className={`${headClass} w-[110px]`}>
                                    {t('Levels')}
                                </span>
                                <span className={`${headClass} w-16`}>
                                    {t('Coeff.')}
                                </span>
                                <span className={`${headClass} w-[200px]`}>
                                    {t('Classes & teachers')}
                                </span>
                                <span className={`${headClass} w-[84px]`}>
                                    {t('Periods')}
                                </span>
                                <span className="w-8 shrink-0" />
                            </div>
                            {subjects.rows.length === 0 && (
                                <TableEmptyState>
                                    {t(
                                        'No subject matches. Try another name, or clear the filters.',
                                    )}
                                </TableEmptyState>
                            )}
                            {subjects.rows.map((row, position) => (
                                <div
                                    key={row.id}
                                    onClick={() =>
                                        router.visit(show.url(row.id))
                                    }
                                    className={`flex h-[62px] shrink-0 cursor-pointer items-center gap-3 border-b border-solid border-border px-4 py-2 last:rounded-b-lg last:border-b-0 ${tableRowClass({ index: position, selected: selection.has(row.id), interactive: true })}`}
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
                                    <span className="flex min-w-[180px] flex-1 flex-col">
                                        <Link
                                            href={show.url(row.id)}
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                            className="truncate text-[16px] leading-5 font-medium text-text hover:underline"
                                        >
                                            {row.name}
                                        </Link>
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {row.kind}
                                        </span>
                                    </span>
                                    <span className="w-[72px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {row.code}
                                    </span>
                                    <span className="w-[104px] shrink-0 truncate text-[13px] leading-4 text-text">
                                        {row.department}
                                    </span>
                                    <span className="w-[110px] shrink-0 truncate text-[13px] leading-4 text-text-muted">
                                        {row.levels.join(', ') || '—'}
                                    </span>
                                    <span className="w-16 shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {row.coefficient ?? '—'}
                                    </span>
                                    <span className="w-[200px] shrink-0">
                                        <Staffing row={row} />
                                    </span>
                                    <span className="w-[84px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {t(':periods / wk', {
                                            periods: row.periods,
                                        })}
                                    </span>
                                    <TableRowMenu
                                        label={t('Actions for :row', {
                                            row: row.name,
                                        })}
                                        open={openMenu === row.id}
                                        onToggle={() =>
                                            setOpenMenu(
                                                openMenu === row.id
                                                    ? null
                                                    : row.id,
                                            )
                                        }
                                        onClose={() => setOpenMenu(null)}
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
                                    </TableRowMenu>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto">
                        <TableFooter
                            paged={subjects}
                            onPage={table.page}
                            onPerPage={table.perPage}
                        />
                    </div>
                </div>
            )}

            {exporting && (
                <ExportDialog
                    title={t('Export subjects')}
                    subtitle={t(':year · as filtered on screen', {
                        year: yearLabel ?? t('Subjects'),
                    })}
                    noun={t('subjects')}
                    matching={subjects.total}
                    selected={selection.allMatching ? 'all' : selection.ids}
                    everyone={counts.total}
                    columns={[
                        { key: 'name', label: t('Subject'), on: true },
                        { key: 'code', label: t('Code'), on: true },
                        { key: 'department', label: t('Department'), on: true },
                        { key: 'kind', label: t('Kind'), on: false },
                        { key: 'levels', label: t('Levels'), on: true },
                        { key: 'coefficient', label: t('Coeff.'), on: true },
                        { key: 'classes', label: t('Classes'), on: true },
                        { key: 'teachers', label: t('Teachers'), on: true },
                        {
                            key: 'unstaffed',
                            label: t('Classes without a teacher'),
                            on: false,
                        },
                        {
                            key: 'periods',
                            label: t('Periods a week'),
                            on: true,
                        },
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

export default withAppShell(SubjectRoster);
