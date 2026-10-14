import { Head, Link, router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    attendance as attendancePage,
    leave,
} from '@/actions/App/Http/Controllers/ParentController';
import { amount as payPage } from '@/actions/App/Http/Controllers/PayController';
import { dayMonth } from '../../components/fees/ui';
import {
    ChildSummary,
    PayHeading,
    PayShell,
    SERVICES,
    ServiceIcon,
    francs,
    type ChildCard,
    type Issuer,
} from '../../components/pay/ui';
import { useT } from '../../lib/i18n';

interface HomeProps {
    issuer: Issuer;
    student: ChildCard;
    fees: {
        balance: number;
        overdue: number;
        next: { label: string; due_on: string } | null;
    };
    attendance: {
        term: string | null;
        rate: number | null;
        absent: number;
        late: number;
    };
    services: string[];
}

export default function ParentHome({
    issuer,
    student,
    fees,
    attendance,
    services,
}: HomeProps) {
    const t = useT();
    const notes: Record<string, { href?: string; status: ReactNode }> = {
        pay: {
            href: payPage.url(),
            status:
                fees.balance <= 0 ? (
                    <span className="text-success">
                        {t('Fully paid for now')}
                    </span>
                ) : fees.overdue > 0 ? (
                    <span className="text-danger">
                        {t(':amount overdue', { amount: francs(fees.overdue) })}
                    </span>
                ) : (
                    <span>
                        {t(':amount still owed', {
                            amount: francs(fees.balance),
                        })}
                        {fees.next &&
                            ` · ${t('next due :date', { date: dayMonth(fees.next.due_on, false) })}`}
                    </span>
                ),
        },
        attendance: {
            href: attendancePage.url(),
            status:
                attendance.rate === null ? (
                    <span>{t('No register taken yet this term')}</span>
                ) : (
                    <span>
                        {t(':rate% present', { rate: attendance.rate })} ·{' '}
                        {t(':count days away', { count: attendance.absent })}
                    </span>
                ),
        },
        announcements: { status: <span>{t('Coming soon')}</span> },
    };

    return (
        <PayShell issuer={issuer}>
            <Head title={`${student.name} — ${issuer.name}`} />
            <PayHeading title={t('What would you like to do?')} />
            <ChildSummary student={student} />
            <ul className="flex flex-col gap-2">
                {services.map((service) => {
                    const meta = SERVICES[service];
                    const note = notes[service];
                    const body = (
                        <>
                            <ServiceIcon service={service} />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="text-[15px] leading-5 font-semibold">
                                    {t(meta?.title ?? service)}
                                </span>
                                <span className="text-[13px] leading-[18px] text-text-muted">
                                    {note?.status}
                                </span>
                            </span>
                            {note?.href && (
                                <span
                                    aria-hidden
                                    className="text-[16px] text-text-muted"
                                >
                                    →
                                </span>
                            )}
                        </>
                    );

                    return (
                        <li key={service}>
                            {note?.href ? (
                                <Link
                                    href={note.href}
                                    className="flex items-center gap-3 rounded-xl border border-solid border-border bg-white px-4 py-4 hover:border-primary"
                                >
                                    {body}
                                </Link>
                            ) : (
                                <span className="flex items-center gap-3 rounded-xl border border-solid border-border bg-white px-4 py-4 opacity-70">
                                    {body}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
            <button
                type="button"
                onClick={() => router.post(leave.url())}
                className="self-center text-[14px] font-medium text-text-muted hover:text-text"
            >
                {t('Look up another child')}
            </button>
        </PayShell>
    );
}
