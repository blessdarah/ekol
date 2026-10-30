import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { home } from '@/actions/App/Http/Controllers/ParentController';
import { amount } from '@/actions/App/Http/Controllers/PayController';
import {
    PhoneFeeReceipt,
    PrintedFeeReceipt,
    type FeeReceiptProps,
} from '../../components/fees/fee-receipt';
import {
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { t } from '../../lib/i18n';

export default function Receipt(props: FeeReceiptProps) {
    const [shareMessage, setShareMessage] = useState('');
    async function share() {
        const data = {
            title: `${t('Fee receipt')} ${props.receipt.number}`,
            url: props.receipt.verification_url,
        };
        try {
            if (navigator.share) {
                await navigator.share(data);
            } else {
                await navigator.clipboard.writeText(data.url);
                setShareMessage(t('Verification link copied.'));
            }
        } catch (error) {
            if (
                !(error instanceof DOMException && error.name === 'AbortError')
            ) {
                setShareMessage(
                    t(
                        'Could not share. Open the verification link below to copy it.',
                    ),
                );
            }
        }
    }
    return (
        <div className="min-h-screen bg-[#EEF1EF] px-[14px] py-5 font-auth text-text print:bg-white print:p-0">
            <Head
                title={t('Receipt :number', {
                    number: props.receipt.number ?? '',
                })}
            />
            <nav className="mx-auto mb-4 flex max-w-[420px] items-center justify-between gap-3 print:hidden">
                <Link
                    href={home.url()}
                    className="text-[14px] font-semibold text-primary"
                >
                    ← {t('Parent services')}
                </Link>
                <button
                    type="button"
                    onClick={() => window.print()}
                    className={outlineButtonClass}
                >
                    {t('Print / PDF')}
                </button>
            </nav>
            <div className="print:hidden">
                <PhoneFeeReceipt {...props} />
            </div>
            <div className="hidden print:block">
                <PrintedFeeReceipt {...props} />
            </div>
            <div className="mx-auto mt-4 flex max-w-[420px] gap-3 print:hidden">
                {props.receipt.can_pay && (
                    <Link
                        href={amount.url()}
                        className={`${solidButtonClass} flex-1 justify-center`}
                    >
                        {t('Pay the balance')}
                    </Link>
                )}
                <button
                    type="button"
                    onClick={share}
                    className={`${outlineButtonClass} flex-1 justify-center`}
                >
                    {t('Share')}
                </button>
            </div>
            <p
                role="status"
                className="mx-auto mt-3 max-w-[420px] text-[13px] text-text-muted print:hidden"
            >
                {shareMessage}
            </p>
        </div>
    );
}
