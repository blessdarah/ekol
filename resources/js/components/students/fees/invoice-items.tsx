import { t } from '../../../lib/i18n';
import { amberText, figure } from '../../fees/ui';
import { capsLabelClass } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { type ShownInvoice } from './model';

/** What the bill is made of, item by item. */
export function InvoiceItems({ invoice }: { invoice: ShownInvoice }) {
    return (
        <section className="flex flex-col gap-2">
            <p className={capsLabelClass}>{t('What the bill is for')}</p>
            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                <div className="flex min-w-[520px] flex-col">
                    <div
                        className={`flex h-[34px] shrink-0 items-center gap-3 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                    >
                        <span className="flex-1">{t('Item')}</span>
                        <span className="w-24 shrink-0 text-right">
                            {t('Amount')}
                        </span>
                        <span className="w-20 shrink-0 text-right">
                            {t('Paid')}
                        </span>
                        <span className="w-20 shrink-0 text-right">
                            {t('Balance')}
                        </span>
                    </div>
                    {invoice.items.map((item, position) => (
                        <div
                            key={item.name}
                            className={`flex min-h-10 shrink-0 items-center gap-3 border-b border-solid border-border px-4 py-2 last:border-b-0 ${tableRowClass({ index: position })}`}
                        >
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-[14px] leading-[18px] text-text">
                                    {item.name}
                                </span>
                                <span className="text-[12px] leading-4 text-text-muted">
                                    {item.upfront
                                        ? t('in full with the 1st installment')
                                        : t('spread over the installments')}
                                </span>
                            </span>
                            <span className="w-24 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                {figure(item.amount)}
                            </span>
                            <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                {figure(item.paid)}
                            </span>
                            <span
                                className={`w-20 shrink-0 text-right font-mono text-[13px] leading-4 ${item.balance > 0 ? amberText : 'text-text-muted'}`}
                            >
                                {figure(item.balance)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
