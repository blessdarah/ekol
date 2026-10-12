import { Form, Head } from '@inertiajs/react';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import {
    ErrorBanner,
    Eyebrow,
    Field,
    Heading,
    PasswordField,
    PrimaryButton,
    inputClass,
    submitOnEnter,
} from '../../components/auth/field';
import { useT } from '../../lib/i18n';

function initialsOf(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);

    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '··';
}

export default function Login({
    school,
    address,
    switchUrl,
}: {
    school: { name: string; slug: string };
    address: string;
    switchUrl: string;
}) {
    const t = useT();

    return (
        <AuthLayout
            middle={{
                variant: 'identity',
                initials: initialsOf(school.name),
                name: school.name,
                address,
            }}
            topbar={
                <TopBar
                    text={t('Not your school?')}
                    linkText={t('Switch school')}
                    href={switchUrl}
                />
            }
        >
            <Head title={`${t('Sign in')} — ${school.name}`} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>{t('Sign in')}</Eyebrow>
                    <Heading
                        title={t('Welcome back')}
                        sub={t('Sign in to manage :school.', { school: school.name })}
                    />
                </div>
                <Form action="/login" method="post" onKeyDown={submitOnEnter}>
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            {errors.identifier && (
                                <ErrorBanner
                                    title={t('Email or password is incorrect')}
                                    body={errors.identifier}
                                />
                            )}
                            <Field label={t('Email or phone')}>
                                <input
                                    type="text"
                                    name="identifier"
                                    autoComplete="username"
                                    placeholder={t('eposi.fonkem@gmail.com')}
                                    className={inputClass}
                                />
                            </Field>
                            <div className="flex flex-col gap-[6px]">
                                <span className="flex items-center justify-between text-[13px] font-medium text-text">
                                    {t('Password')}
                                    <a
                                        href="/forgot-password"
                                        className="font-normal text-text-muted hover:underline"
                                    >
                                        {t('Forgot password?')}
                                    </a>
                                </span>
                                <PasswordField
                                    label=""
                                    autoComplete="current-password"
                                    error={errors.password}
                                />
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
                                <input
                                    type="checkbox"
                                    name="remember"
                                    value="1"
                                    className="h-4 w-4 accent-primary"
                                />
                                {t('Keep me signed in on this device')}
                            </label>
                            <div className="pt-2">
                                <PrimaryButton disabled={processing}>
                                    {t('Sign in')}
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </Form>
                <div className="flex flex-col gap-1 border-t border-border pt-4">
                    <p className="text-[14px] font-semibold text-text">
                        {t('Teacher or staff member?')}
                    </p>
                    <p className="text-[13px] text-text-muted">
                        {t('Use the invite link your administrator sent you to set your password. After that you sign in here.')}
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
}
