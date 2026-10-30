import { t } from '../../../lib/i18n';
import { amberText, figure } from '../../fees/ui';
import { capsLabelClass } from '../../structure/ui';
import { type ShownInvoice, type StudentFeesProps } from './model';

/** Billed, exempted, paid and still owed on the invoice. */
export function InvoiceTotals({
    props,
    invoice,
}: {
    props: StudentFeesProps;
    invoice: ShownInvoice;
}) {
    const { currency } = props;
    const dueNow = invoice.overdue;

    return (
        <div className="flex flex-wrap border-y border-solid border-border">
            <div className="flex min-w-[150px] flex-1 flex-col gap-1 py-[14px] pr-4">
                <span className={capsLabelClass}>
                    {t('Plan')}
                    {invoice.year ? ` · ${invoice.year}` : ''}
                </span>
                <span className="font-mono text-[20px] leading-[26px] text-text">
                    {figure(invoice.due)}
                </span>
                <span className="text-[13px] leading-4 text-text-muted">
                    {currency} ·{' '}
                    {invoice.exempted > 0
                        ? t(':gross less :exempted', {
                              gross: figure(invoice.gross),
                              exempted: figure(invoice.exempted),
                          })
                        : t('standard')}
                    , {invoice.installments.length}{' '}
                    {invoice.installments.length === 1
                        ? t('installment')
                        : t('installments')}
                </span>
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-1 border-l border-solid border-border px-4 py-[14px]">
                <span className={capsLabelClass}>{t('Paid')}</span>
                <span className="font-mono text-[20px] leading-[26px] text-success">
                    {figure(invoice.paid)}
                </span>
                <span className="text-[13px] leading-4 text-text-muted">
                    {currency} · {invoice.payments.length}{' '}
                    {invoice.payments.length === 1
                        ? t('payment')
                        : t('payments')}
                </span>
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-1 border-l border-solid border-border py-[14px] pl-4">
                <span className={capsLabelClass}>{t('Balance')}</span>
                <span
                    className={`font-mono text-[20px] leading-[26px] ${invoice.balance > 0 ? amberText : 'text-text'}`}
                >
                    {figure(invoice.balance)}
                </span>
                <span
                    className={`text-[13px] leading-4 ${dueNow > 0 ? 'text-danger' : 'text-text-muted'}`}
                >
                    {currency} ·{' '}
                    {invoice.balance <= 0
                        ? t('settled')
                        : dueNow > 0
                          ? t(':due_now overdue', {
                                due_now: figure(dueNow),
                            })
                          : t('nothing overdue')}
                </span>
            </div>
        </div>
    );
}
