import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    exempt,
    receipt,
    removeExemption,
    structure,
    student as ledger,
    studentTab,
} from '@/actions/App/Http/Controllers/FeeController';
import { edit } from '@/actions/App/Http/Controllers/StudentController';
import { amberText, dayMonth, figure } from '../../components/fees/ui';
import { ErrorText, capsLabelClass, outlineButtonClass } from '../../components/structure/ui';
import { StudentHeader, StudentTabs } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';

interface InstallmentRow {
    seq: number;
    label: string;
    due_on: string;
    amount: number;
    paid: number;
    state: string;
    days_late: number;
}

interface Exemption {
    kind: string;
    percent: number | null;
    amount: number;
    reason: string;
    by: string | null;
    on: string;
}

interface StudentFeesProps {
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
        exemption: Exemption | null;
        next: { amount: number; label: string; late: boolean } | null;
        payments: { id: string; on: string; method: string; by: string | null; amount: number; receipt: string | null }[];
    } | null;
}

const linkClass = 'text-[13px] leading-4 font-medium text-primary hover:underline';

const STATUS: Record<string, { label: string; pill: string; dot: string }> = {
    paid: { label: 'Paid', pill: 'bg-success-tint text-success', dot: 'bg-success' },
    partial: { label: 'Partial', pill: `bg-warning-tint ${amberText}`, dot: 'bg-warning' },
    overdue: { label: 'Overdue', pill: 'bg-danger-tint text-danger', dot: 'bg-danger' },
};

function ExemptionCard({
    invoice,
    currency,
    canManage,
}: {
    invoice: NonNullable<StudentFeesProps['invoice']>;
    currency: string;
    canManage: boolean;
}) {
    const current = invoice.exemption;
    const [open, setOpen] = useState(false);
    const form = useForm({
        kind: current?.kind ?? 'percent',
        value: current ? String(current.kind === 'percent' ? (current.percent ?? '') : current.amount) : '',
        reason: current?.reason ?? '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const value = Number(form.data.value) || 0;
    const off = form.data.kind === 'percent' ? Math.round((invoice.gross * value) / 100) : value;
    const room = invoice.gross - invoice.paid;

    if (open) {
        return (
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.transform((data) => ({ ...data, value: Number(data.value) }));
                    form.post(exempt.url(invoice.id), { preserveScroll: true, onSuccess: () => setOpen(false) });
                }}
                className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-white p-4"
            >
                <p className="text-[13px] leading-4 font-semibold text-text">Exemption or discount</p>
                <div role="radiogroup" aria-label="How much" className="flex rounded-md bg-surface p-[3px]">
                    {[
                        { key: 'percent', label: 'Percentage' },
                        { key: 'amount', label: 'Fixed amount' },
                    ].map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={form.data.kind === option.key}
                            onClick={() => form.setData({ ...form.data, kind: option.key, value: '' })}
                            className={`flex h-[30px] flex-1 items-center justify-center rounded-[6px] text-[13px] leading-4 ${
                                form.data.kind === option.key
                                    ? 'bg-white font-semibold text-text shadow-[0_1px_2px_#10191514]'
                                    : 'font-medium text-text-muted hover:text-text'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-[6px]">
                    <div className="flex h-10 items-center gap-2 rounded-md border border-solid border-border bg-white px-3 focus-within:border-primary">
                        <input
                            type="text"
                            inputMode="numeric"
                            aria-label={form.data.kind === 'percent' ? 'Percentage off' : 'Amount off'}
                            autoFocus
                            value={form.data.value}
                            onChange={(e) => form.setData('value', e.target.value.replace(/[^\d.]/g, ''))}
                            className="w-full min-w-0 bg-transparent font-mono text-[16px] leading-5 text-text outline-none"
                        />
                        <span className="shrink-0 text-[13px] leading-4 text-text-muted">
                            {form.data.kind === 'percent' ? '% off' : `${currency} off`}
                        </span>
                    </div>
                    {form.data.kind === 'percent' && (
                        <div className="flex flex-wrap gap-[6px]">
                            {[25, 50, 100].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => form.setData('value', String(preset))}
                                    className="flex h-[26px] items-center rounded-full border border-solid border-border px-[10px] text-[12px] leading-4 text-text hover:bg-surface"
                                >
                                    {preset === 100 ? 'Full exemption' : `${preset}%`}
                                </button>
                            ))}
                        </div>
                    )}
                    <ErrorText message={errors.value ?? errors.kind} />
                </div>
                <label className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                    Reason
                    <input
                        type="text"
                        value={form.data.reason}
                        onChange={(e) => form.setData('reason', e.target.value)}
                        placeholder="Staff child, scholarship, hardship…"
                        className="h-9 w-full rounded-md border border-solid border-border px-3 text-[13px] leading-4 font-normal text-text outline-none focus:border-primary"
                    />
                    <ErrorText message={errors.reason} />
                </label>
                <p className={`text-[12px] leading-[17px] ${off > room ? 'text-danger' : 'text-text-muted'}`}>
                    {value > 0
                        ? `Takes ${figure(off)} ${currency} off. ${figure(Math.max(0, invoice.gross - off))} would be owed for the year.`
                        : `Billed ${figure(invoice.gross)} ${currency}.`}
                    {invoice.paid > 0 && ` ${figure(invoice.paid)} is already paid, so at most ${figure(room)} can come off.`}
                </p>
                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={form.processing || value <= 0}
                        className="flex h-9 items-center rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                        {current ? 'Save change' : 'Apply'}
                    </button>
                    <button type="button" onClick={() => setOpen(false)} className="text-[13px] leading-4 font-medium text-text-muted hover:underline">
                        Cancel
                    </button>
                </div>
            </form>
        );
    }

    if (current) {
        return (
            <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] leading-4 font-semibold text-text">
                        {current.amount >= invoice.gross ? 'Full exemption' : current.kind === 'percent' ? `${current.percent}% discount` : 'Discount'}
                    </p>
                    <span className="font-mono text-[13px] leading-4 text-text">
                        −{figure(current.amount)} {currency}
                    </span>
                </div>
                <p className="text-[13px] leading-[19px] text-text">{current.reason}</p>
                <p className="text-[12px] leading-[17px] text-text-muted">
                    {current.by ? `Granted by ${current.by} on ` : 'Granted on '}
                    {dayMonth(current.on)}. Billed {figure(invoice.gross)}, now {figure(invoice.due)} for the year.
                </p>
                {canManage && (
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setOpen(true)} className={linkClass}>
                            Change
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Remove this exemption? The full fee becomes owed again.')) {
                                    router.delete(removeExemption.url(invoice.id), { preserveScroll: true });
                                }
                            }}
                            className="text-[13px] leading-4 font-medium text-danger hover:underline"
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
            <p className="text-[13px] leading-4 font-semibold text-text">Exemption or discount</p>
            <p className="text-[13px] leading-[19px] text-text-muted">
                None applied. Changes to the school fee plan do not change
                students already billed.
            </p>
            {canManage && (
                <button type="button" onClick={() => setOpen(true)} className={`self-start ${linkClass}`}>
                    Add exemption
                </button>
            )}
        </div>
    );
}

function StudentFees({ currency, canManageFees, canManageStudents, student, invoices, invoice }: StudentFeesProps) {
    const dueNow = invoice ? invoice.overdue : 0;

    return (
        <div className="flex min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title={`${student.name} · Fees`} />
            <StudentHeader
                trail={[{ label: student.name }, { label: 'Fees' }]}
                title={student.name}
                tag={[student.matricule, student.class].filter(Boolean).join(' · ')}
                meta={[`enrolled ${student.admitted_year}`, student.level].filter(Boolean).join(' · ')}
                action={
                    canManageStudents && (
                        <Link href={edit.url(student.id)} className={outlineButtonClass}>
                            Edit student
                        </Link>
                    )
                }
            />
            <StudentTabs studentId={student.id} active="fees" overview={canManageStudents} />

            {!invoice ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">Not billed yet</p>
                    <p className="max-w-[560px] text-[13px] leading-[19px] text-text">
                        {student.name} has no invoice. Fees come from the Fee
                        structure: set a fee for {student.level ?? 'the level'}, then bill its students.
                    </p>
                    {canManageFees && (
                        <Link href={structure.url()} className={linkClass}>
                            Open Fee structure →
                        </Link>
                    )}
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                        {invoices.length > 1 && (
                            <div className="flex flex-wrap gap-2">
                                {invoices.map((option) => (
                                    <Link
                                        key={option.id}
                                        href={studentTab.url(student.id, { query: { invoice: option.id } })}
                                        aria-current={option.id === invoice.id ? 'page' : undefined}
                                        className={`flex h-8 items-center gap-2 rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                            option.id === invoice.id
                                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                : 'border-border font-medium text-text hover:bg-surface'
                                        }`}
                                    >
                                        {option.year}
                                        <span className={`font-mono text-[12px] font-normal ${option.balance > 0 ? amberText : 'text-text-muted'}`}>
                                            {option.balance > 0 ? `${figure(option.balance)} owed` : 'paid'}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap border-y border-solid border-border">
                            <div className="flex min-w-[150px] flex-1 flex-col gap-1 py-[14px] pr-4">
                                <span className={capsLabelClass}>Plan{invoice.year ? ` · ${invoice.year}` : ''}</span>
                                <span className="font-mono text-[20px] leading-[26px] text-text">{figure(invoice.due)}</span>
                                <span className="text-[13px] leading-4 text-text-muted">
                                    {currency} ·{' '}
                                    {invoice.exempted > 0 ? `${figure(invoice.gross)} less ${figure(invoice.exempted)}` : 'standard'},{' '}
                                    {invoice.installments.length} {invoice.installments.length === 1 ? 'installment' : 'installments'}
                                </span>
                            </div>
                            <div className="flex min-w-[150px] flex-1 flex-col gap-1 border-l border-solid border-border px-4 py-[14px]">
                                <span className={capsLabelClass}>Paid</span>
                                <span className="font-mono text-[20px] leading-[26px] text-success">{figure(invoice.paid)}</span>
                                <span className="text-[13px] leading-4 text-text-muted">
                                    {currency} · {invoice.payments.length} {invoice.payments.length === 1 ? 'payment' : 'payments'}
                                </span>
                            </div>
                            <div className="flex min-w-[150px] flex-1 flex-col gap-1 border-l border-solid border-border py-[14px] pl-4">
                                <span className={capsLabelClass}>Balance</span>
                                <span className={`font-mono text-[20px] leading-[26px] ${invoice.balance > 0 ? amberText : 'text-text'}`}>
                                    {figure(invoice.balance)}
                                </span>
                                <span className={`text-[13px] leading-4 ${dueNow > 0 ? 'text-danger' : 'text-text-muted'}`}>
                                    {currency} · {invoice.balance <= 0 ? 'settled' : dueNow > 0 ? `${figure(dueNow)} overdue` : 'nothing overdue'}
                                </span>
                            </div>
                        </div>

                        <section className="flex flex-col gap-2">
                            <p className={capsLabelClass}>Installments</p>
                            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                <div className="flex min-w-[600px] flex-col">
                                    <div className={`flex h-[34px] shrink-0 items-center gap-3 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}>
                                        <span className="w-[110px] shrink-0">Installment</span>
                                        <span className="w-[70px] shrink-0">Due</span>
                                        <span className="flex-1 text-right">Amount</span>
                                        <span className="w-20 shrink-0 text-right">Paid</span>
                                        <span className="w-20 shrink-0 text-right">Balance</span>
                                        <span className="w-[110px] shrink-0">Status</span>
                                    </div>
                                    {invoice.installments.map((row, position) => {
                                        const status = STATUS[row.state];
                                        const left = row.amount - row.paid;
                                        const share = invoice.due > 0 ? Math.round((row.amount / invoice.due) * 100) : 0;

                                        return (
                                            <div
                                                key={row.seq}
                                                className={`flex h-[46px] shrink-0 items-center gap-3 border-b border-solid border-border px-4 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                            >
                                                <span className="w-[110px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text">
                                                    {row.label.replace(' installment', '')} · {share}%
                                                </span>
                                                <span className="w-[70px] shrink-0 font-mono text-[13px] leading-4 text-text">{dayMonth(row.due_on, false)}</span>
                                                <span className="flex-1 text-right font-mono text-[13px] leading-4 text-text">{figure(row.amount)}</span>
                                                <span className={`w-20 shrink-0 text-right font-mono text-[13px] leading-4 ${row.paid > 0 ? 'text-text' : 'text-text-muted'}`}>
                                                    {figure(row.paid)}
                                                </span>
                                                <span className={`w-20 shrink-0 text-right font-mono text-[13px] leading-4 ${left > 0 ? 'text-text' : 'text-text-muted'}`}>
                                                    {left > 0 ? figure(left) : '—'}
                                                </span>
                                                <span className="flex w-[110px] shrink-0">
                                                    {status ? (
                                                        <span className={`flex h-6 items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${status.pill}`}>
                                                            <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${status.dot}`} />
                                                            {status.label}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[13px] leading-4 text-text-muted">Not yet due</span>
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex h-10 shrink-0 items-center gap-3 bg-surface px-4">
                                        <span className="w-[110px] shrink-0 text-[13px] leading-4 font-semibold text-text">Total</span>
                                        <span className="w-[70px] shrink-0" />
                                        <span className="flex-1 text-right font-mono text-[13px] leading-4 text-text">{figure(invoice.due)}</span>
                                        <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">{figure(invoice.paid)}</span>
                                        <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">{figure(invoice.balance)}</span>
                                        <span className="w-[110px] shrink-0" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="flex flex-col gap-2">
                            <p className={capsLabelClass}>Payments</p>
                            {invoice.payments.length === 0 ? (
                                <p className="border-y border-solid border-border py-3 text-[13px] leading-[19px] text-text-muted">
                                    No payment has been recorded yet.
                                </p>
                            ) : (
                                <ul className="flex flex-col border-b border-solid border-border">
                                    {invoice.payments.map((payment) => (
                                        <li key={payment.id} className="flex flex-wrap items-center gap-3 border-t border-solid border-border py-[11px]">
                                            <span className="w-[100px] shrink-0 font-mono text-[13px] leading-4 text-text">{dayMonth(payment.on)}</span>
                                            <span className="w-[110px] shrink-0 font-mono text-[13px] leading-4 text-text-muted">{payment.receipt ?? '—'}</span>
                                            <span className="w-[100px] shrink-0 text-[13px] leading-4 text-text">{payment.method}</span>
                                            <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-text-muted">
                                                {payment.by ? `Recorded by the ${payment.by}` : ''}
                                            </span>
                                            <span className="w-[90px] shrink-0 text-right font-mono text-[14px] leading-[18px] text-text">{figure(payment.amount)}</span>
                                            {canManageFees ? (
                                                <Link href={receipt.url(payment.id)} className={`w-[84px] shrink-0 text-right ${linkClass}`}>
                                                    Receipt
                                                </Link>
                                            ) : (
                                                <span className="w-[84px] shrink-0" />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                        <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                            <p className={capsLabelClass}>{invoice.next ? 'Next payment' : 'Fees'}</p>
                            {invoice.next ? (
                                <div className="flex flex-col gap-[2px]">
                                    <p className="font-mono text-[24px] leading-[30px] text-text">
                                        {figure(invoice.next.amount)} {currency}
                                    </p>
                                    <p className={`text-[13px] leading-4 ${invoice.next.late ? 'text-danger' : 'text-text-muted'}`}>
                                        finishes the {invoice.next.label.toLowerCase()}
                                        {invoice.next.late ? ', which is late' : ''}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-[13px] leading-[19px] text-text">
                                    Paid in full for {invoice.year ?? 'the year'}. Nothing more is owed.
                                </p>
                            )}
                            {canManageFees && (
                                <div className="flex flex-col gap-2">
                                    {invoice.balance > 0 && (
                                        <Link
                                            href={ledger.url(student.id, { query: { invoice: invoice.id, pay: '1' } })}
                                            className="flex h-9 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover"
                                        >
                                            Record payment
                                        </Link>
                                    )}
                                    <Link
                                        href={ledger.url(student.id, { query: { invoice: invoice.id } })}
                                        className="flex h-9 shrink-0 items-center justify-center rounded-md border border-solid border-border bg-white text-[13px] leading-4 font-medium text-text hover:bg-surface"
                                    >
                                        Open the fee ledger
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                            <p className="text-[14px] leading-[18px] font-semibold text-text">Reminders</p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                Reminders are not sent from here yet. The main
                                contact is {student.contact}.
                            </p>
                        </div>

                        <ExemptionCard key={`${invoice.id}-${invoice.exempted}`} invoice={invoice} currency={currency} canManage={canManageFees} />
                    </aside>
                </div>
            )}
        </div>
    );
}

export default withAppShell(StudentFees);
