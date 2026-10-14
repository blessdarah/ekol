import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import {
    amount as amountPage,
    store,
} from '@/actions/App/Http/Controllers/PayController';
import {
    ChildSummary,
    OperatorBadge,
    PayHeading,
    PayShell,
    francs,
    operatorOf,
    payButtonClass,
    payInputClass,
    type ChildCard,
    type Issuer,
} from '../../components/pay/ui';
import { useT } from '../../lib/i18n';

interface PhoneProps {
    issuer: Issuer;
    student: ChildCard;
    amount: number;
    phone: string;
}

export default function PayWithMobileMoney({
    issuer,
    student,
    amount,
    phone,
}: PhoneProps) {
    const t = useT();
    const [number, setNumber] = useState(phone);
    const operator = operatorOf(number);
    const complete = number.replace(/\D/g, '').length >= 9;

    return (
        <PayShell issuer={issuer} step={2} back={amountPage.url()}>
            <Head title={`${t('Pay with mobile money')} — ${issuer.name}`} />
            <ChildSummary
                student={student}
                trailing={
                    <span className="shrink-0 font-mono text-[15px] font-semibold">
                        {francs(amount)}
                    </span>
                }
            />
            <PayHeading
                title={t('Pay with mobile money')}
                sub={t(
                    'We send a payment request to this phone. You approve it with your mobile money PIN.',
                )}
            />
            <Form
                action={store.url()}
                method="post"
                className="flex flex-col gap-4"
            >
                {({ errors, processing }) => (
                    <>
                        <label className="flex flex-col gap-[6px] text-[14px] font-medium">
                            {t('Mobile money number')}
                            <span className="flex items-center gap-2">
                                <span className="flex h-12 shrink-0 items-center rounded-xl border border-solid border-border bg-surface px-3 font-mono text-[15px] text-text-muted">
                                    +237
                                </span>
                                <span className="relative flex flex-1">
                                    <input
                                        name="phone"
                                        type="tel"
                                        inputMode="numeric"
                                        autoComplete="tel-national"
                                        value={number}
                                        onChange={(event) =>
                                            setNumber(event.target.value)
                                        }
                                        className={`${payInputClass} pr-32 font-mono`}
                                    />
                                    <span className="absolute top-1/2 right-3 -translate-y-1/2">
                                        <OperatorBadge operator={operator} />
                                    </span>
                                </span>
                            </span>
                            {errors.phone ? (
                                <span className="text-[13px] font-normal text-danger">
                                    {errors.phone}
                                </span>
                            ) : complete && !operator ? (
                                <span className="text-[13px] font-normal text-danger">
                                    {t(
                                        'Enter an MTN or Orange number of 9 digits, starting with 6.',
                                    )}
                                </span>
                            ) : (
                                <span className="text-[13px] font-normal text-text-muted">
                                    {t(
                                        'Use another number if the money is on a different phone.',
                                    )}
                                </span>
                            )}
                        </label>
                        <div className="flex flex-col gap-2 rounded-xl bg-surface px-4 py-3 text-[14px]">
                            <span className="flex justify-between gap-3">
                                <span className="text-text-muted">
                                    {t('School fees')}
                                </span>
                                <span className="font-mono">
                                    {francs(amount)}
                                </span>
                            </span>
                            <span className="flex justify-between gap-3">
                                <span className="text-text-muted">
                                    {t('Charges')}
                                </span>
                                <span>{t('Set by your operator')}</span>
                            </span>
                        </div>
                        <button
                            type="submit"
                            disabled={processing || !operator}
                            className={payButtonClass}
                        >
                            {processing
                                ? t('Sending the request…')
                                : t('Pay :amount', { amount: francs(amount) })}
                        </button>
                    </>
                )}
            </Form>
        </PayShell>
    );
}
