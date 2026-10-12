import { useT } from '../../lib/i18n';
import { Form, Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import CodeBoxes, { useCountdown } from '../../components/auth/code-boxes';
import {
    Eyebrow,
    Heading,
    PrimaryButton,
} from '../../components/auth/field';

const STEPS = [
    { title: 'School', sub: 'Name, location and type' },
    { title: 'Administrator', sub: 'Who will manage the school' },
    { title: 'Verify', sub: 'Confirm your email address' },
];

export default function VerifyCode({
    email,
    expiresAt,
    channel,
}: {
    email?: string;
    expired: boolean;
    expiresAt: string;
    channel: string;
}) {
    const { label, expired } = useCountdown(expiresAt);
    const [changingEmail, setChangingEmail] = useState(false);
    const t = useT();

    return (
        <AuthLayout
            middle={{ variant: 'stepper', steps: STEPS, active: 2 }}
            topbar={
                <TopBar
                    text={t('Already registered?')}
                    linkText={t('Sign in')}
                    href="/login"
                />
            }
        >
            <Head title={t('Check your email')} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>{t('Step :step of :total', { step: 3, total: 3 })}</Eyebrow>
                    <Heading
                        title={t('Check your email')}
                        sub={email ? t('We sent a 6-digit code to :email.', { email }) : t('We sent a 6-digit code to your email address.')}
                    />
                </div>
                <Form action="/register/verify" method="post">
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <span className="text-[13px] font-medium text-text">
                                {t('Verification code')}
                            </span>
                            <CodeBoxes />
                            {errors.code && (
                                <span className="text-[13px] text-danger">
                                    {errors.code}
                                </span>
                            )}
                            <div className="flex items-center gap-3 text-[13px] text-text-muted">
                                {expired ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post('/register/resend')
                                        }
                                        className="font-medium text-text hover:underline"
                                    >
                                        {t('Resend code')}
                                    </button>
                                ) : (
                                    <span>{t('Resend in :time', { time: label })}</span>
                                )}
                                <span className="h-[14px] w-px bg-border" />
                                {channel === 'email' ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post('/register/channel', {
                                                channel: 'sms',
                                            })
                                        }
                                        className="hover:underline"
                                    >
                                        {t('Send by SMS instead')}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post('/register/channel', {
                                                channel: 'email',
                                            })
                                        }
                                        className="hover:underline"
                                    >
                                        {t('Send by email instead')}
                                    </button>
                                )}
                                <span className="h-[14px] w-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setChangingEmail(!changingEmail)
                                    }
                                    className="hover:underline"
                                >
                                    {t('Change email')}
                                </button>
                            </div>
                            {changingEmail && (
                                <span className="flex items-center gap-2">
                                    <input
                                        type="email"
                                        id="change-email-input"
                                        placeholder={t('New email address')}
                                        className="h-9 rounded-lg border border-solid border-border bg-white px-3 text-[14px] text-text outline-none focus:border-primary"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const input =
                                                document.getElementById(
                                                    'change-email-input',
                                                ) as HTMLInputElement | null;
                                            if (input?.value) {
                                                router.post('/register/email', {
                                                    email: input.value,
                                                });
                                            }
                                        }}
                                        className="inline-flex h-9 items-center rounded-lg border border-solid border-border px-4 text-[14px] font-medium text-text"
                                    >
                                        {t('Save')}
                                    </button>
                                </span>
                            )}
                            <div className="flex items-center gap-4 pt-2">
                                <PrimaryButton disabled={processing}>
                                    {t('Verify and create workspace')}
                                </PrimaryButton>
                            </div>
                            <p className="text-[13px] text-text-muted">
                                {t('The code expires in 10 minutes.')}
                            </p>
                        </div>
                    )}
                </Form>
                <div className="flex flex-col gap-1 border-t border-border pt-4">
                    <p className="text-[14px] font-semibold text-text">
                        {t('Not arriving?')}
                    </p>
                    <p className="text-[13px] text-text-muted">
                        {t('Check your spam folder first. On a slow connection a code can take a minute to arrive.')}
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
}
