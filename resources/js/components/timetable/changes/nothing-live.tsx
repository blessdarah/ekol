import { Link } from '@inertiajs/react';
import { index as overview } from '@/actions/App/Http/Controllers/TimetableController';
import { t } from '../../../lib/i18n';
import { linkClass } from '../ui';
import { type TimetableChanges } from './model';

/** What shows while no timetable is published. */
export function NothingLive({ changes }: { changes: TimetableChanges }) {
    const { phase } = changes;

    return (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                {t('Nothing is published yet')}
            </p>
            <p className="max-w-[600px] text-[13px] leading-[19px] text-text">
                {t(
                    'Covers, swaps and room changes are made against the live timetable. Build and publish version :draft first.',
                    { draft: phase.draft },
                )}
            </p>
            <Link href={overview.url()} className={linkClass}>
                {t('Back to the overview →')}
            </Link>
        </div>
    );
}
