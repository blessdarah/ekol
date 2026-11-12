import { useState } from 'react';
import { index } from '@/actions/App/Http/Controllers/FeeController';
import { t } from '../../../lib/i18n';
import {
    type FilterField,
    type FilterValues,
    type QuickPick,
    useSelection,
    useTableQuery,
} from '../../table/ui';
import { amberText } from '../ui';

export interface Filters {
    q: string;
    state: string[];
    level: string;
    class: string[];
    sort: string;
}

export interface FeesProps {
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

/**
 * What each student owes this year, filtered and sorted through the
 * query string, with the selection and export that act on it.
 */
export function useFeesOverview({
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

    return {
        yearLabel,
        currency,
        totals,
        counts,
        levels,
        classes,
        students,
        hasPlans,
        sort,
        values,
        table,
        selection,
        exporting,
        setExporting,
        fields,
        quickPicks,
        filter,
        stats,
    };
}

export type FeesOverview = ReturnType<typeof useFeesOverview>;
