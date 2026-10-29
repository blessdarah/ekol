import { Form, Head, Link } from '@inertiajs/react';
import {
    checkCode,
    show,
} from '@/actions/App/Http/Controllers/Auth/PasswordResetController';
import CodeBoxes from '../../components/auth/code-boxes';
import { Eyebrow, Heading, PrimaryButton } from '../../components/auth/field';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import { useT } from '../../lib/i18n';
import { initialsOf, type ResetSchool } from './forgot-password';

export default function ResetCode({
    school,
    phone,
}: {
    school: ResetSchool;
    phone: string;
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
            <Head title={`${t('Enter your code')} — ${school.name}`} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>{t('Forgot password')}</Eyebrow>
                    <Heading
                        title={t('Enter your code')}
                        sub={t(
                            'If :phone signs in to :school, we sent a 6-digit code to it by SMS. It works for 15 minutes.',
                            { phone, school: school.name },
                        )}
                    />
                </div>
                <Form action={checkCode.url()} method="post">
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <CodeBoxes />
                            {errors.code && (
                                <p className="text-[13px] text-danger">
                                    {errors.code}
                                </p>
                            )}
                            <div className="pt-2">
                                <PrimaryButton disabled={processing}>
                                    {t('Continue')}
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </Form>
                <p className="text-[13px] text-text-muted">
                    {t('No SMS after a few minutes?')}{' '}
                    <Link
                        href={show.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Try again, or use your email')}
                    </Link>
                </p>
            </div>
        </AuthLayout>
    );
}
