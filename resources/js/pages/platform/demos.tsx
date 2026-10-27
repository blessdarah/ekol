import { Form, Link } from '@inertiajs/react';
import { useState } from 'react';
import PlatformLayout, {
    Detail,
    Status,
    tableClass,
    thClass,
    tdClass,
    pillClass,
} from '@/layouts/platform-layout';
import {
    demos,
    updateDemo,
    emailDemo,
} from '@/actions/App/Http/Controllers/PlatformController';
import {
    outlineButtonClass,
    solidButtonClass,
} from '@/components/structure/ui';
import { useT } from '@/lib/i18n';

type Demo = {
    id: string;
    school_name: string;
    contact_name: string | null;
    email: string | null;
    role: string;
    students: string;
    whatsapp: string;
    locale: string;
    status: string;
    created_at: string;
    extended_at: string | null;
    demo_school_id: string | null;
};
type Selected = Demo & {
    school: { slug: string; demo_expires_at: string } | null;
    link: string | null;
};
export default function Demos({
    requests,
    status,
    counts,
    selected,
}: {
    requests: Demo[];
    status: string;
    counts: Record<string, number>;
    selected: Selected | null;
}) {
    const t = useT();
    const [copyResult, setCopyResult] = useState<{
        id: string;
        message: string;
    } | null>(null);
    const tabs = [
        { key: 'new', label: 'New' },
        { key: 'contacted', label: 'Contacted' },
        { key: 'trying', label: 'Trying a demo' },
        { key: 'school', label: 'Became a school' },
        { key: 'closed', label: 'Closed' },
    ];
    function action(demo: Demo, value: string, label: string, primary = false) {
        return (
            <Form {...updateDemo.form(demo.id)}>
                {({ processing }) => (
                    <>
                        <input type="hidden" name="action" value={value} />
                        <button
                            disabled={processing}
                            className={`${primary ? solidButtonClass : outlineButtonClass} w-full disabled:opacity-50`}
                        >
                            {t(label)}
                        </button>
                    </>
                )}
            </Form>
        );
    }
    const panel = selected && (
        <>
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                    {t('Demo request')}
                </p>
                <Link
                    href={demos({ query: { status } })}
                    aria-label={t('Close details')}
                    className="px-2 text-xl"
                >
                    ×
                </Link>
            </div>
            <h2 className="font-display text-[28px] leading-8 font-extrabold tracking-tight">
                {selected.school_name}
            </h2>
            <a
                href={`https://wa.me/${selected.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-semibold text-primary underline"
            >
                {t('Message')} {selected.whatsapp} {t('on WhatsApp')} ↗
            </a>
            <p className="text-[13px] leading-5 text-text-muted">
                {[
                    selected.contact_name,
                    t(selected.role),
                    `${selected.students} ${t('students')}`,
                    selected.locale.toUpperCase(),
                ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
            <div>
                <Status>
                    {t(
                        tabs.find((tab) => tab.key === selected.status)
                            ?.label ?? selected.status,
                    )}
                </Status>
            </div>
            {selected.status === 'new' &&
                action(selected, 'contact', 'Mark as contacted')}
            {['new', 'contacted'].includes(selected.status) &&
                !selected.demo_school_id && (
                    <div className="flex flex-col gap-4 border-y border-border py-5">
                        <h3 className="text-[16px] font-semibold">
                            {t('Give them a demo school')}
                        </h3>
                        <dl>
                            <Detail label="Open for">{t('14 days')}</Detail>
                            <Detail label="Filled with">
                                {t('Sample students, fees, marks')}
                            </Detail>
                            <Detail label="Signs in as">
                                {t('Principal')} ·{' '}
                                {selected.locale.toUpperCase()}
                            </Detail>
                        </dl>
                        {action(selected, 'create', 'Create demo school', true)}
                    </div>
                )}
            {selected.school && (
                <dl>
                    <Detail label="Address">{selected.school.slug}</Detail>
                    <Detail label="Open until">
                        {new Date(
                            selected.school.demo_expires_at,
                        ).toLocaleDateString()}
                    </Detail>
                </dl>
            )}
            {selected.link && (
                <div className="flex flex-col gap-3">
                    <a
                        href={`https://wa.me/${selected.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(t('Your Campus demo school is ready. Try it here:') + ' ' + selected.link)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`${solidButtonClass} h-auto min-h-10 py-2`}
                    >
                        {t('Send demo link on WhatsApp')} ↗
                    </a>
                    <a
                        href={selected.link}
                        target="_blank"
                        rel="noreferrer"
                        className={outlineButtonClass}
                    >
                        {t('Open demo link')} ↗
                    </a>
                    <button
                        className={outlineButtonClass}
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(
                                    selected.link ?? '',
                                );
                                setCopyResult({
                                    id: selected.id,
                                    message: 'Demo link copied.',
                                });
                            } catch {
                                setCopyResult({
                                    id: selected.id,
                                    message:
                                        'Copy failed. Use Open demo link to copy the address.',
                                });
                            }
                        }}
                    >
                        {t('Copy demo link')}
                    </button>
                    {copyResult?.id === selected.id && (
                        <p role="status" className="text-xs text-text-muted">
                            {t(copyResult.message)}
                        </p>
                    )}
                    {selected.email && (
                        <Form {...emailDemo.form(selected.id)}>
                            {({ processing }) => (
                                <button
                                    disabled={processing}
                                    className={`${outlineButtonClass} w-full`}
                                >
                                    {t('Email a copy')}
                                </button>
                            )}
                        </Form>
                    )}
                </div>
            )}
            {selected.demo_school_id &&
                !selected.extended_at &&
                selected.status !== 'school' &&
                action(selected, 'extend', 'Give 7 more days')}
            {selected.status !== 'school' &&
                selected.status !== 'closed' &&
                action(selected, 'close', 'Close, not interested')}
            <p className="text-xs leading-[18px] text-text-muted">
                {t(
                    'Demo schools contain sample data. Mobile money and messages are off, so nothing real is charged or sent. The WhatsApp button opens a prepared message for you to send.',
                )}
            </p>
        </>
    );
    return (
        <PlatformLayout
            title="Demo requests"
            active="demos"
            eyebrow="Platform · From the landing page"
            panel={panel}
        >
            <nav className="flex flex-wrap gap-2" aria-label={t('Demo status')}>
                {tabs.map((tab) => (
                    <Link
                        key={tab.key}
                        href={demos({ query: { status: tab.key } })}
                        className={pillClass(status === tab.key)}
                    >
                        {t(tab.label)} · {counts[tab.key] ?? 0}
                    </Link>
                ))}
            </nav>
            <div className="overflow-x-auto rounded-[10px] border border-border">
                <table className={tableClass}>
                    <thead>
                        <tr>
                            {['School', 'WhatsApp', 'Asked', 'Lang'].map(
                                (h) => (
                                    <th key={h} className={thClass}>
                                        {t(h)}
                                    </th>
                                ),
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {requests.map((demo) => (
                            <tr
                                key={demo.id}
                                className={
                                    selected?.id === demo.id
                                        ? 'bg-primary-tint'
                                        : 'hover:bg-surface'
                                }
                            >
                                <td className={tdClass}>
                                    <Link
                                        className="flex min-w-[220px] flex-col gap-0.5"
                                        href={demos({
                                            query: { status, demo: demo.id },
                                        })}
                                    >
                                        <span className="text-[14px] font-semibold">
                                            {demo.school_name}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                            {t(demo.role)} · {demo.students}{' '}
                                            {t('students')}
                                        </span>
                                    </Link>
                                </td>
                                <td
                                    className={`${tdClass} font-mono whitespace-nowrap`}
                                >
                                    {demo.whatsapp}
                                </td>
                                <td className={`${tdClass} whitespace-nowrap`}>
                                    {new Date(
                                        demo.created_at,
                                    ).toLocaleDateString()}
                                </td>
                                <td
                                    className={`${tdClass} font-mono text-xs text-text-muted`}
                                >
                                    {demo.locale.toUpperCase()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {requests.length === 0 && (
                    <p className="p-8 text-center text-text-muted">
                        {t('No demo requests in this stage.')}
                    </p>
                )}
            </div>
            <p className="text-xs leading-[18px] text-text-muted">
                {t(
                    'From the Book a demo form on the landing page. New requests stay here until you mark them as contacted.',
                )}
            </p>
        </PlatformLayout>
    );
}
