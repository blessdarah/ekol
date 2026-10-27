import { Form, Link, router } from '@inertiajs/react';
import PlatformLayout, {
    Detail,
    Status,
    tableClass,
    thClass,
    tdClass,
    pillClass,
} from '@/layouts/platform-layout';
import {
    schools as index,
    visit,
    leave,
} from '@/actions/App/Http/Controllers/PlatformController';
import { show as dashboard } from '@/actions/App/Http/Controllers/DashboardController';
import { fieldInputClass, solidButtonClass } from '@/components/structure/ui';
import { useT } from '@/lib/i18n';

type Visit = {
    id: string;
    started_at: string;
    ended_at: string | null;
    expires_at: string;
    user: { full_name: string };
};
type School = {
    id: string;
    name: string;
    town: string | null;
    slug: string;
    address: string;
    students: number;
    staff: number;
    last_sign_in: string | null;
    status: string;
};
type Props = {
    schools: School[];
    counts: Record<string, number>;
    students: number;
    joined: number;
    activeThisWeek: number;
    filters: { q: string; status: string };
    activeVisit: { school: string } | null;
    selected: {
        id: string;
        name: string;
        slug: string;
        town: string | null;
        region: string | null;
        cycle: string | null;
        created_at: string;
        administrator: string | null;
        term: string | null;
        fees: number;
        visits: Visit[];
    } | null;
};
export default function Schools({
    schools,
    counts,
    students,
    joined,
    activeThisWeek,
    filters,
    selected,
    activeVisit,
}: Props) {
    const t = useT();
    const stats = [
        {
            label: 'Schools',
            value: counts.all,
            sub: t(':count joined this month', { count: joined }),
        },
        {
            label: 'Active this week',
            value: activeThisWeek,
            sub: t('signed in since Monday'),
        },
        {
            label: 'Students',
            value: students,
            sub: t('enrolled in the current school year'),
        },
        {
            label: 'Quiet 14 days +',
            value: counts.quiet,
            sub: t('no sign-in for two weeks'),
        },
    ];
    const panel = selected && (
        <>
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                    {t('School')}
                </p>
                <Link
                    href={index({ query: filters })}
                    aria-label={t('Close details')}
                    className="px-2 text-xl"
                >
                    ×
                </Link>
            </div>
            <h2 className="font-display text-[28px] leading-8 font-extrabold tracking-tight">
                {selected.name}
            </h2>
            <p className="text-[13px] leading-5 text-text-muted">
                {[
                    selected.town,
                    selected.region,
                    selected.cycle ? t(selected.cycle) : null,
                ]
                    .filter(Boolean)
                    .join(' · ')}{' '}
                · {t('on Campus since')}{' '}
                {new Date(selected.created_at).toLocaleDateString()}
            </p>
            <dl>
                <Detail label="Administrator">
                    {selected.administrator ?? '—'}
                </Detail>
                <Detail label="Term">
                    {selected.term ? t(selected.term) : '—'}
                </Detail>
                <Detail label="Fees collected this term">
                    {Number(selected.fees).toLocaleString()} FCFA
                </Detail>
            </dl>
            <div className="flex flex-col gap-3 border-y border-border py-5">
                <h3 className="font-semibold">{t('Log in to this school')}</h3>
                <Form key={selected.id} {...visit.form(selected.id)}>
                    {({ processing }) => (
                        <button
                            disabled={processing}
                            className={`${solidButtonClass} h-auto min-h-10 w-full py-2`}
                        >
                            {t('Log in to :school', { school: selected.name })}{' '}
                            →
                        </button>
                    )}
                </Form>
                <p className="text-xs leading-[18px] text-text-muted">
                    {t(
                        'You go in as Campus super-admin with full access. The visit is recorded in the school audit log and ends after 60 minutes.',
                    )}
                </p>
            </div>
            <h3 className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                {t('Last visits')}
            </h3>
            {selected.visits.length === 0 && (
                <p className="text-[13px] text-text-muted">
                    {t('No visits yet.')}
                </p>
            )}
            {selected.visits.map((v) => (
                <p key={v.id} className="text-[13px]">
                    {new Date(v.started_at).toLocaleDateString()} ·{' '}
                    {v.user.full_name} ·{' '}
                    {v.ended_at
                        ? `${Math.max(0, Math.round((Date.parse(v.ended_at) - Date.parse(v.started_at)) / 60000))} min`
                        : t('In progress')}
                </p>
            ))}
        </>
    );
    return (
        <PlatformLayout
            title="Schools"
            active="schools"
            eyebrow="Platform · All schools"
            panel={panel}
        >
            {activeVisit && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning bg-warning-tint px-4 py-3 text-[13px] text-text">
                    <p>
                        {t('Your visit to :school is still open.', {
                            school: activeVisit.school,
                        })}
                    </p>
                    <div className="flex gap-4">
                        <Link
                            href={dashboard()}
                            className="font-semibold text-primary"
                        >
                            {t('Resume visit')}
                        </Link>
                        <Link
                            href={leave()}
                            as="button"
                            className="font-semibold text-primary"
                        >
                            {t('End visit')}
                        </Link>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-2 gap-6 border-b border-border pb-6 2xl:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-1.5">
                        <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                            {t(stat.label)}
                        </p>
                        <p
                            className={`font-display text-[28px] leading-8 font-extrabold ${stat.label === 'Quiet 14 days +' ? 'text-warning' : ''}`}
                        >
                            {Number(stat.value ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-text-muted">{stat.sub}</p>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {['all', 'active', 'quiet', 'suspended'].map((key) => (
                        <Link
                            key={key}
                            href={index({ query: { ...filters, status: key } })}
                            className={pillClass(filters.status === key)}
                        >
                            {t(key[0].toUpperCase() + key.slice(1))} ·{' '}
                            {counts[key] ?? 0}
                        </Link>
                    ))}
                </div>
                <Form {...index.form()} className="flex gap-2">
                    <input type="hidden" name="status" value={filters.status} />
                    <input
                        key={filters.q}
                        name="q"
                        defaultValue={filters.q}
                        placeholder={t('Name, town or address')}
                        aria-label={t('Search schools')}
                        className={`${fieldInputClass} max-w-[260px] text-[14px]`}
                    />
                    <button className="text-[13px] font-medium text-primary">
                        {t('Search')}
                    </button>
                </Form>
            </div>
            <div className="overflow-x-auto rounded-[10px] border border-border">
                <table className={tableClass}>
                    <thead>
                        <tr>
                            {[
                                'School',
                                'Town',
                                'Students',
                                'Staff',
                                'Last sign-in',
                                'Status',
                            ].map((h) => (
                                <th key={h} className={thClass}>
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {schools.map((s) => (
                            <tr
                                key={s.id}
                                onClick={() =>
                                    router.visit(
                                        index.url({
                                            query: { ...filters, school: s.id },
                                        }),
                                        { preserveScroll: true },
                                    )
                                }
                                className={`cursor-pointer ${
                                    selected?.id === s.id
                                        ? 'bg-primary-tint'
                                        : 'hover:bg-surface'
                                }`}
                            >
                                <td className={tdClass}>
                                    <Link
                                        className="flex min-w-[190px] flex-col gap-0.5"
                                        href={index({
                                            query: { ...filters, school: s.id },
                                        })}
                                        preserveScroll
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        <span className="font-semibold">
                                            {s.name}
                                        </span>
                                        <span className="font-mono text-xs text-text-muted">
                                            {s.address}
                                        </span>
                                    </Link>
                                </td>
                                <td className={tdClass}>{s.town ?? '—'}</td>
                                <td className={`${tdClass} font-mono`}>
                                    {s.students.toLocaleString()}
                                </td>
                                <td className={`${tdClass} font-mono`}>
                                    {s.staff}
                                </td>
                                <td className={`${tdClass} whitespace-nowrap`}>
                                    {s.last_sign_in
                                        ? new Date(
                                              s.last_sign_in,
                                          ).toLocaleDateString()
                                        : t('Never')}
                                </td>
                                <td className={tdClass}>
                                    <Status>
                                        {t(
                                            s.status[0].toUpperCase() +
                                                s.status.slice(1),
                                        )}
                                    </Status>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {schools.length === 0 && (
                    <p className="p-8 text-center text-text-muted">
                        {t('No schools match these filters.')}
                    </p>
                )}
            </div>
            <p className="text-xs leading-[18px] text-text-muted">
                {t(
                    'Most recently active first. Select a school to see it and log in. Suspended schools can still be visited. Demo schools are excluded from these totals.',
                )}
            </p>
        </PlatformLayout>
    );
}
