import PlatformLayout, {
    Status,
    tableClass,
    thClass,
    tdClass,
} from '@/layouts/platform-layout';
import { useT } from '@/lib/i18n';

export default function Signups({
    registrations,
}: {
    registrations: {
        id: string;
        school: string;
        name: string;
        email: string;
        created_at: string;
        expired: boolean;
    }[];
}) {
    const t = useT();
    return (
        <PlatformLayout title="Sign-ups waiting" active="signups">
            <p className="text-[14px] text-text-muted">
                {t(
                    'Schools that started registration and have not yet verified their account.',
                )}
            </p>
            <div className="overflow-x-auto rounded-[10px] border border-border">
                <table className={tableClass}>
                    <thead>
                        <tr>
                            {[
                                'School',
                                'Administrator',
                                'Email',
                                'Asked',
                                'Status',
                            ].map((h) => (
                                <th key={h} className={thClass}>
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {registrations.map((r) => (
                            <tr key={r.id}>
                                <td className={tdClass}>{r.school}</td>
                                <td className={tdClass}>{r.name}</td>
                                <td className={tdClass}>{r.email}</td>
                                <td className={tdClass}>
                                    {new Date(
                                        r.created_at,
                                    ).toLocaleDateString()}
                                </td>
                                <td className={tdClass}>
                                    <Status>
                                        {t(
                                            r.expired
                                                ? 'Expired'
                                                : 'Awaiting verification',
                                        )}
                                    </Status>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {registrations.length === 0 && (
                    <p className="p-8 text-center text-text-muted">
                        {t('No sign-ups waiting.')}
                    </p>
                )}
            </div>
        </PlatformLayout>
    );
}
