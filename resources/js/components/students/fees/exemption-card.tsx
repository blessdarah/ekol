import { moneyNumber, moneyUnits, percentageDiscount } from '@/lib/money';
import {
    exempt,
    removeExemption,
} from '@/actions/App/Http/Controllers/FeeExemptionController';
import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { t } from '../../../lib/i18n';
import { dayMonth, figure } from '../../fees/ui';
import { ErrorText } from '../../structure/ui';
import { linkClass, type StudentFeesProps } from './model';

/** A discount or exemption on the invoice: what it is, and changing it. */
export function ExemptionCard({
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
        value: current
            ? String(
                  current.kind === 'percent'
                      ? (current.percent ?? '')
                      : current.amount,
              )
            : '',
        reason: current?.reason ?? '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const valueUnits = moneyUnits(form.data.value) ?? 0n;
    const grossUnits = moneyUnits(invoice.gross) ?? 0n;
    const paidUnits = moneyUnits(invoice.paid) ?? 0n;
    const offUnits =
        form.data.kind === 'percent'
            ? percentageDiscount(grossUnits, valueUnits)
            : valueUnits;
    const roomUnits = grossUnits - paidUnits;
    const afterUnits = grossUnits - offUnits;

    if (open) {
        return (
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.transform((data) => ({
                        ...data,
                        value: data.value.trim(),
                    }));
                    form.post(exempt.url(invoice.id), {
                        preserveScroll: true,
                        onSuccess: () => setOpen(false),
                    });
                }}
                className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-white p-4"
            >
                <p className="text-[13px] leading-4 font-semibold text-text">
                    {t('Exemption or discount')}
                </p>
                <div
                    role="radiogroup"
                    aria-label={t('How much')}
                    className="flex rounded-md bg-surface p-[3px]"
                >
                    {[
                        { key: 'percent', label: t('Percentage') },
                        { key: 'amount', label: t('Fixed amount') },
                    ].map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={form.data.kind === option.key}
                            onClick={() =>
                                form.setData({
                                    ...form.data,
                                    kind: option.key,
                                    value: '',
                                })
                            }
                            className={`flex h-[30px] flex-1 items-center justify-center rounded-[6px] text-[13px] leading-4 ${
                                form.data.kind === option.key
                                    ? 'bg-white font-semibold text-text shadow-[0_1px_2px_color-mix(in_srgb,var(--color-text)_7.84%,transparent)]'
                                    : 'font-medium text-text-muted hover:text-text'
                            }`}
                        >
                            {t(option.label)}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-[6px]">
                    <div className="flex h-10 items-center gap-2 rounded-md border border-solid border-border bg-white px-3 focus-within:border-primary">
                        <input
                            type="text"
                            inputMode="decimal"
                            aria-label={
                                form.data.kind === 'percent'
                                    ? t('Percentage off')
                                    : t('Amount off')
                            }
                            autoFocus
                            value={form.data.value}
                            onChange={(e) =>
                                form.setData(
                                    'value',
                                    e.target.value.replace(/[^\d.]/g, ''),
                                )
                            }
                            className="w-full min-w-0 bg-transparent font-mono text-[16px] leading-5 text-text outline-none"
                        />
                        <span className="shrink-0 text-[13px] leading-4 text-text-muted">
                            {form.data.kind === 'percent'
                                ? t('% off')
                                : t(':currency off', { currency })}
                        </span>
                    </div>
                    {form.data.kind === 'percent' && (
                        <div className="flex flex-wrap gap-[6px]">
                            {[25, 50, 100].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() =>
                                        form.setData('value', String(preset))
                                    }
                                    className="flex h-[26px] items-center rounded-full border border-solid border-border px-[10px] text-[12px] leading-4 text-text hover:bg-surface"
                                >
                                    {preset === 100
                                        ? t('Full exemption')
                                        : `${preset}%`}
                                </button>
                            ))}
                        </div>
                    )}
                    <ErrorText message={errors.value ?? errors.kind} />
                </div>
                <label className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                    {t('Reason')}
                    <input
                        type="text"
                        value={form.data.reason}
                        onChange={(e) => form.setData('reason', e.target.value)}
                        placeholder={t('Staff child, scholarship, hardship…')}
                        className="h-9 w-full rounded-md border border-solid border-border px-3 text-[13px] leading-4 font-normal text-text outline-none focus:border-primary"
                    />
                    <ErrorText message={errors.reason} />
                </label>
                <p
                    className={`text-[12px] leading-[17px] ${offUnits > roomUnits ? 'text-danger' : 'text-text-muted'}`}
                >
                    {valueUnits > 0n
                        ? t(
                              'Takes :off :currency off. :off_a would be owed for the year.',
                              {
                                  off: figure(moneyNumber(offUnits)),
                                  currency,
                                  off_a: figure(
                                      moneyNumber(
                                          afterUnits > 0n ? afterUnits : 0n,
                                      ),
                                  ),
                              },
                          )
                        : t('Billed :gross :currency.', {
                              gross: figure(invoice.gross),
                              currency,
                          })}
                    {invoice.paid > 0 &&
                        t(
                            ' :paid is already paid, so at most :room can come off.',
                            {
                                paid: figure(invoice.paid),
                                room: figure(moneyNumber(roomUnits)),
                            },
                        )}
                </p>
                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={form.processing || valueUnits <= 0n}
                        className="flex h-9 items-center rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                        {current ? t('Save change') : t('Apply')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="text-[13px] leading-4 font-medium text-text-muted hover:underline"
                    >
                        {t('Cancel')}
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
                        {current.amount >= invoice.gross
                            ? t('Full exemption')
                            : current.kind === 'percent'
                              ? t(':percent% discount', {
                                    percent: current.percent,
                                })
                              : t('Discount')}
                    </p>
                    <span className="font-mono text-[13px] leading-4 text-text">
                        −{figure(current.amount)} {currency}
                    </span>
                </div>
                <p className="text-[13px] leading-[19px] text-text">
                    {current.reason}
                </p>
                <p className="text-[12px] leading-[17px] text-text-muted">
                    {current.by
                        ? t('Granted by :by on ', { by: current.by })
                        : t('Granted on ')}
                    {dayMonth(current.on)}
                    {t('. Billed')} {figure(invoice.gross)}
                    {t(', now')} {figure(invoice.due)} {t('for the year.')}
                </p>
                {canManage && (
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => setOpen(true)}
                            className={linkClass}
                        >
                            {t('Change')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        t(
                                            'Remove this exemption? The full fee becomes owed again.',
                                        ),
                                    )
                                ) {
                                    router.delete(
                                        removeExemption.url(invoice.id),
                                        { preserveScroll: true },
                                    );
                                }
                            }}
                            className="text-[13px] leading-4 font-medium text-danger hover:underline"
                        >
                            {t('Remove')}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
            <p className="text-[13px] leading-4 font-semibold text-text">
                {t('Exemption or discount')}
            </p>
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'None applied. Changes to the school fee plan do not change students already billed.',
                )}
            </p>
            {canManage && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={`self-start ${linkClass}`}
                >
                    {t('Add exemption')}
                </button>
            )}
        </div>
    );
}
