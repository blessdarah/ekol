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

export default function RegisterAdmin({
    schoolName,
}: {
    schoolName: string;
}) {
    const [role, setRole] = useState('admin');

    return (
        <AuthLayout
            middle={{ variant: 'stepper', steps: STEPS, active: 1 }}
            topbar={
                <TopBar
                    text="Already registered?"
                    linkText="Sign in"
                    href="/login"
                />
            }
        >
            <Head title="Create your account" />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>Step 2 of 3</Eyebrow>
                    <Heading
                        title="Create your account"
                        sub={`You will manage ${schoolName} from this account.`}
                    />
                </div>
                <Form action="/register/admin" method="post" onKeyDown={submitOnEnter}>
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-[1fr_200px] gap-4">
                                <Field
                                    label="Full name"
                                    error={errors.full_name}
                                >
                                    <input
                                        type="text"
                                        name="full_name"
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="Role" error={errors.role}>
                                    <select
                                        name="role"
                                        value={role}
                                        onChange={(e) =>
                                            setRole(e.target.value)
                                        }
                                        className={`${inputClass} bg-white`}
                                    >
                                        {ROLES.map((option) => (
                                            <option
                                                key={option}
                                                value={option}
                                            >
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                            <div className="grid grid-cols-[1fr_200px] gap-4">
                                <Field label="Email" error={errors.email}>
                                    <input
                                        type="email"
                                        name="email"
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="Phone" error={errors.phone}>
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
                                    I am authorised to register this school,
                                    and I agree to the terms of use.
                                </span>
                            </label>
                            {errors.authorisation && (
                                <span className="text-[13px] text-danger">
                                    {errors.authorisation}
                                </span>
                            )}
                            <div className="flex items-center gap-3 pt-2">
                                <PrimaryButton disabled={processing}>
                                    Send verification code
                                </PrimaryButton>
                                <Link
                                    href="/register"
                                    className="inline-flex h-9 items-center rounded-lg border border-solid border-border px-4 text-[14px] font-medium text-text"
                                >
                                    Back
                                </Link>
                            </div>
                        </div>
                    )}
                </Form>
            </div>
        </AuthLayout>
    );
}
