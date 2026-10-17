import { useT } from '../../lib/i18n';
import { Form, Head } from '@inertiajs/react';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import {
    Eyebrow,
    Field,
    Heading,
    PrimaryButton,
    inputClass,
    submitOnEnter,
} from '../../components/auth/field';

export default function FindSchool() {
    const t = useT();
    return (
        <AuthLayout
            middle={{
                variant: 'statement',
                title: t(
                    'Marks, fees and attendance for every class, in one place.',
                ),
                body: t(
                    'Built for secondary schools. Sequences, series and installments included.',
                ),
            }}
            topbar={
                <TopBar
                    text={t('New to Campus?')}
                    linkText={t('Register your school')}
                    href="/register"
                />
            }
        >
            <Head title={t('Find your school')} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>{t('Sign in')}</Eyebrow>
                    <Heading
                        title={t('Find your school')}
                        sub={t(
                            'Enter your school’s workspace address to continue.',
                        )}
                    />
                </div>
                <Form
                    action="/login/find-school"
                    method="post"
                    onKeyDown={submitOnEnter}
                >
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <Field
                                label={t('Workspace address')}
                                error={errors.slug}
                            >
                                <input
                                    type="text"
                                    name="slug"
                                    placeholder={t('gbhs-bamenda')}
                                    className={`${inputClass} font-mono`}
                                />
                            </Field>
                            <div className="pt-2">
                                <PrimaryButton disabled={processing}>
                                    {t('Continue')}
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </Form>
                <div className="flex flex-col gap-1 border-t border-border pt-4">
                    <p className="text-[14px] font-semibold text-text">
                        {t('Don’t know your address?')}
                    </p>
                    <p className="text-[13px] text-text-muted">
                        {t(
                            'It is in the welcome email sent when your school registered.',
                        )}
                    </p>
                </div>
                <p className="text-[13px] text-text-muted">
                    {t('A parent?')}{' '}
                    <a
                        href="/parents"
                        className="font-semibold text-text hover:underline"
                    >
                        {t('Go to parent services')}
                    </a>
                </p>
            </div>
        </AuthLayout>
    );
}
