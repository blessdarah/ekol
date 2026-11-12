import { moneyNumber, moneyUnits } from '@/lib/money';
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { pay } from '@/actions/App/Http/Controllers/FeePaymentController';
import { figure } from '../ui';
import { ErrorText, capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type StudentFeesProps } from './model';

/** Recording money received against the invoice. */
export function PaymentDrawer({
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
                                    ? t(
                                          'That is more than the :balance still owed.',
                                          { balance: figure(invoice.balance) },
                                      )
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
