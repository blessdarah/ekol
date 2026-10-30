import { moneyNumber, moneyUnits } from '@/lib/money';
import { t } from '../../../lib/i18n';
import { dayMonth, figure } from '../../fees/ui';
import { capsLabelClass } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { type ShownInvoice, STATUS } from './model';

/** Each installment: when it is due, what is paid and what is late. */
export function Installments({ invoice }: { invoice: ShownInvoice }) {
    return (
        <section className="flex flex-col gap-2">
            <p className={capsLabelClass}>{t('Installments')}</p>
            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                <div className="flex min-w-[600px] flex-col">
                    <div
                        className={`flex h-[34px] shrink-0 items-center gap-3 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                    >
                        <span className="w-[110px] shrink-0">
                            {t('Installment')}
                        </span>
                        <span className="w-[70px] shrink-0">{t('Due')}</span>
                        <span className="flex-1 text-right">{t('Amount')}</span>
                        <span className="w-20 shrink-0 text-right">
                            {t('Paid')}
                        </span>
                        <span className="w-20 shrink-0 text-right">
                            {t('Balance')}
                        </span>
                        <span className="w-[110px] shrink-0">
                            {t('Status')}
                        </span>
                    </div>
                    {invoice.installments.map((row, position) => {
                        const status = STATUS[row.state];
                        const left = moneyNumber(
                            (moneyUnits(row.amount) ?? 0n) -
                                (moneyUnits(row.paid) ?? 0n),
                        );
                        const share =
                            invoice.due > 0
                                ? Math.round((row.amount / invoice.due) * 100)
                                : 0;

                        return (
                            <div
                                key={row.seq}
                                className={`flex h-[46px] shrink-0 items-center gap-3 border-b border-solid border-border px-4 ${tableRowClass({ index: position })}`}
                            >
                                <span className="w-[110px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text">
                                    {row.label.replace(' installment', '')} ·{' '}
                                    {share}%
                                </span>
                                <span className="w-[70px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                    {dayMonth(row.due_on, false)}
                                </span>
                                <span className="flex-1 text-right font-mono text-[13px] leading-4 text-text">
                                    {figure(row.amount)}
                                </span>
                                <span
                                    className={`w-20 shrink-0 text-right font-mono text-[13px] leading-4 ${row.paid > 0 ? 'text-text' : 'text-text-muted'}`}
                                >
                                    {figure(row.paid)}
                                </span>
                                <span
                                    className={`w-20 shrink-0 text-right font-mono text-[13px] leading-4 ${left > 0 ? 'text-text' : 'text-text-muted'}`}
                                >
                                    {left > 0 ? figure(left) : '—'}
                                </span>
                                <span className="flex w-[110px] shrink-0">
                                    {status ? (
                                        <span
                                            className={`flex h-6 items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${status.pill}`}
                                        >
                                            <span
                                                className={`h-[6px] w-[6px] shrink-0 rounded-full ${status.dot}`}
                                            />
                                            {t(status.label)}
                                        </span>
                                    ) : (
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {t('Not yet due')}
                                        </span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                    <div className="flex h-10 shrink-0 items-center gap-3 bg-surface px-4">
                        <span className="w-[110px] shrink-0 text-[13px] leading-4 font-semibold text-text">
                            {t('Total')}
                        </span>
                        <span className="w-[70px] shrink-0" />
                        <span className="flex-1 text-right font-mono text-[13px] leading-4 text-text">
                            {figure(invoice.due)}
                        </span>
                        <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                            {figure(invoice.paid)}
                        </span>
                        <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                            {figure(invoice.balance)}
                        </span>
                        <span className="w-[110px] shrink-0" />
                    </div>
                </div>
            </div>
        </section>
    );
}
