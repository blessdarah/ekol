import { Form, Head } from '@inertiajs/react';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import { Eyebrow, Field, Heading, PrimaryButton, inputClass } from '../../components/auth/field';

export default function FindSchool() {
    return (
        <AuthLayout
            middle={{
                variant: 'statement',
                title: 'Marks, fees and attendance for every class, in one place.',
                body: 'Built for secondary schools. Sequences, series and installments included.',
            }}
            topbar={
                <TopBar
                    text="New to Campus?"
                    linkText="Register your school"
                    href="/register"
                />
            }
        >
            <Head title="Find your school" />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>Sign in</Eyebrow>
                    <Heading
                        title="Find your school"
                        sub="Enter your school's workspace address to continue."
                    />
                </div>
                <Form action="/login/find-school" method="post">
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <Field
                                label="Workspace address"
                                error={errors.slug}
                            >
                                <input
                                    type="text"
                                    name="slug"
                                    placeholder="gbhs-bamenda"
                                    className={`${inputClass} font-mono`}
                                />
                            </Field>
                            <div className="pt-2">
                                <PrimaryButton disabled={processing}>
                                    Continue
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </Form>
                <div className="flex flex-col gap-1 border-t border-border pt-4">
                    <p className="text-[14px] font-semibold text-text">
                        Don&apos;t know your address?
                    </p>
                    <p className="text-[13px] text-text-muted">
                        It is in the welcome email sent when your school
                        registered.
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
}
