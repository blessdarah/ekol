import { Form, Head } from '@inertiajs/react';
import { send } from '@/actions/App/Http/Controllers/Auth/PasswordResetController';
import {
    Eyebrow,
    Field,
    Heading,
    PrimaryButton,
    inputClass,
    submitOnEnter,
} from '../../components/auth/field';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import { useT } from '../../lib/i18n';

export function initialsOf(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);

    return (
        ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '··'
    );
}

export interface ResetSchool {
    name: string;
    address: string;
}

export default function ForgotPassword({
    school,
    sent,
}: {
    school: ResetSchool;
    sent: string | null;
}) {
    const t = useT();

    return (
        <AuthLayout
            middle={{
                variant: 'identity',
                initials: initialsOf(school.name),
                name: school.name,
                address: school.address,
            }}
            topbar={
                <TopBar
                    text={t('Remembered it?')}
                    linkText={t('Sign in')}
                    href="/login"
                />
            }
        >
            <Head title={`${t('Reset your password')} — ${school.name}`} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>{t('Forgot password')}</Eyebrow>
                    <Heading
                        title={t('Reset your password')}
                        sub={t(
                            'Enter the email or phone number you sign in to :school with.',
                            { school: school.name },
                        )}
                    />
                </div>

                {sent && (
                    <div
                        role="status"
                        className="flex flex-col gap-1 rounded-lg border border-solid border-success bg-success-tint px-4 py-3"
                    >
                        <p className="text-[14px] font-semibold text-success">
                            {t('Check your email')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text">
                            {t(
                                'If :email signs in to :school, a link to choose a new password is on its way. It works for one hour.',
                                {
                                    email: sent,
                                    school: school.name,
                                },
                            )}
                        </p>
                    </div>
                )}

                <Form
                    action={send.url()}
                    method="post"
                    onKeyDown={submitOnEnter}
                >
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <Field
                                label={t('Email or phone')}
                                error={errors.identifier}
                            >
                                <input
                                    type="text"
                                    name="identifier"
                                    autoComplete="username"
                                    autoFocus
                                    placeholder={t('eposi.fonkem@gmail.com')}
                                    className={inputClass}
                                />
                            </Field>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {t(
                                    'With an email we send a link. With a phone number we send a 6-digit code by SMS.',
                                )}
                            </p>
                            <div className="pt-2">
                                <PrimaryButton disabled={processing}>
                                    {sent ? t('Send again') : t('Send')}
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </Form>

                <div className="flex flex-col gap-1 border-t border-border pt-4">
                    <p className="text-[14px] font-semibold text-text">
                        {t('No access to either?')}
                    </p>
                    <p className="text-[13px] text-text-muted">
                        {t(
                            'Ask your school’s administrator. They can send you a new invitation link from Teachers & Staff.',
                        )}
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
}
