import { Head, Link } from '@inertiajs/react';
import { student as ledger } from '@/actions/App/Http/Controllers/FeePaymentController';
import {
    PhoneFeeReceipt,
    PrintedFeeReceipt,
    type FeeReceiptProps,
} from '../../components/fees/fee-receipt';
import {
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Receipt(props: FeeReceiptProps) {
    return (
        <div className="flex flex-col gap-5 print:block">
            <Head
                title={t('Receipt :number', {
                    number: props.receipt.number ?? '',
                })}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div>
                    <h1 className="font-display text-[28px] leading-8 font-bold">
                        {t('Fee receipt')}
                    </h1>
                    <p className="mt-1 text-[13px] text-text-muted">
                        {t(
                            'A5 landscape. Print to paper or choose Save as PDF.',
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {props.student.id && (
                        <Link
                            href={ledger.url(props.student.id)}
                            className={outlineButtonClass}
                        >
                            {t('← Back to the ledger')}
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className={solidButtonClass}
                    >
                        {t('Print receipt / PDF')}
                    </button>
                </div>
            </div>
            <div className="lg:hidden print:hidden">
                <PhoneFeeReceipt {...props} />
            </div>
            <div className="receipt-preview hidden lg:block print:block">
                <PrintedFeeReceipt {...props} />
            </div>
        </div>
    );
}

export default withAppShell(Receipt);
