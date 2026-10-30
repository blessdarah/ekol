import { Head } from '@inertiajs/react';
import { dayMonth } from '../../components/fees/ui';
import { numberLocale, t } from '../../lib/i18n';

export default function VerifyReceipt({
    issuer,
    receipt,
}: {
    issuer: string;
    receipt: {
        number: string;
        amount: number;
        currency: string;
        on: string;
        reference: string | null;
    };
}) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8 font-auth text-text">
            <Head title={t('Receipt verification')} />
            <article className="w-full max-w-[420px] rounded-xl border border-border bg-white p-6">
                <p className="mb-3 font-semibold text-success">
                    ✓ {t('Receipt verified')}
                </p>
                <h1 className="font-serif text-[24px] text-primary">
                    {issuer}
                </h1>
                <p className="mt-5 font-mono text-[14px]">{receipt.number}</p>
                <p className="mt-2 font-serif text-[32px]">
                    {new Intl.NumberFormat(numberLocale(), {
                        maximumFractionDigits: 2,
                    }).format(receipt.amount)}{' '}
                    {receipt.currency}
                </p>
                <p className="mt-2 text-[13px] text-text-muted">
                    {dayMonth(receipt.on)}
                </p>
                {receipt.reference && (
                    <div className="mt-4 border-t border-border pt-4 text-[13px]">
                        <p className="text-text-muted">
                            {t('Payment reference')}
                        </p>
                        <p className="mt-1 font-mono break-all">
                            {receipt.reference}
                        </p>
                    </div>
                )}
                <p className="mt-5 border-t border-border pt-4 text-[13px] text-text-muted">
                    {t(
                        'This payment is recorded by the school. Student details are private. Contact the school bursary if the receipt does not match these details.',
                    )}
                </p>
            </article>
        </main>
    );
}
