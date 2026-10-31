import { student as ledger } from '@/actions/App/Http/Controllers/FeePaymentController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { figure } from '../../fees/ui';
import { capsLabelClass } from '../../structure/ui';
import { type ShownInvoice, type StudentFeesProps } from './model';

/** What is due now, the next payment, and the family contact. */
export function PayPanel({
    props,
    invoice,
}: {
    props: StudentFeesProps;
    invoice: ShownInvoice;
}) {
    const { currency, canManageFees, student } = props;

    return (
        <>
            <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                <p className={capsLabelClass}>
                    {invoice.next ? t('Next payment') : t('Fees')}
                </p>
                {invoice.next ? (
                    <div className="flex flex-col gap-[2px]">
                        <p className="font-mono text-[24px] leading-[30px] text-text">
                            {figure(invoice.next.amount)} {currency}
                        </p>
                        <p
                            className={`text-[13px] leading-4 ${invoice.next.late ? 'text-danger' : 'text-text-muted'}`}
                        >
                            {t('finishes the')}{' '}
                            {invoice.next.label.toLowerCase()}
                            {invoice.next.late ? t(', which is late') : ''}
                        </p>
                    </div>
                ) : (
                    <p className="text-[13px] leading-[19px] text-text">
                        {t('Paid in full for')} {invoice.year ?? t('the year')}
                        {t('. Nothing more is owed.')}
                    </p>
                )}
                {canManageFees && (
                    <div className="flex flex-col gap-2">
                        {invoice.balance > 0 && (
                            <Link
                                href={ledger.url(student.id, {
                                    query: {
                                        invoice: invoice.id,
                                        pay: '1',
                                    },
                                })}
                                className="flex h-9 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover"
                            >
                                {t('Record payment')}
                            </Link>
                        )}
                        <Link
                            href={ledger.url(student.id, {
                                query: { invoice: invoice.id },
                            })}
                            className="flex h-9 shrink-0 items-center justify-center rounded-md border border-solid border-border bg-white text-[13px] leading-4 font-medium text-text hover:bg-surface"
                        >
                            {t('Open the fee ledger')}
                        </Link>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                <p className="text-[14px] leading-[18px] font-semibold text-text">
                    {t('Reminders')}
                </p>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'Reminders are not sent from here yet. The main contact is :contact.',
                        { contact: student.contact },
                    )}
                </p>
            </div>
        </>
    );
}
