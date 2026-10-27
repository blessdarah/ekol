import { Link } from '@inertiajs/react';
import PlatformLayout, {
    tableClass,
    thClass,
    tdClass,
} from '@/layouts/platform-layout';
import { useT } from '@/lib/i18n';

type Visit = {
    id: string;
    school: { name: string };
    user: { full_name: string };
    started_at: string;
    ended_at: string | null;
    expires_at: string;
};
export default function Visits({
    visits,
}: {
    visits: {
        data: Visit[];
        links: { url: string | null; label: string; active: boolean }[];
    };
}) {
    const t = useT();
    return (
        <PlatformLayout title="Visit log" active="visits">
            <p className="text-[14px] text-text-muted">
                {t(
                    'Every school visit, including when it started and ended. Changes are also recorded in the school audit log.',
                )}
            </p>
            <div className="overflow-x-auto rounded-[10px] border border-border">
                <table className={tableClass}>
                    <thead>
                        <tr>
                            {[
                                'School',
                                'Super-admin',
                                'Started',
                                'Ended',
                                'Duration',
                            ].map((h) => (
                                <th key={h} className={thClass}>
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visits.data.map((v) => (
                            <tr key={v.id}>
                                <td className={tdClass}>{v.school.name}</td>
                                <td className={tdClass}>{v.user.full_name}</td>
                                <td className={tdClass}>
                                    {new Date(v.started_at).toLocaleString()}
                                </td>
                                <td className={tdClass}>
                                    {v.ended_at
                                        ? new Date(v.ended_at).toLocaleString()
                                        : t('In progress')}
                                </td>
                                <td className={`${tdClass} font-mono`}>
                                    {v.ended_at
                                        ? `${Math.round((Date.parse(v.ended_at) - Date.parse(v.started_at)) / 60000)} min`
                                        : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {visits.data.length === 0 && (
                    <p className="p-8 text-center text-text-muted">
                        {t('No visits yet.')}
                    </p>
                )}
            </div>
            <nav className="flex flex-wrap gap-3">
                {visits.links.map((link, i) =>
                    link.url ? (
                        <Link
                            key={i}
                            href={link.url}
                            className={
                                link.active
                                    ? 'font-semibold text-primary'
                                    : 'text-text-muted'
                            }
                        >
                            {link.label
                                .replace(/&laquo;/g, '‹')
                                .replace(/&raquo;/g, '›')}
                        </Link>
                    ) : null,
                )}
            </nav>
        </PlatformLayout>
    );
}
