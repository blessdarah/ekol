import { useState } from 'react';
import { index } from '@/actions/App/Http/Controllers/SubjectController';
import {
    type FilterField,
    type QuickPick,
    useSelection,
    useTableQuery,
} from '../../table/ui';
import { t } from '../../../lib/i18n';

export interface SubjectRow {
    id: string;
    name: string;
    code: string;
    department: string;
    domain: string | null;
    kind: string;
    levels: string[];
    coefficient: number | null;
    classes: number;
    teachers: number;
    unstaffed: number;
    not_taught: string[];
    periods: number;
}

export interface Filters {
    q: string;
    department: string[];
    level: string[];
    staffing: string;
    sort: string;
}

export interface RosterProps {
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

export const headClass =
    'shrink-0 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

export function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? t(one) : t(many)}`;
}

/** The subjects as filtered, sorted and paged, and which are selected. */
export function useSubjectRoster({
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

    return {
        yearLabel,
        counts,
        departments,
        levels,
        subjects,
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

export type SubjectRosterModel = ReturnType<typeof useSubjectRoster>;
