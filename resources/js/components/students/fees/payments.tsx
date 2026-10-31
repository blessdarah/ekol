import { receipt } from '@/actions/App/Http/Controllers/FeePaymentController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { dayMonth, figure } from '../../fees/ui';
import { capsLabelClass } from '../../structure/ui';
import { type ShownInvoice, type StudentFeesProps, linkClass } from './model';

/** Payments received, with their receipts. */
export function Payments({
    props,
    invoice,
}: {
    props: StudentFeesProps;
    invoice: ShownInvoice;
}) {
    const { canManageFees } = props;

    return (
        <section className="flex flex-col gap-2">
            <p className={capsLabelClass}>{t('Payments')}</p>
            {invoice.payments.length === 0 ? (
                <p className="border-y border-solid border-border py-3 text-[13px] leading-[19px] text-text-muted">
                    {t('No payment has been recorded yet.')}
                </p>
            ) : (
                <ul className="flex flex-col border-b border-solid border-border">
                    {invoice.payments.map((payment) => (
                        <li
                            key={payment.id}
                            className="flex flex-wrap items-center gap-3 border-t border-solid border-border py-[11px]"
                        >
                            <span className="w-[100px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                {dayMonth(payment.on)}
                            </span>
                            <span className="w-[110px] shrink-0 font-mono text-[13px] leading-4 text-text-muted">
                                {payment.receipt ?? '—'}
                            </span>
                            <span className="w-[100px] shrink-0 text-[13px] leading-4 text-text">
                                {payment.method}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-text-muted">
                                {payment.by
                                    ? t('Recorded by the :by', {
                                          by: payment.by,
                                      })
                                    : ''}
                            </span>
                            <span className="w-[90px] shrink-0 text-right font-mono text-[14px] leading-[18px] text-text">
                                {figure(payment.amount)}
                            </span>
                            {canManageFees ? (
                                <Link
                                    href={receipt.url(payment.id)}
                                    className={`w-[84px] shrink-0 text-right ${linkClass}`}
                                >
                                    {t('Receipt')}
                                </Link>
                            ) : (
                                <span className="w-[84px] shrink-0" />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
