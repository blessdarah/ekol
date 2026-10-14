import { Form, Head, router } from '@inertiajs/react';
import {
    resend,
    show,
    verify,
} from '@/actions/App/Http/Controllers/ParentController';
import CodeBoxes, { useCountdown } from '../../components/auth/code-boxes';
import {
    PayHeading,
    PayShell,
    payButtonClass,
    type Issuer,
} from '../../components/pay/ui';
import { useT } from '../../lib/i18n';

interface VerifyProps {
    issuer: Issuer;
    phone: string;
    expiresAt: string;
    resendAt: string;
}

export default function VerifyParent({
    issuer,
    phone,
    expiresAt,
    resendAt,
}: VerifyProps) {
    const t = useT();
    const code = useCountdown(expiresAt);
    const wait = useCountdown(resendAt);

    return (
        <PayShell issuer={issuer} back={show.url()}>
            <Head title={t('Enter your code')} />
            <PayHeading
                title={t('Enter your code')}
                sub={t(
                    'We sent a 6-digit code by SMS to :phone, the number the school has for you.',
                    { phone: `+237 ${phone}` },
                )}
            />
            <Form
                action={verify.url()}
                method="post"
                className="flex flex-col gap-4"
            >
                {({ errors, processing }) => (
                    <>
                        <CodeBoxes />
                        {errors.code && (
                            <p className="text-[13px] text-danger">
                                {errors.code}
                            </p>
                        )}
                        <p className="text-[13px] text-text-muted">
                            {code.expired
                                ? t('This code has expired. Request a new one.')
                                : t('The code expires in :time.', {
                                      time: code.label,
                                  })}
                        </p>
                        <button
                            type="submit"
                            disabled={processing || code.expired}
                            className={payButtonClass}
                        >
                            {t('Continue')}
                        </button>
                    </>
                )}
            </Form>
            <div className="flex flex-col items-center gap-1 text-[14px]">
                <span className="text-text-muted">{t('No SMS yet?')}</span>
                {wait.expired ? (
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                resend.url(),
                                {},
                                { preserveScroll: true },
                            )
                        }
                        className="font-semibold text-primary hover:underline"
                    >
                        {t('Send a new code')}
                    </button>
                ) : (
                    <span className="text-text-muted">
                        {t('You can ask for a new code in :time.', {
                            time: wait.label,
                        })}
                    </span>
                )}
            </div>
            <p className="text-[13px] text-text-muted">
                {t(
                    'This phone is remembered for 30 days after the code is accepted, so you will not need a code every visit.',
                )}
            </p>
        </PayShell>
    );
}
