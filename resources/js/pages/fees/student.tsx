import { moneyNumber, moneyUnits } from '@/lib/money';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    index as feesIndex,
    pay,
    receipt,
    structure,
    student as ledger,
    studentTab as feesTab,
} from '@/actions/App/Http/Controllers/FeeController';
import {
    StatePill,
    amberText,
    dayMonth,
    figure,
} from '../../components/fees/ui';
import Breadcrumbs from '../../components/shell/breadcrumbs';
import {
    ErrorText,
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface InstallmentRow {
    seq: number;
    label: string;
    due_on: string;
    amount: number;
    paid: number;
    state: string;
    days_late: number;
}

interface StudentFeesProps {
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

function Marker({ state, current }: { state: string; current: boolean }) {
    if (state === 'paid') {
        return (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success">
                <svg width="14" height="14" viewBox="0 0 24 24">
                    <path
                        d="M5 12l5 5 9-10"
                        fill="none"
                        stroke="var(--color-bg)"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                </svg>
            </span>
        );
    }

    if (current) {
        return (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-solid border-warning">
                <span className="h-[10px] w-[10px] shrink-0 rounded-full bg-warning" />
            </span>
        );
    }

    return (
        <span className="h-7 w-7 shrink-0 rounded-full border-2 border-solid border-border" />
    );
}

function PaymentDrawer({
    invoice,
    studentId,
    currency,
    today,
    methods,
    onClose,
}: {
    invoice: NonNullable<StudentFeesProps['invoice']>;
    studentId: string;
    currency: string;
    today: string;
    methods: StudentFeesProps['methods'];
    onClose: () => void;
}) {
    const target = invoice.installments.find((row) => row.state !== 'paid');
    const balanceUnits = moneyUnits(invoice.balance) ?? 0n;
    const targetUnits = target
        ? (moneyUnits(target.amount) ?? 0n)
        : balanceUnits;
    const paidUnits = target ? (moneyUnits(target.paid) ?? 0n) : 0n;
    const form = useForm({
        invoice_id: invoice.id,
        amount: String(
            invoice.overdue > 0
                ? invoice.overdue
                : moneyNumber(targetUnits - paidUnits),
        ),
        method: 'cash',
        reference: '',
        date: today,
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const amountUnits = moneyUnits(data.amount) ?? 0n;
    const appliedUnits = paidUnits + amountUnits;
    const applied = moneyNumber(
        appliedUnits < targetUnits ? appliedUnits : targetUnits,
    );
    const remaining = balanceUnits - amountUnits;
    const after = moneyNumber(remaining > 0n ? remaining : 0n);
    const over = amountUnits > balanceUnits;

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-40 flex justify-end bg-text/20"
            onClick={onClose}
        >
            <form
                role="dialog"
                aria-modal="true"
                aria-label={t('Record payment')}
                onClick={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                    event.preventDefault();
                    form.transform((values) => ({
                        ...values,
                        amount: values.amount.trim(),
                        reference: values.reference.trim() || null,
                    }));
                    form.post(pay.url(studentId));
                }}
                className="flex h-full w-full max-w-[400px] flex-col border-l border-solid border-border bg-white shadow-[-12px_0_32px_color-mix(in_srgb,var(--color-text)_5.88%,transparent)]"
            >
                <div className="flex items-center justify-between border-b border-solid border-border px-6 pt-6 pb-5">
                    <h2 className="font-display text-[20px] leading-6 font-bold tracking-[-0.01em] text-text">
                        {t('Record payment')}
                    </h2>
                    <button
                        type="button"
                        aria-label={t('Close')}
                        onClick={onClose}
                        className="rounded-sm p-1 hover:bg-surface"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path
                                d="M6 6l12 12M18 6L6 18"
                                fill="none"
                                stroke="var(--color-text-muted)"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
                    <div className="flex flex-col gap-[6px]">
                        <label
                            htmlFor="payment-amount"
                            className="text-[13px] leading-4 font-medium text-text"
                        >
                            {t('Amount received')}
                        </label>
                        <div
                            className={`flex h-[52px] shrink-0 items-center justify-between rounded-md border-2 border-solid px-[14px] ${over || errors.amount ? 'border-danger' : 'border-primary'}`}
                        >
                            <input
                                id="payment-amount"
                                type="text"
                                inputMode="decimal"
                                autoFocus
                                value={data.amount}
                                onChange={(e) =>
                                    setData(
                                        'amount',
                                        e.target.value
                                            .replace(/,/g, '.')
                                            .replace(/[^\d.]/g, ''),
                                    )
                                }
                                className="w-full min-w-0 bg-transparent font-mono text-[22px] leading-7 text-text outline-none"
                            />
                            <span className="shrink-0 text-[14px] leading-[18px] font-medium text-text-muted">
                                {currency}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-[6px]">
                            {invoice.overdue > 0 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setData(
                                            'amount',
                                            String(invoice.overdue),
                                        )
                                    }
                                    className="flex h-[26px] items-center rounded-full border border-solid border-border px-[10px] text-[12px] leading-4 text-text hover:bg-surface"
                                >
                                    {t('Overdue · :overdue', {
                                        overdue: figure(invoice.overdue),
                                    })}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() =>
                                    setData('amount', String(invoice.balance))
                                }
                                className="flex h-[26px] items-center rounded-full border border-solid border-border px-[10px] text-[12px] leading-4 text-text hover:bg-surface"
                            >
                                {t('Full balance · :balance', {
                                    balance: figure(invoice.balance),
                                })}
                            </button>
                        </div>
                        <ErrorText
                            message={
                                errors.amount ??
                                (over
                                    ? `That is more than the ${figure(invoice.balance)} still owed.`
                                    : undefined)
                            }
                        />
                    </div>

                    <div className="flex flex-col gap-2 rounded-md bg-surface p-[14px]">
                        <p className={capsLabelClass}>{t('Applied to')}</p>
                        {target && (
                            <div className="flex justify-between">
                                <span className="text-[13px] leading-4 text-text">
                                    {t(target.label)}
                                </span>
                                <span className="font-mono text-[13px] leading-4 text-text">
                                    {figure(applied)} / {figure(target.amount)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t('Still owed after this')}
                            </span>
                            <span
                                className={`font-mono text-[13px] leading-4 ${after > 0 ? 'text-warning' : 'text-success'}`}
                            >
                                {figure(after)}
                            </span>
                        </div>
                        <p className="text-[12px] leading-[18px] text-text-muted">
                            {t(
                                'Payments fill the oldest unpaid installment first.',
                            )}
                        </p>
                    </div>

                    <div className="flex flex-col gap-[6px]">
                        <span className="text-[13px] leading-4 font-medium text-text">
                            {t('Method')}
                        </span>
                        <div
                            role="radiogroup"
                            aria-label={t('Method')}
                            className="flex rounded-md bg-surface p-[3px]"
                        >
                            {methods.map((method) => {
                                const on = data.method === method.value;

                                return (
                                    <button
                                        key={method.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        onClick={() =>
                                            setData('method', method.value)
                                        }
                                        className={`flex h-[30px] items-center justify-center rounded-[6px] px-2 text-[13px] leading-4 ${
                                            method.value === 'mobile_money'
                                                ? 'flex-[1.4]'
                                                : 'flex-1'
                                        } ${on ? 'bg-white font-semibold text-text shadow-[0_1px_2px_color-mix(in_srgb,var(--color-text)_7.84%,transparent)]' : 'font-medium text-text-muted hover:text-text'}`}
                                    >
                                        {t(method.label)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <label className="flex min-w-0 flex-[1.3] flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                            {data.method === 'cash'
                                ? t('Note (optional)')
                                : t('Transaction ref')}
                            <input
                                type="text"
                                value={data.reference}
                                onChange={(e) =>
                                    setData('reference', e.target.value)
                                }
                                className="h-9 w-full rounded-md border border-solid border-border px-3 font-mono text-[13px] leading-4 font-normal text-text outline-none focus:border-primary"
                            />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                            {t('Date')}
                            <input
                                type="date"
                                value={data.date}
                                max={today}
                                onChange={(e) =>
                                    setData('date', e.target.value)
                                }
                                className="h-9 w-full rounded-md border border-solid border-border px-2 text-[13px] leading-[18px] font-normal text-text outline-none focus:border-primary"
                            />
                        </label>
                    </div>
                    <ErrorText
                        message={
                            errors.reference ??
                            errors.date ??
                            errors.method ??
                            errors.invoice_id
                        }
                    />
                </div>

                <div className="flex justify-end gap-2 border-t border-solid border-border px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 items-center rounded-md px-[14px] text-[14px] leading-[18px] font-medium text-primary hover:bg-surface"
                    >
                        {t('Cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={processing || amountUnits <= 0n || over}
                        className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                        {t('Save & print receipt')}
                    </button>
                </div>
            </form>
        </div>
    );
}

function StudentFees({
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

    return (
        <div className="flex flex-col gap-7">
            <Head title={t(':student · Fees', { student: student.name })} />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <Breadcrumbs
                        trail={[
                            { label: t('Fees'), href: feesIndex.url() },
                            ...trail.slice(0, -1).map((label) => ({ label })),
                            { label: trail[trail.length - 1] ?? student.name },
                        ]}
                    />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {student.name}
                    </h1>
                    <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-4 text-text-muted">
                        <span className="font-mono">{student.matricule}</span>
                        <span>
                            {t('· Guardian: :guardian · :phone', {
                                guardian: student.guardian,
                                phone: student.phone,
                            })}
                        </span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={feesTab.url(student.id)}
                        className={outlineButtonClass}
                    >
                        {t('Student record')}
                    </Link>
                    {invoice && invoice.balance > 0 && (
                        <button
                            type="button"
                            onClick={() => setPaying(true)}
                            className={solidButtonClass}
                        >
                            {t('Record payment')}
                        </button>
                    )}
                </div>
            </div>

            {!invoice ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {t('Not billed yet')}
                    </p>
                    <p className="max-w-[560px] text-[13px] leading-[19px] text-text">
                        {student.name} {t('has no invoice. Set a fee for')}{' '}
                        {student.level ?? t('the level')}{' '}
                        {t('and bill its students under Fee structure.')}
                    </p>
                    <Link
                        href={structure.url()}
                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {t('Open Fee structure →')}
                    </Link>
                </div>
            ) : (
                <>
                    {invoices.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                            {invoices.map((option) => (
                                <Link
                                    key={option.id}
                                    href={ledger.url(student.id, {
                                        query: { invoice: option.id },
                                    })}
                                    aria-current={
                                        option.id === invoice.id
                                            ? 'page'
                                            : undefined
                                    }
                                    className={`flex h-8 items-center gap-2 rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                        option.id === invoice.id
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-border font-medium text-text hover:bg-surface'
                                    }`}
                                >
                                    {option.year}
                                    <span
                                        className={`font-mono text-[12px] font-normal ${option.balance > 0 ? amberText : 'text-text-muted'}`}
                                    >
                                        {option.balance > 0
                                            ? t(':balance owed', {
                                                  balance: figure(
                                                      option.balance,
                                                  ),
                                              })
                                            : t('paid')}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-end gap-x-12 gap-y-4 border-b border-solid border-border pb-6">
                        <div className="flex flex-col gap-1">
                            <p className={capsLabelClass}>
                                {t('Outstanding')}
                                {invoice.year ? ` · ${invoice.year}` : ''}
                            </p>
                            <p className="flex items-baseline gap-[6px]">
                                <span className="font-display text-[56px] leading-[56px] font-extrabold tracking-[-0.03em] text-text">
                                    {figure(invoice.balance)}
                                </span>
                                <span className="text-[16px] leading-5 font-medium text-text-muted">
                                    {currency}
                                </span>
                            </p>
                        </div>
                        <div className="flex flex-col gap-1 pb-[6px]">
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t('Paid')}
                            </span>
                            <span className="font-mono text-[16px] leading-5 text-success">
                                {figure(invoice.paid)}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 pb-[6px]">
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t('Annual fees')}
                            </span>
                            <span className="font-mono text-[16px] leading-5 text-text">
                                {figure(invoice.due)}
                            </span>
                        </div>
                        {invoice.exempted > 0 && (
                            <div className="flex flex-col gap-1 pb-[6px]">
                                <span className="text-[13px] leading-4 text-text-muted">
                                    {t('Exemption')}
                                    {invoice.exemption
                                        ? ` · ${invoice.exemption.reason}`
                                        : ''}
                                </span>
                                <span className="font-mono text-[16px] leading-5 text-text">
                                    {t('−:exempted of :gross', {
                                        exempted: figure(invoice.exempted),
                                        gross: figure(invoice.gross),
                                    })}
                                </span>
                            </div>
                        )}
                        <div className="flex min-w-[200px] flex-1 flex-col gap-2 pb-[10px]">
                            <span className="flex h-2 shrink-0 rounded-full bg-surface">
                                <span
                                    className="h-2 rounded-full bg-success"
                                    style={{ width: `${share}%` }}
                                />
                            </span>
                            <span className="text-right text-[12px] leading-4 text-text-muted">
                                {share}
                                {t('% paid')}
                                {invoice.overdue > 0
                                    ? t(' · :overdue of it overdue', {
                                          overdue: figure(invoice.overdue),
                                      })
                                    : invoice.balance > 0
                                      ? t(' · nothing overdue')
                                      : ''}
                            </span>
                        </div>
                    </div>

                    <section className="flex flex-col gap-3">
                        <h2 className="font-display text-[20px] leading-6 font-bold tracking-[-0.01em] text-text">
                            {t('Installments')}
                        </h2>
                        <ul className="flex flex-col">
                            {invoice.installments.map((row) => (
                                <li
                                    key={row.seq}
                                    className="flex min-h-14 shrink-0 items-center gap-4 border-b border-solid border-border py-2 last:border-b-0"
                                >
                                    <Marker
                                        state={row.state}
                                        current={row.seq === currentSeq}
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="text-[14px] leading-[18px] font-medium text-text">
                                            {t(row.label)}
                                        </span>
                                        <span
                                            className={`text-[12px] leading-4 ${row.state === 'overdue' ? 'text-danger' : 'text-text-muted'}`}
                                        >
                                            {t('Due')} {dayMonth(row.due_on)}
                                            {row.state === 'overdue' &&
                                                t(' · :days_late :days late', {
                                                    days_late: row.days_late,
                                                    days:
                                                        row.days_late === 1
                                                            ? 'day'
                                                            : 'days',
                                                })}
                                        </span>
                                    </span>
                                    <span
                                        className={`shrink-0 text-right font-mono text-[14px] leading-[18px] ${row.state === 'overdue' || row.state === 'partial' ? 'text-text' : 'text-text-muted'}`}
                                    >
                                        {figure(row.paid)} /{' '}
                                        {figure(row.amount)}
                                    </span>
                                    <span className="flex w-[110px] shrink-0 justify-end">
                                        <StatePill state={row.state} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {invoice.items.length > 1 && (
                        <section className="flex flex-col gap-3">
                            <h2 className="font-display text-[20px] leading-6 font-bold tracking-[-0.01em] text-text">
                                {t('What the bill is for')}
                            </h2>
                            <ul className="flex flex-col">
                                {invoice.items.map((item) => (
                                    <li
                                        key={item.name}
                                        className="flex min-h-11 shrink-0 items-center gap-4 border-b border-solid border-border py-2 last:border-b-0"
                                    >
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="text-[14px] leading-[18px] font-medium text-text">
                                                {item.name}
                                            </span>
                                            <span className="text-[12px] leading-4 text-text-muted">
                                                {item.upfront
                                                    ? t(
                                                          'In full with the 1st installment',
                                                      )
                                                    : t(
                                                          'Spread over the installments',
                                                      )}
                                                {item.amount < item.billed &&
                                                    t(
                                                        ' · :billed before the exemption',
                                                        {
                                                            billed: figure(
                                                                item.billed,
                                                            ),
                                                        },
                                                    )}
                                            </span>
                                        </span>
                                        <span
                                            className={`shrink-0 text-right font-mono text-[14px] leading-[18px] ${item.balance > 0 ? 'text-text' : 'text-text-muted'}`}
                                        >
                                            {figure(item.paid)} /{' '}
                                            {figure(item.amount)}
                                        </span>
                                        <span className="flex w-[110px] shrink-0 justify-end">
                                            <StatePill
                                                state={
                                                    item.balance <= 0
                                                        ? 'paid'
                                                        : item.paid > 0
                                                          ? 'partial'
                                                          : 'owing'
                                                }
                                            />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[12px] leading-[17px] text-text-muted">
                                {t(
                                    'Each payment goes to the installment due first, and inside it to these items from the top down.',
                                )}
                            </p>
                        </section>
                    )}

                    <section className="flex flex-col gap-3">
                        <h2 className="font-display text-[20px] leading-6 font-bold tracking-[-0.01em] text-text">
                            {t('Payment history')}
                        </h2>
                        {invoice.payments.length === 0 ? (
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {t('No payment has been recorded yet.')}
                            </p>
                        ) : (
                            <ul className="flex flex-col">
                                {invoice.payments.map((payment) => (
                                    <li
                                        key={payment.id}
                                        className="flex min-h-11 shrink-0 items-center gap-4 border-b border-solid border-border py-2 last:border-b-0"
                                    >
                                        <span className="w-24 shrink-0 font-mono text-[13px] leading-4 text-text-muted">
                                            {dayMonth(payment.on, false)}
                                        </span>
                                        <span className="min-w-0 flex-1 text-[14px] leading-[18px] text-text">
                                            {payment.method}
                                            {payment.reference
                                                ? t(' · ref :reference', {
                                                      reference:
                                                          payment.reference,
                                                  })
                                                : ''}
                                            {payment.by
                                                ? ` · ${payment.by}`
                                                : ''}
                                        </span>
                                        <span className="w-[120px] shrink-0 text-right font-mono text-[14px] leading-[18px] text-text">
                                            {figure(payment.amount)}
                                        </span>
                                        <Link
                                            href={receipt.url(payment.id)}
                                            className="w-[130px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary hover:underline"
                                        >
                                            {t('Receipt')}{' '}
                                            {payment.receipt ?? ''}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {paying && invoice.balance > 0 && (
                        <PaymentDrawer
                            invoice={invoice}
                            studentId={student.id}
                            currency={currency}
                            today={today}
                            methods={methods}
                            onClose={() => setPaying(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default withAppShell(StudentFees);
