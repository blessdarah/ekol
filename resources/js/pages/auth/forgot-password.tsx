import { useT } from '../../lib/i18n';
import { Head, Link } from '@inertiajs/react';
import AuthLayout from '../../layouts/auth-layout';
import { Heading } from '../../components/auth/field';

export default function ForgotPassword() {
    const t = useT();
    return (
        <AuthLayout
            middle={{
                variant: 'statement',
                title: t('Locked out? It happens.'),
                body: t('Self-service password reset arrives in a later change. For now, ask your school administrator to reset your password.'),
            }}
        >
            <Head title={t('Reset your password')} />
            <div className="flex flex-col gap-6">
                <Heading
                    title={t('Reset your password')}
                    sub={t('Password reset is not available yet. Your administrator can set a new password for you.')}
                />
                <Link
                    href="/login"
                    className="inline-flex h-9 items-center self-start rounded-lg border border-solid border-border px-4 text-[14px] font-medium text-text"
                >
                    {t('Back to sign in')}
                </Link>
            </div>
        </AuthLayout>
    );
}
