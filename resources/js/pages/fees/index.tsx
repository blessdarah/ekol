import { tableRowClass } from '../../components/table/ui';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    exportMethod,
    index,
} from '@/actions/App/Http/Controllers/FeeController';
import { structure } from '@/actions/App/Http/Controllers/FeeStructureController';
import { student } from '@/actions/App/Http/Controllers/FeePaymentController';
import {
    FeesHeader,
    StatePill,
    amberText,
    figure,
} from '../../components/fees/ui';
import {
    capsLabelClass,
    solidButtonClass,
} from '../../components/structure/ui';
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

interface Filters {
    q: string;
    state: string[];
    level: string;
    class: string[];
    sort: string;
}

interface FeesProps {
    yearLabel: string | null;
    currency: string;
    totals: {
        billed: number;
        collected: number;
        outstanding: number;
        overdue: number;
    };
    counts: Record<string, number>;
    filters: Filters;
    levels: { id: string; name: string }[];
    classes: { id: string; name: string; level_id: string | null }[];
    students: {
        rows: {
            id: string;
            name: string;
            matricule: string;
            class: string | null;
            due: number;
            paid: number;
            balance: number;
            overdue: number;
            state: string;
        }[];
        page: number;
        lastPage: number;
        total: number;
        perPage: number;
        from: number | null;
        to: number | null;
    };
    hasPlans: boolean;
}

function Fees({
    yearLabel,
    currency,
    totals,
    counts,
    filters,
    levels,
    classes,
    students,
    hasPlans,
}: FeesProps) {
    const { sort, ...values } = filters;
    const table = useTableQuery((query) => index.url({ query }), values, {
        sort,
        per_page: students.perPage,
    });
    const selection = useSelection(students.rows.map((row) => row.id));
    const [exporting, setExporting] = useState(false);
    const shownClasses = values.level
        ? classes.filter((option) => option.level_id === values.level)
        : classes;
    const states = [
        { value: 'overdue', label: t('Overdue') },
        { value: 'owing', label: t('Owing, not late') },
        { value: 'paid', label: t('Paid') },
        { value: 'unbilled', label: t('Not billed') },
    ];
    const fields: FilterField[] = [
        { kind: 'chips', key: 'state', label: t('Status'), options: states },
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
    ];
    const quickPicks: QuickPick[] = [
        {
            label: t('Overdue'),
            count: counts.overdue,
            dot: 'bg-danger',
            values: { state: ['overdue'] },
        },
        {
            label: t('Still owing'),
            count: counts.overdue + counts.owing,
            dot: 'bg-warning',
            values: { state: ['overdue', 'owing'] },
        },
        {
            label: t('Paid in full'),
            count: counts.paid,
            values: { state: ['paid'] },
        },
        {
            label: t('Not billed'),
            count: counts.unbilled,
            values: { state: ['unbilled'] },
        },
    ];

    /** A level change drops classes that are not in it. */
    function filter(patch: FilterValues) {
        if (typeof patch.level === 'string' && patch.level !== values.level) {
            table.set({
                ...patch,
                class: values.class.filter((id) =>
                    classes.some(
                        (option) =>
                            option.id === id &&
                            (!patch.level || option.level_id === patch.level),
                    ),
                ),
            });
        } else {
            table.set(patch);
        }
        selection.clear();
    }

    const share =
        totals.billed > 0
            ? Math.round((totals.collected / totals.billed) * 100)
            : 0;

    const stats = [
        {
            label: t('Billed'),
            value: totals.billed,
            tone: 'text-text',
            note: t(':unbilled of :all students', {
                unbilled: counts.all - counts.unbilled,
                all: counts.all,
            }),
        },
        {
            label: t('Collected'),
            value: totals.collected,
            tone: 'text-success',
            note: t(':share% of what was billed', { share }),
        },
        {
            label: t('Outstanding'),
            value: totals.outstanding,
            tone: totals.outstanding > 0 ? amberText : 'text-text',
            note: t(':owing students owe', {
                owing: counts.overdue + counts.owing,
            }),
        },
        {
            label: t('Overdue'),
            value: totals.overdue,
            tone: totals.overdue > 0 ? 'text-danger' : 'text-text',
            note: t(':overdue students are late', { overdue: counts.overdue }),
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Fees')} />
            <FeesHeader
                active="students"
                title={t('Fees')}
                tag={yearLabel}
                meta={t(
                    'what each student was billed, has paid and still owes',
                )}
            />

            {!yearLabel ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'Fees are billed for an academic year, and no year is active. Make one active in School Setup first.',
                    )}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap border-y border-solid border-border">
                        {stats.map((stat, position) => (
                            <div
                                key={stat.label}
                                className={`flex min-w-[160px] flex-1 flex-col gap-[2px] py-3 ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                            >
                                <span className={capsLabelClass}>
                                    {t(stat.label)}
                                </span>
                                <span
                                    className={`font-mono text-[20px] leading-7 ${stat.tone}`}
                                >
                                    {figure(stat.value)}
                                </span>
                                <span className="text-[12px] leading-4 text-text-muted">
                                    {currency} · {stat.note}
                                </span>
                            </div>
                        ))}
                    </div>

                    {(!hasPlans || counts.unbilled > 0) && (
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
                            <p className="min-w-0 flex-1 text-[13px] leading-[19px] text-text">
                                {!hasPlans
                                    ? t(
                                          'No level has a fee for :year_label yet, so nobody can be billed.',
                                          { year_label: yearLabel },
                                      )
                                    : t(
                                          ':unbilled :have no invoice for :year_label.',
                                          {
                                              unbilled: counts.unbilled,
                                              have:
                                                  counts.unbilled === 1
                                                      ? 'student has'
                                                      : 'students have',
                                              year_label: yearLabel,
                                          },
                                      )}{' '}
                                {t(
                                    'Set fees and bill students under Fee structure.',
                                )}
                            </p>
                            <Link
                                href={structure.url()}
                                className={solidButtonClass}
                            >
                                {t('Open Fee structure →')}
                            </Link>
                        </div>
                    )}

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
                                    onClick={() => setExporting(true)}
                                    className={bulkButtonClass}
                                >
                                    <DownloadIcon colour="var(--color-bg)" />
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
                                searchPlaceholder={t('Name or matricule')}
                                search={table.search}
                                onSearch={(value) => {
                                    table.onSearch(value);
                                    selection.clear();
                                }}
                                filterTitle={t('Filter fees')}
                                fields={fields}
                                quickPicks={quickPicks}
                                values={values}
                                onFilter={filter}
                                sorts={[
                                    { value: 'owed', label: t('Most overdue') },
                                    {
                                        value: '-balance',
                                        label: t('Largest balance'),
                                    },
                                    { value: 'name', label: t('Name') },
                                    { value: 'class', label: t('Class') },
                                ]}
                                sort={sort}
                                onSort={table.sort}
                                countLabel={t(':count students', {
                                    count: count(students.total),
                                })}
                                total={students.total}
                                onExport={() => setExporting(true)}
                            />
                        )}
                        <FilterChips
                            fields={fields}
                            values={values}
                            onFilter={filter}
                        />
                    </div>

                    {students.rows.length === 0 ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            {counts.all === 0
                                ? t(
                                      'No student is enrolled in :year_label yet.',
                                      { year_label: yearLabel },
                                  )
                                : t('No student matches.')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[900px] flex-col">
                                <div
                                    className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                                >
                                    <span className="flex w-4 shrink-0">
                                        <Checkbox
                                            label={t('Select this page')}
                                            checked={
                                                selection.pageState === 'all'
                                            }
                                            mixed={
                                                selection.pageState === 'some'
                                            }
                                            onChange={selection.togglePage}
                                        />
                                    </span>
                                    <span className="flex-1">
                                        {t('Student')}
                                    </span>
                                    <span className="w-[110px] shrink-0">
                                        {t('Class')}
                                    </span>
                                    <span className="w-[100px] shrink-0 text-right">
                                        {t('Annual fees')}
                                    </span>
                                    <span className="w-[100px] shrink-0 text-right">
                                        {t('Paid')}
                                    </span>
                                    <span className="w-[100px] shrink-0 text-right">
                                        {t('Balance')}
                                    </span>
                                    <span className="w-[110px] shrink-0">
                                        {t('Status')}
                                    </span>
                                    <span className="w-[60px] shrink-0" />
                                </div>
                                {students.rows.map((row, position) => (
                                    <div
                                        key={row.id}
                                        onClick={() =>
                                            router.visit(student.url(row.id))
                                        }
                                        className={`flex h-[52px] shrink-0 cursor-pointer items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 ${tableRowClass({ index: position, selected: selection.has(row.id), interactive: true })}`}
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
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <Link
                                                href={student.url(row.id)}
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
                                        <span className="w-[110px] shrink-0 truncate text-[13px] leading-4 text-text">
                                            {row.class ?? '—'}
                                        </span>
                                        <span className="w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                            {row.state === 'unbilled'
                                                ? '—'
                                                : figure(row.due)}
                                        </span>
                                        <span className="w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 text-success">
                                            {row.state === 'unbilled'
                                                ? '—'
                                                : figure(row.paid)}
                                        </span>
                                        <span
                                            className={`w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 ${row.overdue > 0 ? 'text-danger' : row.balance > 0 ? amberText : 'text-text-muted'}`}
                                        >
                                            {row.state === 'unbilled'
                                                ? '—'
                                                : figure(row.balance)}
                                        </span>
                                        <span className="flex w-[110px] shrink-0">
                                            <StatePill state={row.state} />
                                        </span>
                                        <span className="w-[60px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary">
                                            {t('Open')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <TableFooter
                        paged={students}
                        onPage={table.page}
                        onPerPage={table.perPage}
                    />
                </>
            )}

            {exporting && (
                <ExportDialog
                    title={t('Export fees')}
                    subtitle={t(':year · as filtered on screen', {
                        year: yearLabel ?? t('Fees'),
                    })}
                    noun={t('students')}
                    matching={students.total}
                    selected={selection.allMatching ? 'all' : selection.ids}
                    everyone={counts.all}
                    columns={[
                        { key: 'name', label: t('Name'), on: true },
                        { key: 'matricule', label: t('Matricule'), on: true },
                        { key: 'class', label: t('Class'), on: true },
                        { key: 'due', label: t('Annual fees'), on: true },
                        { key: 'paid', label: t('Paid'), on: true },
                        { key: 'balance', label: t('Balance'), on: true },
                        { key: 'overdue', label: t('Overdue'), on: false },
                        { key: 'state', label: t('Status'), on: true },
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

export default withAppShell(Fees);
