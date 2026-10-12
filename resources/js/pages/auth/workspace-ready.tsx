import { useT } from '../../lib/i18n';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import AuthLayout from '../../layouts/auth-layout';
import { Heading } from '../../components/auth/field';

const STEPS = [
    { title: 'School', sub: 'Name, location and type' },
    { title: 'Administrator', sub: 'Who will manage the school' },
    { title: 'Verify', sub: 'Confirm your email address' },
];

const UP_NEXT = [
    { n: '01', text: 'Sign in with your email and password' },
    { n: '02', text: 'Add your logo, terms and fee installments in School Setup' },
    { n: '03', text: 'Invite your teachers' },
];

export default function WorkspaceReady({
    school,
    administrator,
    address,
    loginUrl,
    studentIdExample,
}: {
    school: { name: string; slug: string; code: string };
    administrator: { full_name: string; email: string };
    address: string;
    loginUrl: string;
    studentIdExample: string;
}) {
    const [copied, setCopied] = useState(false);
    const t = useT();

    function copy() {
        void navigator.clipboard.writeText(address).then(
            () => setCopied(true),
            () => setCopied(false),
        );
    }

    return (
        <AuthLayout
            middle={{ variant: 'stepper', steps: STEPS, active: 2 }}
        >
            <Head title={t(':school is ready', { school: school.name })} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-success">
                        <span className="h-[6px] w-[6px] rounded-full bg-success" />
                        {t('Workspace created')}
                    </span>
                    <Heading
                        title={t(':school is ready', { school: school.name })}
                        sub={t('Your workspace is live. Staff will sign in at the address below.')}
                    />
                </div>
                <div className="flex flex-col rounded-lg border border-solid border-border">
                    <div className="flex items-center gap-4 border-b border-solid border-border px-[18px] py-3">
                        <span className="w-[160px] shrink-0 text-[14px] text-text-muted">
                            {t('Workspace address')}
                        </span>
                        <span className="font-mono text-[14px] text-text">
                            {address.replace(/^https?:\/\//, '')}
                        </span>
                        <button
                            type="button"
                            onClick={copy}
                            className="ml-auto text-[13px] font-medium text-primary hover:underline"
                        >
                            {copied ? t('Copied') : t('Copy')}
                        </button>
                    </div>
                    <div className="flex items-center gap-4 border-b border-solid border-border px-[18px] py-3">
                        <span className="w-[160px] shrink-0 text-[14px] text-text-muted">
                            {t('Administrator')}
                        </span>
                        <span className="text-[14px] font-medium text-text">
                            {administrator.full_name}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 px-[18px] py-3">
                        <span className="w-[160px] shrink-0 text-[14px] text-text-muted">
                            {t('Student ID format')}
                        </span>
                        <span className="font-mono text-[14px] text-text">
                            {studentIdExample}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                        {t('Up next')}
                    </p>
                    {UP_NEXT.map((step) => (
                        <div key={step.n} className="flex items-center gap-4">
                            <span className="w-5 shrink-0 font-mono text-[13px] text-text-muted">
                                {step.n}
                            </span>
                            <span className="text-[14px] text-text">
                                {t(step.text)}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-4">
                    <Link
                        href={loginUrl}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-medium text-white hover:bg-primary-hover"
                    >
                        {t('Continue to sign in')}
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                            className="shrink-0"
                        >
                            <path
                                d="M5 12h14M13 6l6 6-6 6"
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </Link>
                    <span className="text-[13px] text-text-muted">
                        {t('We also emailed you these details.')}
                    </span>
                </div>
            </div>
        </AuthLayout>
    );
}
