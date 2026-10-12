import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import Stepper, { type Step } from '../components/auth/stepper';
import Toasts from '../components/shell/toasts';

export function LogoMark() {
    return (
        <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    className="shrink-0"
                >
                    <path d="M12 3L2 8l10 5 10-5-10-5z" fill="#FFFFFF" />
                    <path
                        d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                    />
                </svg>
            </span>
            <span className="font-display text-[16px] font-bold text-text">
                Campus
            </span>
        </span>
    );
}

function PrivacyNote() {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                Private by default
            </p>
            <p className="text-[14px] leading-[1.55] text-text">
                Every school gets its own workspace. Student, fee and marks
                records are never shared between schools.
            </p>
        </div>
    );
}

export type BrandMiddle =
    | { variant: 'stepper'; steps: Step[]; active: number }
    | { variant: 'statement'; title: string; body: string }
    | { variant: 'identity'; initials: string; name: string; address: string };

export default function AuthLayout({
    middle,
    topbar,
    children,
}: {
    middle: BrandMiddle;
    topbar?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="font-auth flex min-h-screen bg-bg text-text antialiased">
            <Toasts />
            <aside className="flex w-[440px] shrink-0 flex-col justify-between border-r border-border bg-surface px-12 py-10">
                <div className="flex flex-col gap-12">
                    <LogoMark />
                    {middle.variant === 'stepper' && (
                        <Stepper
                            steps={middle.steps}
                            active={middle.active}
                        />
                    )}
                    {middle.variant === 'statement' && (
                        <div className="flex max-w-[320px] flex-col gap-2">
                            <p className="font-display text-[20px] leading-[1.3] font-bold text-text">
                                {middle.title}
                            </p>
                            <p className="text-[14px] leading-[1.55] text-text-muted">
                                {middle.body}
                            </p>
                        </div>
                    )}
                    {middle.variant === 'identity' && (
                        <div className="flex flex-col gap-4">
                            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary font-display text-[24px] font-extrabold text-white">
                                {middle.initials}
                            </span>
                            <p className="font-display text-[28px] leading-[1.2] font-bold text-text">
                                {middle.name}
                            </p>
                            <p className="font-mono text-[13px] text-text-muted">
                                {middle.address}
                            </p>
                        </div>
                    )}
                </div>
                <PrivacyNote />
            </aside>
            <main className="flex flex-1 justify-center px-8 py-10">
                <div className="w-full max-w-[592px]">
                    {topbar && (
                        <div className="mb-10 flex justify-end text-[13px]">
                            {topbar}
                        </div>
                    )}
                    {children}
                </div>
            </main>
        </div>
    );
}

export function TopBar({
    text,
    linkText,
    href,
}: {
    text: string;
    linkText: string;
    href: string;
}) {
    return (
        <p className="text-text-muted">
            {text}{' '}
            <Link
                href={href}
                className="font-semibold text-text hover:underline"
            >
                {linkText}
            </Link>
        </p>
    );
}
