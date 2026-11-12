import { usePage } from '@inertiajs/react';
import { useState } from 'react';

export interface InstallmentRow {
    seq: number;
    label: string;
    due_on: string;
    amount: number;
    paid: number;
    state: string;
    days_late: number;
}

export interface StudentFeesProps {
    currency: string;
    student: {
        id: string;
        name: string;
        matricule: string;
        guardian: string;
        phone: string;
        level: string | null;
        class: string | null;
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
        exemption: { reason: string } | null;
        payments: {
            id: string;
            on: string;
            method: string;
            reference: string | null;
            by: string | null;
            amount: number;
            receipt: string | null;
        }[];
    } | null;
    today: string;
    methods: { value: string; label: string }[];
}

/** The invoice on screen, once the student has been billed. */
export type Invoice = NonNullable<StudentFeesProps['invoice']>;

/** One student's fees, how much of them is paid, and recording a payment. */
export function useStudentFees({
    currency,
    student,
    invoices,
    invoice,
    today,
    methods,
}: StudentFeesProps) {
    const startOpen =
        new URLSearchParams(usePage().url.split('?')[1] ?? '').get('pay') ===
        '1';
    const [paying, setPaying] = useState(
        startOpen && invoice !== null && invoice.balance > 0,
    );
    const share =
        invoice && invoice.due > 0
            ? Math.round((invoice.paid / invoice.due) * 100)
            : 0;
    const currentSeq = invoice?.installments.find(
        (row) => row.state !== 'paid',
    )?.seq;
    const trail = [student.level, student.class].filter(
        (part): part is string => Boolean(part),
    );

    return {
        currency,
        student,
        invoices,
        invoice,
        today,
        methods,
        paying,
        setPaying,
        share,
        currentSeq,
        trail,
    };
}

export type StudentFeesModel = ReturnType<typeof useStudentFees>;
