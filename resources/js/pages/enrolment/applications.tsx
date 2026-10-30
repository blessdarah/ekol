import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    create,
    exportMethod,
    index,
    show,
} from '@/actions/App/Http/Controllers/ApplicationController';
import { reEnrolment } from '@/actions/App/Http/Controllers/EnrolmentController';
import {
    EnrolmentHeader,
    type EnrolmentProgress,
    StagePill,
    count,
    nextStepClass,
} from '../../components/enrolment/ui';
import {
    PlusIcon,
    capsLabelClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { shortDate } from '../../components/students/ui';
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
    toQuery,
    useSelection,
    useTableQuery,
} from '../../components/table/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Filters {
    q: string;
    stage: string[];
    level: string[];
    transfer: string;
    from: string;
    to: string;
    sort: string;
}

interface ApplicationsProps {
    enrolment: EnrolmentProgress;
    counts: Record<string, number>;
    filters: Filters;
    levels: { id: string; name: string }[];
    applications: {
        rows: {
            id: string;
            name: string;
            reference: string;
            level: string | null;
            from: string | null;
            transfer: boolean;
            applied: string;
            stage: string;
            missing: number;
        }[];
        page: number;
        lastPage: number;
        total: number;
        perPage: number;
        from: number | null;
        to: number | null;
    };
}

function Applications({
    enrolment,
    counts,
    filters,
    levels,
    applications,
}: ApplicationsProps) {
    const { sort, ...values } = filters;
    const table = useTableQuery((query) => index.url({ query }), values, {
        sort,
        per_page: applications.perPage,
    });
    const selection = useSelection(applications.rows.map((row) => row.id));
    const [exporting, setExporting] = useState(false);
    const stages = [
        { value: 'to_review', label: t('To review') },
        { value: 'admitted', label: t('Admitted') },
        { value: 'waitlist', label: t('Waitlist') },
        { value: 'declined', label: t('Declined') },
    ];
    const fields: FilterField[] = [
        { kind: 'chips', key: 'stage', label: t('Stage'), options: stages },
        {
            kind: 'chips',
            key: 'level',
            label: t('Applying to'),
            options: levels.map((level) => ({
                value: level.id,
                label: level.name,
            })),
        },
        {
            kind: 'segments',
            key: 'transfer',
            label: t('Transfer'),
            anyLabel: t('Any'),
            options: [
                { value: 'yes', label: t('Transfers') },
                { value: 'no', label: t('Not transfers') },
            ],
        },
        { kind: 'dates', from: 'from', to: 'to', label: t('Applied') },
    ];
    const quickPicks: QuickPick[] = stages.map((stage) => ({
        label: stage.label,
        count: counts[stage.value] ?? 0,
        dot: stage.value === 'to_review' ? 'bg-warning' : undefined,
        values: { stage: [stage.value] },
    }));
    const filtered =
        values.q !== '' ||
        values.stage.length > 0 ||
        values.level.length > 0 ||
        values.transfer !== '' ||
        values.from !== '' ||
        values.to !== '';

    function filter(patch: Record<string, string | string[]>) {
        table.set(patch);
        selection.clear();
    }

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Admissions')} />
            <EnrolmentHeader
                progress={enrolment}
                trail={[{ label: t('Admissions') }]}
                title={t('Admissions')}
                meta={t('record each application here, then review it')}
                action={
                    <Link href={create.url()} className={solidButtonClass}>
                        <PlusIcon />
                        {t('Add application')}
                    </Link>
                }
            />

            <div className="flex flex-col gap-3">
                {selection.ids.length > 0 || selection.allMatching ? (
                    <BulkBar
                        selected={selection.ids.length}
                        total={applications.total}
                        allMatching={selection.allMatching}
                        onSelectAll={selection.selectAllMatching}
                        onClear={selection.clear}
                    >
                        <button
                            type="button"
                            onClick={() => setExporting(true)}
                            className={bulkButtonClass}
                        >
                            <DownloadIcon colour="#FFFFFF" />
                            {t('Export :count', {
                                count: count(
                                    selection.allMatching
                                        ? applications.total
                                        : selection.ids.length,
                                ),
                            })}
                        </button>
                    </BulkBar>
                ) : (
                    <TableToolbar
                        searchLabel={t('Search applications')}
                        searchPlaceholder={t('Name or reference')}
                        search={table.search}
                        onSearch={(value) => {
                            table.onSearch(value);
                            selection.clear();
                        }}
                        filterTitle={t('Filter applications')}
                        fields={fields}
                        quickPicks={quickPicks}
                        values={values}
                        onFilter={filter}
                        sorts={[
                            { value: '-applied', label: t('Newest first') },
                            { value: 'applied', label: t('Oldest first') },
                            { value: 'name', label: t('Name') },
                            { value: 'reference', label: t('Reference') },
                        ]}
                        sort={sort}
                        onSort={table.sort}
                        countLabel={t(':count applications', {
                            count: count(applications.total),
                        })}
                        total={applications.total}
                        onExport={() => setExporting(true)}
                    />
                )}
                <FilterChips
                    fields={fields}
                    values={values}
                    onFilter={filter}
                />
            </div>

            {applications.rows.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {filtered
                            ? t('No application matches')
                            : t('No applications for :year yet', {
                                  year: enrolment.year,
                              })}
                    </p>
                    <p className="max-w-[560px] text-[13px] leading-[19px] text-text">
                        {filtered
                            ? t('Try another stage, level or name.')
                            : t(
                                  'When a family applies, record the application here. It waits under To review until someone admits, waitlists or declines it.',
                              )}
                    </p>
                    {!filtered && (
                        <Link href={create.url()} className={solidButtonClass}>
                            <PlusIcon />
                            {t('Add application')}
                        </Link>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[920px] flex-col">
                        <div
                            className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                        >
                            <span className="flex w-4 shrink-0">
                                <Checkbox
                                    label={t('Select this page')}
                                    checked={selection.pageState === 'all'}
                                    mixed={selection.pageState === 'some'}
                                    onChange={selection.togglePage}
                                />
                            </span>
                            <span className="w-[250px] shrink-0">
                                {t('Applicant')}
                            </span>
                            <span className="w-[120px] shrink-0">
                                {t('Applying to')}
                            </span>
                            <span className="flex-1">{t('Coming from')}</span>
                            <span className="w-20 shrink-0">
                                {t('Applied')}
                            </span>
                            <span className="w-40 shrink-0">{t('Stage')}</span>
                            <span className="w-[70px] shrink-0" />
                        </div>
                        {applications.rows.map((row) => (
                            <div
                                key={row.id}
                                onClick={() => router.visit(show.url(row.id))}
                                className={`flex h-[54px] shrink-0 cursor-pointer items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 ${selection.has(row.id) ? 'bg-primary-tint/60' : 'hover:bg-surface'}`}
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
                                <span className="flex w-[250px] shrink-0 flex-col">
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
                                        {row.reference}
                                    </span>
                                </span>
                                <span className="w-[120px] shrink-0 truncate text-[14px] leading-[18px] text-text">
                                    {row.level}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-text-muted">
                                    {[
                                        row.from,
                                        row.transfer ? 'transfer' : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ') || '—'}
                                </span>
                                <span className="w-20 shrink-0 font-mono text-[13px] leading-4 text-text-muted">
                                    {shortDate(row.applied)}
                                </span>
                                <span className="flex w-40 shrink-0">
                                    <StagePill
                                        stage={
                                            row.stage === 'to_review' &&
                                            row.missing > 0
                                                ? 'documents'
                                                : row.stage
                                        }
                                    />
                                </span>
                                <span className="w-[70px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary">
                                    {row.stage === 'to_review'
                                        ? t('Review')
                                        : t('Open')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <TableFooter
                paged={applications}
                onPage={table.page}
                onPerPage={table.perPage}
            />

            <div className="flex justify-end">
                <Link href={reEnrolment.url()} className={nextStepClass}>
                    {t('Next: promotion →')}
                </Link>
            </div>

            {exporting && (
                <ExportDialog
                    title={t('Export applications')}
                    subtitle={t(':year · as filtered on screen', {
                        year: enrolment.year,
                    })}
                    noun={t('applications')}
                    matching={applications.total}
                    selected={selection.allMatching ? 'all' : selection.ids}
                    everyone={counts.all ?? 0}
                    columns={[
                        { key: 'name', label: t('Applicant'), on: true },
                        { key: 'reference', label: t('Reference'), on: true },
                        { key: 'level', label: t('Applying to'), on: true },
                        { key: 'gender', label: t('Gender'), on: false },
                        {
                            key: 'date_of_birth',
                            label: t('Date of birth'),
                            on: false,
                        },
                        { key: 'from', label: t('Coming from'), on: true },
                        { key: 'transfer', label: t('Transfer'), on: false },
                        { key: 'guardian', label: t('Main contact'), on: true },
                        { key: 'phone', label: t('Phone'), on: true },
                        { key: 'applied', label: t('Applied'), on: true },
                        { key: 'stage', label: t('Stage'), on: true },
                        {
                            key: 'missing',
                            label: t('Documents missing'),
                            on: false,
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

export default withAppShell(Applications);
