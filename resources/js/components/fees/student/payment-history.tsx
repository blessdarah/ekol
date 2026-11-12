import { Link } from '@inertiajs/react';
import { receipt } from '@/actions/App/Http/Controllers/FeePaymentController';
import { dayMonth, figure } from '../ui';
import { t } from '../../../lib/i18n';
import { type Invoice } from './model';

/** The payments recorded so far, each with its receipt. */
export function PaymentHistory({ invoice }: { invoice: Invoice }) {
    return (
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
                                          reference: payment.reference,
                                      })
                                    : ''}
                                {payment.by ? ` · ${payment.by}` : ''}
                            </span>
                            <span className="w-[120px] shrink-0 text-right font-mono text-[14px] leading-[18px] text-text">
                                {figure(payment.amount)}
                            </span>
                            <Link
                                href={receipt.url(payment.id)}
                                className="w-[130px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                {t('Receipt')} {payment.receipt ?? ''}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
