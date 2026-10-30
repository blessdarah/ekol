import { studentTab } from '@/actions/App/Http/Controllers/FeeController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { amberText, figure } from '../../fees/ui';
import { type ShownInvoice, type StudentFeesProps } from './model';

/** The years the student was billed, to switch between invoices. */
export function InvoiceYears({
    props,
    invoice,
}: {
    props: StudentFeesProps;
    invoice: ShownInvoice;
}) {
    const { student, invoices } = props;

    return (
        <div className="flex flex-wrap gap-2">
            {invoices.map((option) => (
                <Link
                    key={option.id}
                    href={studentTab.url(student.id, {
                        query: { invoice: option.id },
                    })}
                    aria-current={option.id === invoice.id ? 'page' : undefined}
                    className={`flex h-8 items-center gap-2 rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                        option.id === invoice.id
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-border font-medium text-text hover:bg-surface'
                    }`}
                >
                    {option.year}
                    <span
                        className={`font-mono text-[12px] font-normal ${option.balance > 0 ? amberText : 'text-text-muted'}`}
                    >
                        {option.balance > 0
                            ? t(':balance owed', {
                                  balance: figure(option.balance),
                              })
                            : t('paid')}
                    </span>
                </Link>
            ))}
        </div>
    );
}
