import { ordinalOf } from '../../../lib/i18n';
import { type StudentNeighbours } from '../ui';

export interface Column {
    id: string;
    name: string;
    state: string;
    window_ends_on: string | null;
    average: number | null;
    complete: boolean;
    position: number | null;
    of: number;
}

export interface AcademicsProps {
    neighbours?: StudentNeighbours;
    canOpenReports: boolean;
    student: {
        id: string;
        name: string;
        matricule: string;
        class: string | null;
        class_id: string | null;
        level: string | null;
        admitted_year: string;
        series: string | null;
    };
    terms: { id: string; label: string }[];
    term: { id: string; label: string } | null;
    columns: Column[];
    focus: Column | null;
    subjects: {
        subject: string;
        coefficient: number;
        marks: Record<string, number | 'ABS' | null>;
        kind: 'core' | 'elective' | null;
        teacher: string | null;
    }[];
    coefficients: number;
    remark: { grade: string; text: string; form_master: string | null } | null;
    termAverage: number | null;
    termComplete: boolean;
}

export const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

export function mark(value: number | 'ABS' | null | undefined): string {
    return value === null || value === undefined
        ? '—'
        : value === 'ABS'
          ? 'ABS'
          : value.toFixed(2);
}

export function ordinal(position: number): string {
    return ordinalOf(position);
}

export function short(name: string): string {
    return name.replace('Sequence', 'Seq').replace(/^Term \d+ exam$/i, 'Exam');
}

export function useStudentAcademics(props: AcademicsProps) {
    const { columns } = props;
    const readable = (column: Column) =>
        ['marks_open', 'marks_closed', 'published'].includes(column.state);
    const open = columns.find((column) => column.state === 'marks_open');
    const coming = columns.find((column) => column.state === 'scheduled');
    const published = columns.filter((column) => column.state === 'published');

    return { ...props, readable, open, coming, published };
}

export type StudentAcademics = ReturnType<typeof useStudentAcademics>;
