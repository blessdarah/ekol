import { index } from '@/actions/App/Http/Controllers/StudentRosterController';
import { useState } from 'react';
import { t } from '../../../lib/i18n';
import {
    type FilterField,
    type FilterValues,
    type QuickPick,
    useSelection,
    useTableQuery,
} from '../../table/ui';

export interface StudentRow {
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

export interface Filters {
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

export interface RosterProps {
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

export const headClass =
    'shrink-0 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

/**
 * The roster's filters, search, sort and page in the address, the
 * students ticked, and the export and row menus open.
 */
export function useStudentRoster({
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

    return {
        yearLabel,
        currency,
        counts,
        students,
        sort,
        values,
        table,
        selection,
        exporting,
        setExporting,
        openMenu,
        setOpenMenu,
        fields,
        quickPicks,
        filter,
    };
}

export type StudentRoster = ReturnType<typeof useStudentRoster>;
