import { figure } from '../ui';
import { capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type Invoice, type StudentFeesModel } from './model';

/** What is still owed, what was paid, and how much of it is overdue. */
export function BalanceSummary({
    fees,
    invoice,
}: {
    fees: StudentFeesModel;
    invoice: Invoice;
}) {
    const { currency, share } = fees;

    return (
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
    );
}
