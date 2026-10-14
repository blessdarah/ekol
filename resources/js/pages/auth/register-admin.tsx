import { useT } from '../../lib/i18n';
import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import {
    Eyebrow,
    Field,
    Heading,
    PasswordField,
    PrimaryButton,
    inputClass,
    submitOnEnter,
} from '../../components/auth/field';

const STEPS = [
    { title: 'School', sub: 'Name, location and type' },
    { title: 'Administrator', sub: 'Who will manage the school' },
    { title: 'Verify', sub: 'Confirm your email address' },
];

const ROLES = [
    'principal',
    'academic_lead',
    'teacher',
    'form_master',
    'admin',
    'accountant',
];

export default function RegisterAdmin({ schoolName }: { schoolName: string }) {
    const [role, setRole] = useState('admin');
    const t = useT();

    return (
        <AuthLayout
            middle={{ variant: 'stepper', steps: STEPS, active: 1 }}
            topbar={
                <TopBar
                    text={t('Already registered?')}
                    linkText={t('Sign in')}
                    href="/login"
                />
            }
        >
            <Head title={t('Create your account')} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>
                        {t('Step :step of :total', { step: 2, total: 3 })}
                    </Eyebrow>
                    <Heading
                        title={t('Create your account')}
                        sub={t('You will manage :school from this account.', {
                            school: schoolName,
                        })}
                    />
                </div>
                <Form
                    action="/register/admin"
                    method="post"
                    onKeyDown={submitOnEnter}
                >
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
                                <Field
                                    label={t('Full name')}
                                    error={errors.full_name}
                                >
                                    <input
                                        type="text"
                                        name="full_name"
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label={t('Role')} error={errors.role}>
                                    <select
                                        name="role"
                                        value={role}
                                        onChange={(e) =>
                                            setRole(e.target.value)
                                        }
                                        className={`${inputClass} bg-white`}
                                    >
                                        {ROLES.map((option) => (
                                            <option key={option} value={option}>
                                                {t(
                                                    option
                                                        .split('_')
                                                        .map(
                                                            (word) =>
                                                                word
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                word.slice(1),
                                                        )
                                                        .join(' '),
                                                )}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
                                <Field label={t('Email')} error={errors.email}>
                                    <input
                                        type="email"
                                        name="email"
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label={t('Phone')} error={errors.phone}>
                                    <input
                                        type="tel"
                                        name="phone"
                                        className={inputClass}
                                    />
                                </Field>
                            </div>
                            <PasswordField meter error={errors.password} />
                            <label className="flex cursor-pointer items-start gap-3 text-[13px] text-text">
                                <input
                                    type="checkbox"
                                    name="authorisation"
                                    value="1"
                                    className="mt-[2px] h-[18px] w-[18px] shrink-0 accent-primary"
                                />
                                <span>
                                    {t(
                                        'I am authorised to register this school, and I agree to the terms of use.',
                                    )}
                                </span>
                            </label>
                            {errors.authorisation && (
                                <span className="text-[13px] text-danger">
                                    {errors.authorisation}
                                </span>
                            )}
                            <div className="flex items-center gap-3 pt-2">
                                <PrimaryButton disabled={processing}>
                                    {t('Send verification code')}
                                </PrimaryButton>
                                <Link
                                    href="/register"
                                    className="inline-flex h-9 items-center rounded-lg border border-solid border-border px-4 text-[14px] font-medium text-text"
                                >
                                    {t('Back')}
                                </Link>
                            </div>
                        </div>
                    )}
                </Form>
            </div>
        </AuthLayout>
    );
}
