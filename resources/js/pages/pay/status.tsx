import { Form, Head, Link, usePoll } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { home } from '@/actions/App/Http/Controllers/ParentController';
import {
    amount as payPage,
    retry,
} from '@/actions/App/Http/Controllers/PayController';
import {
    ChildSummary,
    OperatorBadge,
    PayHeading,
    PayShell,
    francs,
    payButtonClass,
    spacedPhone,
    type ChildCard,
    type Issuer,
} from '../../components/pay/ui';
import { useT } from '../../lib/i18n';

interface StatusProps {
    issuer: Issuer;
    payment: {
        id: string;
        state: 'waiting' | 'late' | 'paid' | 'failed';
        amount: number;
        phone: string;
        operator: string | null;
        reason: string | null;
        seconds_left: number;
        paid_at: string | null;
        receipt: string | null;
        went_to: { name: string; amount: number }[];
    };
    student: ChildCard | null;
    balance: number;
    next: { label: string; due_on: string } | null;
}

const REASONS: Record<string, { title: string; body: string }> = {
    timeout: {
        title: 'The request was not approved in time',
        body: 'No money left your account. Send the request again and approve it within two minutes.',
    },
    declined: {
        title: 'The payment was declined',
        body: 'The request was cancelled or the PIN was wrong. No money left your account.',
    },
    insufficient: {
        title: 'Not enough money on this number',
        body: 'Top up your mobile money account, or pay a smaller amount, then try again.',
    },
    rejected: {
        title: 'Mobile money refused this request',
        body: 'No money left your account. Check the number and the amount, and ask the school’s bursar if it happens again.',
    },
    unreachable: {
        title: 'We could not reach mobile money',
        body: 'The payment service did not answer. No money left your account. Try again in a few minutes.',
    },
};

export default function PaymentStatus({
    issuer,
    payment,
    student,
    balance,
    next,
}: StatusProps) {
    const t = useT();
    const pending = payment.state === 'waiting' || payment.state === 'late';
    const { stop } = usePoll(3000, {}, { autoStart: pending, keepAlive: true });
    const [left, setLeft] = useState(payment.seconds_left);

    useEffect(() => {
        if (!pending) {
            stop();
        }
    }, [pending, stop]);

    useEffect(() => {
        setLeft(payment.seconds_left);

        if (!pending) {
            return;
        }

        const timer = window.setInterval(
            () => setLeft((seconds) => Math.max(0, seconds - 1)),
            1000,
        );

        return () => window.clearInterval(timer);
    }, [payment.seconds_left, pending]);

    return (
        <PayShell issuer={issuer}>
            <Head
                title={`${t(pending ? 'Approve on your phone' : payment.state === 'paid' ? 'Payment received' : 'Payment not completed')} — ${issuer.name}`}
            />
            {pending && <Waiting payment={payment} left={left} />}
            {payment.state === 'paid' && (
                <>
                    <div className="flex flex-col items-center gap-3 pt-2 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-tint">
                            <svg
                                width="26"
                                height="26"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-success"
                            >
                                <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                        </span>
                        <PayHeading title={t('Payment received')} />
                        <p className="font-mono text-[28px] leading-8 font-bold">
                            {francs(payment.amount)}
                        </p>
                    </div>
                    {student && <ChildSummary student={student} />}
                    <dl className="flex flex-col divide-y divide-border rounded-xl border border-solid border-border bg-white text-[14px]">
                        {payment.receipt && (
                            <Row
                                label={t('Receipt')}
                                value={payment.receipt}
                                mono
                            />
                        )}
                        <Row
                            label={t('Paid from')}
                            value={spacedPhone(payment.phone)}
                            mono
                        />
                        {payment.paid_at && (
                            <Row
                                label={t('Paid on')}
                                value={new Date(
                                    payment.paid_at,
                                ).toLocaleString()}
                            />
                        )}
                        {payment.went_to.map((share) => (
                            <Row
                                key={share.name}
                                label={t(share.name)}
                                value={francs(share.amount)}
                                mono
                            />
                        ))}
                        <Row
                            label={t('Still owed')}
                            value={francs(balance)}
                            mono
                            strong
                        />
                        {next && balance > 0 && (
                            <Row
                                label={t('Next due')}
                                value={`${t(next.label)} · ${next.due_on}`}
                            />
                        )}
                    </dl>
                    <p className="text-[13px] text-text-muted">
                        {t(
                            'The school has your payment. Keep the receipt number in case you need it.',
                        )}
                    </p>
                    {balance > 0 && (
                        <Link
                            href={payPage.url()}
                            className="text-center text-[14px] font-semibold text-primary hover:underline"
                        >
                            {t('Make another payment')}
                        </Link>
                    )}
                    <Link
                        href={home.url()}
                        className="text-center text-[14px] font-semibold text-text-muted hover:text-text"
                    >
                        {t('Back to parent services')}
                    </Link>
                </>
            )}
            {payment.state === 'failed' && (
                <>
                    <div className="flex flex-col items-center gap-3 pt-2 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-tint">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                className="text-danger"
                            >
                                <path d="M7 7l10 10M17 7L7 17" />
                            </svg>
                        </span>
                        <PayHeading
                            title={t(
                                REASONS[payment.reason ?? '']?.title ??
                                    'Payment not completed',
                            )}
                        />
                        <p className="text-[15px] text-text-muted">
                            {t(
                                REASONS[payment.reason ?? '']?.body ??
                                    'No money left your account.',
                            )}
                        </p>
                    </div>
                    {student && (
                        <ChildSummary
                            student={student}
                            trailing={
                                <span className="shrink-0 font-mono text-[15px] font-semibold">
                                    {francs(payment.amount)}
                                </span>
                            }
                        />
                    )}
                    <Form action={retry.url(payment.id)} method="post">
                        {({ processing }) => (
                            <button
                                type="submit"
                                disabled={processing}
                                className={payButtonClass}
                            >
                                {t('Try again')}
                            </button>
                        )}
                    </Form>
                    <Link
                        href={home.url()}
                        className="text-center text-[14px] font-semibold text-text-muted hover:text-text"
                    >
                        {t('Back to parent services')}
                    </Link>
                </>
            )}
        </PayShell>
    );
}

function Waiting({
    payment,
    left,
}: {
    payment: StatusProps['payment'];
    left: number;
}) {
    const t = useT();
    const minutes = Math.floor(left / 60);
    const seconds = String(left % 60).padStart(2, '0');
    const code = payment.operator === 'Orange' ? '#150*50#' : '*126#';

    return (
        <>
            <div className="flex flex-col items-center gap-4 pt-2 text-center">
                <span className="relative flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary-tint" />
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint">
                        <svg
                            width="26"
                            height="26"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            className="text-primary"
                        >
                            <rect x="7" y="2.5" width="10" height="19" rx="2" />
                            <path d="M11 18.5h2" />
                        </svg>
                    </span>
                </span>
                <PayHeading
                    title={t('Approve on your phone')}
                    sub={t(
                        'A request for :amount was sent to :phone. Enter your PIN on the phone to approve it.',
                        {
                            amount: francs(payment.amount),
                            phone: spacedPhone(payment.phone),
                        },
                    )}
                />
                <OperatorBadge operator={payment.operator} />
                {payment.state === 'waiting' ? (
                    <p
                        className="font-mono text-[32px] leading-9 font-bold"
                        aria-live="polite"
                    >
                        {minutes}:{seconds}
                    </p>
                ) : (
                    <p className="text-[14px] text-text-muted">
                        {t('Still waiting for an answer from your operator…')}
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-solid border-border bg-white px-4 py-3">
                <p className="text-[14px] font-semibold">
                    {t('No request on your phone?')}
                </p>
                <p className="text-[13px] text-text-muted">
                    {t(
                        'Dial :code and look under pending approvals. Keep this page open — it updates by itself.',
                        { code },
                    )}
                </p>
            </div>
        </>
    );
}

function Row({
    label,
    value,
    mono = false,
    strong = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
    strong?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-text-muted">{label}</dt>
            <dd
                className={`text-right ${mono ? 'font-mono' : ''} ${strong ? 'font-semibold' : ''}`}
            >
                {value}
            </dd>
        </div>
    );
}
