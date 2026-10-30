import { Form, Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    exportMethod,
    index,
    note,
    show,
} from '@/actions/App/Http/Controllers/SchemeController';
import { show as subjectShow } from '@/actions/App/Http/Controllers/SubjectController';
import { dayMonth } from '../../components/fees/ui';
import {
    STATES,
    SchemesHeader,
    StateLabel,
    type Steps,
    TermStrip,
} from '../../components/schemes/ui';
import {
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
    type Paged,
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

interface Row {
    id: string;
    subject: string | null;
    class: string | null;
    teacher: string | null;
    initials: string | null;
    subject_id: string | null;
    status: string;
    topics: number;
    state: string;
    progress: { planned: number; taught: number };
    taught_total: number;
    late: number;
}

interface Panel {
    id: string;
    subject: string | null;
    class: string | null;
    teacher: string | null;
    status: string;
    topics: number;
    state: string;
    approved_on: string | null;
    approved_by: string | null;
    late: number;
    late_weeks: number[];
    items: {
        id: string;
        week: number;
        label: string;
        taught_on: string | null;
        state: 'taught' | 'late' | 'this_week' | 'planned';
    }[];
}

interface IndexProps {
    steps: Steps;
    week: number | null;
    dueOn: string;
    daysLate: number;
    canManage: boolean;
    totals: {
        all: number;
        submitted: number;
        to_approve: number;
        behind: number;
        not_submitted: number;
        waiting: number;
    };
    states: Record<string, number>;
    filters: {
        q: string;
        state: string[];
        level: string[];
        department: string[];
        sort: string;
    };
    levels: { id: string; name: string }[];
    departments: string[];
    rows: Row[];
    paged: Paged;
    picked: Panel | null;
}

/** The bar's colour for each state, in the order the bar reads. */
const DISTRIBUTION: { states: string[]; label: string; bar: string }[] = [
    { states: ['on_track'], label: 'On track', bar: 'bg-success' },
    { states: ['to_approve'], label: 'To approve', bar: 'bg-science' },
    { states: ['behind'], label: 'Behind', bar: 'bg-warning' },
    {
        states: ['not_submitted', 'sent_back'],
        label: 'Not submitted',
        bar: 'bg-danger',
    },
    { states: ['waiting'], label: 'No teacher', bar: 'bg-[#B8C2BD]' },
    { states: ['closed'], label: 'Closed', bar: 'bg-text-muted' },
];

const headClass =
    'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

/**
 * How far a scheme has got over the whole term: taught in solid, the
 * part planned for weeks gone but not taught striped.
 */
function ProgressCell({ row }: { row: Row }) {
    if (row.state === 'to_approve') {
        return (
            <span className="text-[13px] text-text-muted">
                {t('Waiting for your approval')}
            </span>
        );
    }

    if (row.state === 'waiting') {
        return (
            <span className="text-[13px] text-text-muted">
                {t('Starts once someone teaches it')}
            </span>
        );
    }

    if (row.topics === 0) {
        return <span className="text-[13px] text-text-muted">—</span>;
    }

    const taught = (row.taught_total / row.topics) * 100;
    const late = (row.late / row.topics) * 100;
    const behind = row.state === 'behind';

    return (
        <span className="flex items-center gap-3">
            <span
                className="flex h-[6px] w-[150px] shrink-0 overflow-hidden rounded-full bg-border"
                role="img"
                aria-label={t(':taught of :total sub-topics taught', {
                    taught: row.taught_total,
                    total: row.topics,
                })}
            >
                <span
                    className={behind ? 'bg-warning' : 'bg-success'}
                    style={{ width: `${taught}%` }}
                />
                {late > 0 && (
                    <span
                        style={{
                            width: `${late}%`,
                            backgroundImage:
                                'repeating-linear-gradient(135deg, #E9C98F 0 3px, #FBF1DF 3px 6px)',
                        }}
                    />
                )}
            </span>
            <span className="font-mono text-[12px] text-text">
                {row.progress.taught}{' '}
                <span className="text-text-muted">
                    {t('of :planned planned', {
                        planned: row.progress.planned,
                    })}
                </span>
            </span>
        </span>
    );
}

function SchemesIndex({
    steps,
    week,
    dueOn,
    daysLate,
    canManage,
    totals,
    states,
    filters,
    levels,
    departments,
    rows,
    paged,
    picked,
}: IndexProps) {
    const [writing, setWriting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const { sort, ...values } = filters;
    const table = useTableQuery((query) => index.url({ query }), values, {
        sort,
        per_page: paged.perPage,
    });
    const selection = useSelection(rows.map((row) => row.id));
    const onTrack = states.on_track ?? 0;
    const shown = DISTRIBUTION.filter((part) =>
        part.states.some((state) => (states[state] ?? 0) > 0),
    );

    const fields: FilterField[] = [
        {
            kind: 'chips',
            key: 'state',
            label: t('Status'),
            options: Object.entries(STATES).map(([value, style]) => ({
                value,
                label: t(style.label),
            })),
        },
        {
            kind: 'chips',
            key: 'level',
            label: t('Level'),
            options: levels.map((level) => ({
                value: level.id,
                label: level.name,
            })),
        },
        {
            kind: 'chips',
            key: 'department',
            label: t('Department'),
            options: departments.map((department) => ({
                value: department,
                label: department,
            })),
        },
    ];
    const quickPicks: QuickPick[] = [
        {
            label: t('To approve'),
            count: totals.to_approve,
            dot: 'bg-science',
            values: { state: ['to_approve'] },
        },
        {
            label: t('Behind'),
            count: totals.behind,
            dot: 'bg-warning',
            values: { state: ['behind'] },
        },
        {
            label: t('Not submitted'),
            count: totals.not_submitted,
            dot: 'bg-danger',
            values: { state: ['not_submitted', 'sent_back'] },
        },
        {
            label: t('No teacher yet'),
            count: totals.waiting,
            values: { state: ['waiting'] },
        },
    ];

    function filter(patch: Record<string, string | string[]>) {
        table.set(patch);
        selection.clear();
    }

    /** Whether the list shows exactly these states and nothing else. */
    function showing(wanted: string[]): boolean {
        return (
            values.state.length === wanted.length &&
            wanted.every((state) => values.state.includes(state))
        );
    }

    /** Opens a scheme in the drawer, keeping the list as it is. */
    function pick(id: string | null) {
        setWriting(false);
        router.get(
            index.url({
                query: toQuery(values, {
                    sort,
                    per_page: paged.perPage !== 25 ? paged.perPage : undefined,
                    page: paged.page > 1 ? paged.page : undefined,
                    scheme: id ?? undefined,
                }),
            }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    function open(row: Row) {
        if (row.state === 'to_approve') {
            router.visit(show.url(row.id));
        } else {
            pick(row.id);
        }
    }

    /** Escape closes the drawer; the arrow keys move to the next scheme. */
    useEffect(() => {
        if (!picked) {
            return;
        }

        const keys = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;

            if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                return;
            }

            if (event.key === 'Escape') {
                pick(null);
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const position = rows.findIndex((row) => row.id === picked.id);
                const next =
                    rows[position + (event.key === 'ArrowDown' ? 1 : -1)];

                if (next) {
                    event.preventDefault();
                    pick(next.id);
                }
            }
        };
        document.addEventListener('keydown', keys);

        return () => document.removeEventListener('keydown', keys);
    });

    const weeks = picked
        ? [...new Set(picked.items.map((item) => item.week))].sort(
              (a, b) => a - b,
          )
        : [];
    const shownWeeks = weeks.filter((each) => week === null || each <= week);
    const laterItems = picked
        ? picked.items.filter((item) => week !== null && item.week > week)
        : [];

    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Schemes of work')} />
            <SchemesHeader
                title={t('Schemes of work')}
                tag={t('Schemes:term_label', {
                    term_label: steps.term ? ` · ${t(steps.term.label)}` : '',
                })}
                meta={t(':count schemes · due :due', {
                    count: totals.all,
                    due: dayMonth(dueOn, false),
                })}
                action={
                    totals.to_approve > 0 ? (
                        <Link
                            href={index.url({
                                query: { state: 'to_approve' },
                            })}
                            className={solidButtonClass}
                        >
                            {t('Approve :count waiting →', {
                                count: totals.to_approve,
                            })}
                        </Link>
                    ) : undefined
                }
            />
            {canManage && <StructureTabs active="schemes" />}

            <div className="-mt-2 flex flex-col">
                <TermStrip steps={steps} />

                <div className="flex flex-wrap items-end gap-x-14 gap-y-5 pt-8 pb-7">
                    <div className="flex w-[260px] shrink-0 flex-col gap-1">
                        <p className="font-display text-[56px] leading-[56px] font-extrabold tracking-[-0.03em] text-text">
                            {onTrack}
                            <span className="font-light text-text-muted">
                                {' '}
                                / {totals.all}
                            </span>
                        </p>
                        <p className="text-[14px] leading-5 text-text-muted">
                            {week
                                ? t('schemes on track at week :week', { week })
                                : t('schemes on track')}
                        </p>
                    </div>
                    <div className="flex min-w-[280px] flex-1 flex-col gap-[14px]">
                        <div className="flex h-3 gap-[3px]" aria-hidden>
                            {shown.map((part, position) => (
                                <span
                                    key={part.label}
                                    className={`h-3 ${part.bar} ${position === 0 ? 'rounded-l-full' : 'rounded-l-[2px]'} ${position === shown.length - 1 ? 'rounded-r-full' : 'rounded-r-[2px]'}`}
                                    style={{
                                        flexGrow: part.states.reduce(
                                            (sum, state) =>
                                                sum + (states[state] ?? 0),
                                            0,
                                        ),
                                    }}
                                />
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] leading-4">
                            {shown.map((part) => {
                                const on = showing(part.states);
                                const number = part.states.reduce(
                                    (sum, state) => sum + (states[state] ?? 0),
                                    0,
                                );

                                return (
                                    <button
                                        key={part.label}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                            filter({
                                                state: on ? [] : part.states,
                                            })
                                        }
                                        className={`flex items-center gap-2 rounded-full py-1 text-text ${on ? 'bg-primary-tint px-[10px] font-semibold' : 'hover:underline'}`}
                                    >
                                        <span
                                            className={`h-2 w-2 rounded-full ${part.bar}`}
                                        />
                                        {t(part.label)}
                                        <span className="font-mono font-normal text-text-muted">
                                            {number}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {selection.ids.length > 0 || selection.allMatching ? (
                        <BulkBar
                            selected={selection.ids.length}
                            total={paged.total}
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
                                            ? paged.total
                                            : selection.ids.length,
                                    ),
                                })}
                            </button>
                        </BulkBar>
                    ) : (
                        <TableToolbar
                            searchLabel={t('Search schemes')}
                            searchPlaceholder={t('A subject, class or teacher')}
                            search={table.search}
                            onSearch={(value) => {
                                table.onSearch(value);
                                selection.clear();
                            }}
                            filterTitle={t('Filter schemes')}
                            fields={fields}
                            quickPicks={quickPicks}
                            values={values}
                            onFilter={filter}
                            sorts={[
                                {
                                    value: 'attention',
                                    label: t('Needs attention first'),
                                },
                                { value: 'subject', label: t('Subject') },
                                { value: 'class', label: t('Class') },
                                { value: 'teacher', label: t('Teacher') },
                            ]}
                            sort={sort}
                            onSort={table.sort}
                            countLabel={t(':count schemes', {
                                count: count(paged.total),
                            })}
                            total={paged.total}
                            onExport={() => setExporting(true)}
                        />
                    )}
                    <FilterChips
                        fields={fields}
                        values={values}
                        onFilter={filter}
                    />
                </div>
            </div>

            <div className="-mt-4 flex flex-col gap-4">
                <div className="overflow-x-auto rounded-xl border border-solid border-border">
                    <div className="flex min-w-[880px] flex-col">
                        <div
                            className={`flex h-[38px] items-center gap-4 border-b border-solid border-border bg-surface px-5 ${headClass}`}
                        >
                            <span className="flex w-4 shrink-0">
                                <Checkbox
                                    label={t('Select this page')}
                                    checked={selection.pageState === 'all'}
                                    mixed={selection.pageState === 'some'}
                                    onChange={selection.togglePage}
                                />
                            </span>
                            <span className="min-w-0 flex-1">
                                {t('Subject · class')}
                            </span>
                            <span className="w-[200px] shrink-0">
                                {t('Teacher')}
                            </span>
                            <span className="w-[280px] shrink-0">
                                {week
                                    ? t('Taught by week :week', { week })
                                    : t('Taught')}
                            </span>
                            <span className="w-[140px] shrink-0">
                                {t('Status')}
                            </span>
                            <span className="w-5 shrink-0" />
                        </div>
                        {rows.length === 0 && (
                            <p className="px-5 py-10 text-center text-[13px] text-text-muted">
                                {t(
                                    'No scheme matches. Try another name, or clear the filters.',
                                )}
                            </p>
                        )}
                        {rows.map((row) => (
                            <div
                                key={row.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => open(row)}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' ||
                                        event.key === ' '
                                    ) {
                                        event.preventDefault();
                                        open(row);
                                    }
                                }}
                                className={`flex h-16 cursor-pointer items-center gap-4 border-b border-solid border-border px-5 last:border-b-0 ${
                                    picked?.id === row.id ||
                                    selection.has(row.id)
                                        ? 'bg-primary-tint'
                                        : 'hover:bg-surface'
                                }`}
                            >
                                <span className="flex w-4 shrink-0">
                                    <Checkbox
                                        label={t('Select :row', {
                                            row: `${row.subject} · ${row.class}`,
                                        })}
                                        checked={selection.has(row.id)}
                                        onChange={() =>
                                            selection.toggle(row.id)
                                        }
                                    />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                    <span className="truncate text-[15px] leading-5 font-semibold text-text">
                                        {row.subject}
                                    </span>
                                    <span className="truncate text-[13px] leading-4 text-text-muted">
                                        {row.class} ·{' '}
                                        {row.state === 'not_submitted' ||
                                        row.state === 'sent_back'
                                            ? row.state === 'sent_back'
                                                ? t('sent back for changes')
                                                : t('not written yet')
                                            : t(':count sub-topics', {
                                                  count: row.topics,
                                              })}
                                    </span>
                                </span>
                                <span className="flex w-[200px] shrink-0 items-center gap-[10px]">
                                    {row.teacher ? (
                                        <>
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary">
                                                {row.initials}
                                            </span>
                                            <span className="truncate text-[14px] text-text">
                                                {row.teacher}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#B8C2BD] text-[14px] text-text-muted">
                                                +
                                            </span>
                                            {canManage && row.subject_id ? (
                                                <Link
                                                    href={subjectShow.url(
                                                        row.subject_id,
                                                    )}
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                    className="text-[14px] font-medium text-primary hover:underline"
                                                >
                                                    {t('Assign a teacher')}
                                                </Link>
                                            ) : (
                                                <span className="text-[14px] text-text-muted">
                                                    {t('No teacher yet')}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </span>
                                <span className="flex w-[280px] shrink-0 items-center">
                                    {row.state === 'not_submitted' ||
                                    row.state === 'sent_back' ? (
                                        <span className="text-[13px] text-danger">
                                            {daysLate > 0
                                                ? t(
                                                      'Was due :due · :days days late',
                                                      {
                                                          due: dayMonth(
                                                              dueOn,
                                                              false,
                                                          ),
                                                          days: daysLate,
                                                      },
                                                  )
                                                : t('Due :due', {
                                                      due: dayMonth(
                                                          dueOn,
                                                          false,
                                                      ),
                                                  })}
                                        </span>
                                    ) : (
                                        <ProgressCell row={row} />
                                    )}
                                </span>
                                <span className="w-[140px] shrink-0">
                                    {row.state === 'behind' ? (
                                        <span className="flex items-center gap-[6px] text-[13px] leading-4 text-[#8A5A12]">
                                            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning" />
                                            {t('Behind · :count', {
                                                count: row.late,
                                            })}
                                        </span>
                                    ) : (
                                        <StateLabel state={row.state} />
                                    )}
                                </span>
                                <span className="w-5 shrink-0 text-[16px] text-text-muted">
                                    ›
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <TableFooter
                    paged={paged}
                    onPage={table.page}
                    onPerPage={table.perPage}
                />
            </div>

            {picked && (
                <div
                    className="fixed inset-0 z-50 flex justify-end bg-text/30"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            pick(null);
                        }
                    }}
                >
                    <aside
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${picked.subject} · ${picked.class}`}
                        className="flex h-full w-[460px] max-w-full flex-col bg-white shadow-[-24px_0_60px_rgba(16,25,21,0.18)]"
                    >
                        <div className="flex flex-col gap-[10px] border-b border-solid border-border px-7 pt-7 pb-[22px]">
                            <div className="flex items-center justify-between gap-4">
                                {picked.state === 'behind' ? (
                                    <span className="flex items-center gap-[6px] text-[13px] leading-4 text-[#8A5A12]">
                                        <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning" />
                                        {t('Behind · :count sub-topics', {
                                            count: picked.late,
                                        })}
                                    </span>
                                ) : (
                                    <StateLabel state={picked.state} />
                                )}
                                <button
                                    type="button"
                                    aria-label={t('Close')}
                                    onClick={() => pick(null)}
                                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-solid border-border hover:bg-surface"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 10 10"
                                        aria-hidden
                                    >
                                        <path
                                            d="M2.5 2.5l5 5M7.5 2.5l-5 5"
                                            stroke="#56625C"
                                            strokeWidth="1.3"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <h2 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text">
                                {picked.subject} · {picked.class}
                            </h2>
                            <p className="text-[13px] leading-[18px] text-text-muted">
                                {[
                                    picked.teacher ?? t('No teacher yet'),
                                    picked.approved_on
                                        ? `${t('approved :date', { date: dayMonth(picked.approved_on, false) })}${picked.approved_by ? ` ${t('by :name', { name: picked.approved_by })}` : ''}`
                                        : null,
                                    t(':count sub-topics', {
                                        count: picked.topics,
                                    }),
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                        </div>

                        <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-7 py-[22px]">
                            {picked.late > 0 && (
                                <div className="flex flex-col gap-2 rounded-lg bg-warning-tint px-4 py-[14px]">
                                    <p className="text-[14px] leading-5 font-semibold text-text">
                                        {t(
                                            ':count planned for weeks :weeks are not taught yet.',
                                            {
                                                count: picked.late,
                                                weeks: picked.late_weeks.join(
                                                    ', ',
                                                ),
                                            },
                                        )}
                                    </p>
                                    <p className="text-[13px] leading-[18px] text-text">
                                        {picked.items
                                            .filter(
                                                (item) => item.state === 'late',
                                            )
                                            .map((item) => item.label)
                                            .join(' · ')}
                                    </p>
                                </div>
                            )}
                            {picked.items.length === 0 && (
                                <p className="text-[13px] text-text-muted">
                                    {t('Nothing is placed in a week yet.')}
                                </p>
                            )}
                            {shownWeeks.map((each) => (
                                <div
                                    key={each}
                                    className="flex flex-col gap-[6px]"
                                >
                                    <p
                                        className={`text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase ${each === week ? 'text-primary' : 'text-text-muted'}`}
                                    >
                                        {each === week
                                            ? t('Week :week · this week', {
                                                  week: each,
                                              })
                                            : t('Week :week', { week: each })}
                                    </p>
                                    {picked.items
                                        .filter((item) => item.week === each)
                                        .map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-3 text-[14px] leading-5"
                                            >
                                                <span
                                                    className={`w-4 shrink-0 ${
                                                        item.state === 'taught'
                                                            ? 'text-success'
                                                            : item.state ===
                                                                'late'
                                                              ? 'text-warning'
                                                              : 'text-[#B8C2BD]'
                                                    }`}
                                                    aria-hidden
                                                >
                                                    {item.state === 'taught'
                                                        ? '✓'
                                                        : '○'}
                                                </span>
                                                <span
                                                    className={`min-w-0 flex-1 ${item.state === 'taught' || item.state === 'late' ? 'text-text' : 'text-text-muted'}`}
                                                >
                                                    {item.label}
                                                </span>
                                                <span
                                                    className={`shrink-0 text-[12px] ${item.state === 'late' ? 'text-[#8A5A12]' : 'text-text-muted'}`}
                                                >
                                                    {item.taught_on
                                                        ? dayMonth(
                                                              item.taught_on,
                                                              false,
                                                          )
                                                        : item.state === 'late'
                                                          ? t('not yet')
                                                          : t('planned')}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            ))}
                            {laterItems.length > 0 && week !== null && (
                                <Link
                                    href={show.url(picked.id)}
                                    className="text-[13px] font-medium text-primary hover:underline"
                                >
                                    {t(
                                        'Weeks :from–:to · :count more sub-topics',
                                        {
                                            from: week + 1,
                                            to:
                                                weeks[weeks.length - 1] ??
                                                week + 1,
                                            count: laterItems.length,
                                        },
                                    )}
                                </Link>
                            )}
                        </div>

                        <div className="flex flex-col gap-[10px] border-t border-solid border-border bg-surface px-7 pt-[18px] pb-6">
                            {writing ? (
                                <Form
                                    action={note.url(picked.id)}
                                    method="post"
                                    resetOnSuccess
                                    onSuccess={() => setWriting(false)}
                                    className="flex flex-col gap-2"
                                >
                                    {({ errors, processing }) => (
                                        <>
                                            <label className="flex flex-col gap-1 text-[13px] font-medium text-text">
                                                {t('Note to :name', {
                                                    name:
                                                        picked.teacher ??
                                                        t('the teacher'),
                                                })}
                                                <textarea
                                                    name="note"
                                                    rows={3}
                                                    autoFocus
                                                    className="rounded-md border border-solid border-border bg-white px-3 py-2 text-[14px] font-normal outline-none focus:border-primary"
                                                />
                                            </label>
                                            {errors.note && (
                                                <p className="text-[13px] text-danger">
                                                    {errors.note}
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className={`${solidButtonClass} flex-1`}
                                                >
                                                    {t('Send')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setWriting(false)
                                                    }
                                                    className={`${outlineButtonClass} flex-1`}
                                                >
                                                    {t('Cancel')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            ) : (
                                <div className="flex gap-2">
                                    {picked.teacher && (
                                        <button
                                            type="button"
                                            onClick={() => setWriting(true)}
                                            className={`${solidButtonClass} flex-1`}
                                        >
                                            {t('Send :name a note', {
                                                name: picked.teacher.split(
                                                    ' ',
                                                )[0],
                                            })}
                                        </button>
                                    )}
                                    <Link
                                        href={show.url(picked.id)}
                                        className={`${outlineButtonClass} flex-1 bg-white`}
                                    >
                                        {t('Open full scheme →')}
                                    </Link>
                                </div>
                            )}
                            <p className="text-[12px] leading-[17px] text-text-muted">
                                {t(
                                    'The teacher sees the note on their scheme. ↑ ↓ moves to the next scheme without closing.',
                                )}
                            </p>
                        </div>
                    </aside>
                </div>
            )}

            {exporting && (
                <ExportDialog
                    title={t('Export schemes')}
                    subtitle={t(':year · as filtered on screen', {
                        year: t(steps.term?.label ?? 'Schemes of work'),
                    })}
                    noun={t('schemes')}
                    matching={paged.total}
                    selected={selection.allMatching ? 'all' : selection.ids}
                    everyone={totals.all}
                    columns={[
                        { key: 'subject', label: t('Subject'), on: true },
                        { key: 'class', label: t('Class'), on: true },
                        {
                            key: 'department',
                            label: t('Department'),
                            on: false,
                        },
                        { key: 'teacher', label: t('Teacher'), on: true },
                        { key: 'state', label: t('Status'), on: true },
                        { key: 'taught', label: t('Taught so far'), on: true },
                        {
                            key: 'planned',
                            label: t('Planned so far'),
                            on: true,
                        },
                        { key: 'topics', label: t('Sub-topics'), on: false },
                        { key: 'coverage', label: t('Coverage %'), on: false },
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

export default withAppShell(SchemesIndex);
