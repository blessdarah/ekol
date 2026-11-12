import { Link } from '@inertiajs/react';
import { student as ledger } from '@/actions/App/Http/Controllers/FeePaymentController';
import { amberText, figure } from '../ui';
import { t } from '../../../lib/i18n';
import { type Invoice, type StudentFeesModel } from './model';

/** The student's invoices by year, to switch between. */
export function YearSwitch({
    fees,
    invoice,
}: {
    fees: StudentFeesModel;
    invoice: Invoice;
}) {
    const { student, invoices } = fees;

    return (
        <div className="flex flex-wrap gap-2">
            {invoices.map((option) => (
                <Link
                    key={option.id}
                    href={ledger.url(student.id, {
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
