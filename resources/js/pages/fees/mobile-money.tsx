import { Head, Link, router } from '@inertiajs/react';
import { receipt, student } from '@/actions/App/Http/Controllers/FeeController';
import {
    check,
    index,
} from '@/actions/App/Http/Controllers/MobilePaymentController';
import { FeesHeader, amberText, figure } from '../../components/fees/ui';
import { OperatorBadge, spacedPhone } from '../../components/pay/ui';
import { capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface MobileRequest {
    id: string;
    student: { id: string; name: string; matricule: string } | null;
    amount: number;
    phone: string;
    operator: string | null;
    status: 'pending' | 'successful' | 'failed';
    reason: string | null;
    reference: string | null;
    receipt: { id: string; no: string | null } | null;
    requested_at: string;
}

interface MobileMoneyProps {
    currency: string;
    totals: {
        collected_today: number;
        paid_today: number;
        waiting: number;
        failed_today: number;
    };
    filters: { show: string };
    requests: {
        rows: MobileRequest[];
        page: number;
        lastPage: number;
        total: number;
    };
}

const TABS = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'paid', label: 'Paid' },
    { key: 'waiting', label: 'Waiting' },
    { key: 'failed', label: 'Failed' },
];

const STATUS: Record<string, { label: string; pill: string }> = {
    successful: { label: 'Paid', pill: 'bg-success-tint text-success' },
    pending: { label: 'Waiting', pill: `bg-warning-tint ${amberText}` },
    failed: { label: 'Failed', pill: 'bg-danger-tint text-danger' },
};

const REASONS: Record<string, string> = {
    timeout: 'Not approved in time',
    declined: 'Declined by the parent',
    insufficient: 'Not enough money',
    rejected: 'Refused by Campay',
    unreachable: 'Service unreachable',
};

function when(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function MobileMoney({
    currency,
    totals,
    filters,
    requests,
}: MobileMoneyProps) {
    function visit(patch: { show?: string; page?: number }) {
        const show = patch.show ?? filters.show;
        const query: Record<string, string | number> = {};

        if (show !== 'all') {
            query.show = show;
        }
        if (patch.page && patch.page > 1) {
            query.page = patch.page;
        }

        router.get(
            index.url({ query }),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    const stats = [
        {
            label: t('Collected today'),
            value: `${figure(totals.collected_today)} ${currency}`,
            tone: 'text-success',
            note: t(':count payments went through', {
                count: totals.paid_today,
            }),
        },
        {
            label: t('Waiting'),
            value: String(totals.waiting),
            tone: totals.waiting > 0 ? amberText : 'text-text',
            note: t('for a parent to approve'),
        },
        {
            label: t('Failed today'),
            value: String(totals.failed_today),
            tone: totals.failed_today > 0 ? 'text-danger' : 'text-text',
            note: t('no money was taken'),
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Mobile money payments')} />
            <FeesHeader
                active="mobile"
                title={t('Mobile money payments')}
                meta={t(
                    'what parents paid from their phones, recorded on each student’s account',
                )}
            />

            <div className="flex flex-wrap border-y border-solid border-border">
                {stats.map((stat, position) => (
                    <div
                        key={stat.label}
                        className={`flex min-w-[160px] flex-1 flex-col gap-[2px] py-3 ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                    >
                        <span className={capsLabelClass}>{stat.label}</span>
                        <span
                            className={`font-mono text-[20px] leading-7 ${stat.tone}`}
                        >
                            {stat.value}
                        </span>
                        <span className="text-[12px] leading-4 text-text-muted">
                            {stat.note}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => {
                    const active = filters.show === tab.key;

                    return (
                        <button
                            key={tab.key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => visit({ show: tab.key })}
                            className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                active
                                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                                    : 'border-border font-medium text-text hover:bg-surface'
                            }`}
                        >
                            {tab.key === 'waiting' && totals.waiting > 0 && (
                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                            )}
                            {t(tab.label)}
                        </button>
                    );
                })}
            </div>

            {requests.rows.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {filters.show === 'all'
                        ? t(
                              'No parent has paid by mobile money yet. Parents pay from the “Pay school fees” link on your school’s sign-in page.',
                          )
                        : t('No payment matches.')}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[860px] flex-col">
                        <div
                            className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                        >
                            <span className="w-[110px] shrink-0">
                                {t('When')}
                            </span>
                            <span className="flex-1">{t('Student')}</span>
                            <span className="w-[200px] shrink-0">
                                {t('Paid from')}
                            </span>
                            <span className="w-[100px] shrink-0 text-right">
                                {t('Amount')}
                            </span>
                            <span className="w-[180px] shrink-0">
                                {t('Status')}
                            </span>
                            <span className="w-[100px] shrink-0 text-right" />
                        </div>
                        {requests.rows.map((row, position) => {
                            const status = STATUS[row.status] ?? STATUS.pending;

                            return (
                                <div
                                    key={row.id}
                                    className={`flex min-h-[52px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                >
                                    <span className="w-[110px] shrink-0 text-[13px] leading-4 text-text-muted">
                                        {when(row.requested_at)}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        {row.student ? (
                                            <Link
                                                href={student.url(
                                                    row.student.id,
                                                )}
                                                className="truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                                            >
                                                {row.student.name}
                                            </Link>
                                        ) : (
                                            <span className="text-[14px] text-text-muted">
                                                —
                                            </span>
                                        )}
                                        <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                            {row.student?.matricule}
                                        </span>
                                    </span>
                                    <span className="flex w-[200px] shrink-0 items-center gap-2">
                                        <span className="font-mono text-[13px]">
                                            {spacedPhone(row.phone)}
                                        </span>
                                        <OperatorBadge
                                            operator={row.operator}
                                        />
                                    </span>
                                    <span className="w-[100px] shrink-0 text-right font-mono text-[13px]">
                                        {figure(row.amount)}
                                    </span>
                                    <span className="flex w-[180px] shrink-0 flex-col gap-[2px]">
                                        <span
                                            className={`flex h-6 w-fit items-center rounded-full px-[10px] text-[12px] leading-4 font-medium ${status.pill}`}
                                        >
                                            {t(status.label)}
                                        </span>
                                        {row.status === 'failed' &&
                                            row.reason && (
                                                <span className="text-[12px] leading-4 text-text-muted">
                                                    {t(
                                                        REASONS[row.reason] ??
                                                            row.reason,
                                                    )}
                                                </span>
                                            )}
                                    </span>
                                    <span className="flex w-[100px] shrink-0 justify-end">
                                        {row.status === 'pending' && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.post(
                                                        check.url(row.id),
                                                        {},
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                                className="text-[13px] font-medium text-primary hover:underline"
                                            >
                                                {t('Check now')}
                                            </button>
                                        )}
                                        {row.receipt && (
                                            <Link
                                                href={receipt.url(
                                                    row.receipt.id,
                                                )}
                                                className="font-mono text-[12px] font-medium text-primary hover:underline"
                                            >
                                                {row.receipt.no ?? t('Receipt')}
                                            </Link>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {requests.lastPage > 1 && (
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={requests.page <= 1}
                        onClick={() => visit({ page: requests.page - 1 })}
                        className="flex h-7 items-center rounded-md px-3 text-[13px] text-text hover:bg-surface disabled:opacity-40"
                    >
                        {t('← Previous')}
                    </button>
                    <span className="px-1 font-mono text-[12px] text-text-muted">
                        {requests.page} / {requests.lastPage}
                    </span>
                    <button
                        type="button"
                        disabled={requests.page >= requests.lastPage}
                        onClick={() => visit({ page: requests.page + 1 })}
                        className="flex h-7 items-center rounded-md px-3 text-[13px] text-text hover:bg-surface disabled:opacity-40"
                    >
                        {t('Next →')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default withAppShell(MobileMoney);
