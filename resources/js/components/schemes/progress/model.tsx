import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { index, show } from '@/actions/App/Http/Controllers/SchemeController';
import { STATES, type Steps } from '../ui';
import {
    type FilterField,
    type Paged,
    type QuickPick,
    toQuery,
    useSelection,
    useTableQuery,
} from '../../table/ui';
import { t } from '../../../lib/i18n';

export interface Row {
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

export interface Panel {
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

export interface IndexProps {
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
export const DISTRIBUTION: { states: string[]; label: string; bar: string }[] =
    [
        { states: ['on_track'], label: 'On track', bar: 'bg-success' },
        { states: ['to_approve'], label: 'To approve', bar: 'bg-science' },
        { states: ['behind'], label: 'Behind', bar: 'bg-warning' },
        {
            states: ['not_submitted', 'sent_back'],
            label: 'Not submitted',
            bar: 'bg-danger',
        },
        { states: ['waiting'], label: 'No teacher', bar: 'bg-text-disabled' },
        { states: ['closed'], label: 'Closed', bar: 'bg-text-muted' },
    ];

export const headClass =
    'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

/**
 * How far a scheme has got over the whole term: taught in solid, the
 * part planned for weeks gone but not taught striped.
 */
export function ProgressCell({ row }: { row: Row }) {
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
                                'repeating-linear-gradient(135deg, var(--color-warning-border) 0 3px, var(--color-warning-tint) 3px 6px)',
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
export function useSchemesProgress({
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
    return {
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
        writing,
        setWriting,
        exporting,
        setExporting,
        sort,
        values,
        table,
        selection,
        onTrack,
        shown,
        fields,
        quickPicks,
        filter,
        showing,
        pick,
        open,
        weeks,
        shownWeeks,
        laterItems,
    };
}
export type SchemesProgressModel = ReturnType<typeof useSchemesProgress>;
