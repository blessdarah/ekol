import { index as subjectsIndex } from '@/actions/App/Http/Controllers/SubjectController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';

/** Why there are no subjects to choose yet, and where to set them up. */
export function NoEligibleSubjects() {
    return (
        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
            {t(
                'Classify subjects and assign them to this level’s classes to choose core and elective subjects. You can save the series and finish later.',
            )}{' '}
            <Link
                href={subjectsIndex.url()}
                className="font-medium text-primary hover:underline"
            >
                {t('Manage subjects')}
            </Link>
        </p>
    );
}
