import { Form, Head, Link } from '@inertiajs/react';
import {
    show,
    update,
} from '@/actions/App/Http/Controllers/Auth/PasswordResetController';
import {
    Eyebrow,
    Heading,
    PasswordField,
    PrimaryButton,
} from '../../components/auth/field';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import { useT } from '../../lib/i18n';
import { initialsOf, type ResetSchool } from './forgot-password';

export default function ResetPassword({
    token,
    school,
    member,
}: {
    token: string;
    school: ResetSchool;
    member: { name: string } | null;
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
            <Head title={`${t('Choose a new password')} — ${school.name}`} />
            {member ? (
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <Eyebrow>{t('Forgot password')}</Eyebrow>
                        <Heading
                            title={t('Choose a new password')}
                            sub={t('For :name at :school.', {
                                name: member.name,
                                school: school.name,
                            })}
                        />
                    </div>
                    <Form action={update.url(token)} method="post">
                        {({ errors, processing }) => (
                            <div className="flex flex-col gap-4">
                                <PasswordField
                                    label="New password"
                                    meter
                                    error={errors.password}
                                />
                                <p className="text-[13px] leading-[19px] text-text-muted">
                                    {t(
                                        'At least 10 characters, with at least one number.',
                                    )}
                                </p>
                                <div className="pt-2">
                                    <PrimaryButton disabled={processing}>
                                        {t('Save and sign in')}
                                    </PrimaryButton>
                                </div>
                            </div>
                        )}
                    </Form>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    <Heading
                        title={t('This link has expired')}
                        sub={t(
                            'Reset links work once, for a limited time. Ask for a new one.',
                        )}
                    />
                    <Link
                        href={show.url()}
                        className="inline-flex h-9 items-center self-start rounded-lg bg-primary px-4 text-[14px] font-medium text-white hover:bg-primary-hover"
                    >
                        {t('Ask for a new link')}
                    </Link>
                </div>
            )}
        </AuthLayout>
    );
}
