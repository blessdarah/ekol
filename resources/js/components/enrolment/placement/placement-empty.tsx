import { Link } from '@inertiajs/react';
import { index as applications } from '@/actions/App/Http/Controllers/ApplicationRosterController';
import { reEnrolment } from '@/actions/App/Http/Controllers/ReEnrolmentController';
import { t } from '../../../lib/i18n';

/** What shows while nobody is waiting for a class. */
export function PlacementEmpty() {
    return (
        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
            {t(
                'Nobody is waiting for a class yet. Students appear here once they are promoted or repeating under',
            )}{' '}
            <Link
                href={reEnrolment.url()}
                className="font-medium text-primary hover:underline"
            >
                {t('Promotion')}
            </Link>
            {t(', or admitted under')}{' '}
            <Link
                href={applications.url()}
                className="font-medium text-primary hover:underline"
            >
                {t('Admissions')}
            </Link>
            .
        </p>
    );
}
