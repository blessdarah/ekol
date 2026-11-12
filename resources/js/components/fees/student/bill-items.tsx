import { StatePill, figure } from '../ui';
import { t } from '../../../lib/i18n';
import { type Invoice } from './model';

/** The fee items the bill is made of, and how much of each is paid. */
export function BillItems({ invoice }: { invoice: Invoice }) {
    return (
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
                                    ? t('In full with the 1st installment')
                                    : t('Spread over the installments')}
                                {item.amount < item.billed &&
                                    t(' · :billed before the exemption', {
                                        billed: figure(item.billed),
                                    })}
                            </span>
                        </span>
                        <span
                            className={`shrink-0 text-right font-mono text-[14px] leading-[18px] ${item.balance > 0 ? 'text-text' : 'text-text-muted'}`}
                        >
                            {figure(item.paid)} / {figure(item.amount)}
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
    );
}
