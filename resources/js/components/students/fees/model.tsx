import { amberText } from '../../fees/ui';
import { type StudentNeighbours } from '../ui';

export interface InstallmentRow {
    seq: number;
    label: string;
    due_on: string;
    amount: number;
    paid: number;
    state: string;
    days_late: number;
}

export interface Exemption {
    kind: string;
    percent: number | null;
    amount: number;
    reason: string;
    by: string | null;
    on: string;
}

export interface StudentFeesProps {
    neighbours?: StudentNeighbours;
    currency: string;
    canManageFees: boolean;
    canManageStudents: boolean;
    student: {
        id: string;
        name: string;
        matricule: string;
        class: string | null;
        level: string | null;
        admitted_year: string;
        contact: string;
    };
    invoices: { id: string; year: string | null; balance: number }[];
    invoice: {
        id: string;
        year: string | null;
        gross: number;
        exempted: number;
        due: number;
        paid: number;
        balance: number;
        overdue: number;
        installments: InstallmentRow[];
        items: {
            name: string;
            upfront: boolean;
            billed: number;
            amount: number;
            paid: number;
            balance: number;
        }[];
        exemption: Exemption | null;
        next: { amount: number; label: string; late: boolean } | null;
        payments: {
            id: string;
            on: string;
            method: string;
            by: string | null;
            amount: number;
            receipt: string | null;
        }[];
    } | null;
}

export const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

export const STATUS: Record<
    string,
    { label: string; pill: string; dot: string }
> = {
    paid: {
        label: 'Paid',
        pill: 'bg-success-tint text-success',
        dot: 'bg-success',
    },
    partial: {
        label: 'Partial',
        pill: `bg-warning-tint ${amberText}`,
        dot: 'bg-warning',
    },
    overdue: {
        label: 'Overdue',
        pill: 'bg-danger-tint text-danger',
        dot: 'bg-danger',
    },
};

/** The invoice shown on the page, once there is one. */
export type ShownInvoice = NonNullable<StudentFeesProps['invoice']>;
