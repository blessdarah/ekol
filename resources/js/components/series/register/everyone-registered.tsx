import { Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { t } from '../../../lib/i18n';
import { outlineButtonClass } from '../../structure/ui';
import { type RegisterOne } from './model';

/** Shown once nobody in the level is waiting for a series. */
export function EveryoneRegistered({
    registration,
}: {
    registration: RegisterOne;
}) {
    const { level } = registration;

    return (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
            <p className="text-[13px] leading-[19px] text-text">
                {t(
                    'No :level student is waiting for a series. Open the Registered list to change someone’s electives.',
                    { level: level.name },
                )}
            </p>
            <Link
                href={index.url({ query: { level: level.id } })}
                className={outlineButtonClass}
            >
                {t('Back to overview')}
            </Link>
        </div>
    );
}
