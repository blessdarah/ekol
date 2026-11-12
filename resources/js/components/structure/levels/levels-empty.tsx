import { Link } from '@inertiajs/react';
import { levelTemplates } from '@/actions/App/Http/Controllers/LevelController';
import { t } from '../../../lib/i18n';
import { outlineButtonClass } from '../ui';

/** What shows before the school has any levels. */
export function LevelsEmpty() {
    return (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
            <p className="text-[13px] leading-[19px] text-text">
                {t(
                    'No levels yet. Start from a standard structure to create Form 1 to Upper Sixth (or Sixième to Terminale) with their classes in one go, or add levels one at a time.',
                )}
            </p>
            <Link href={levelTemplates.url()} className={outlineButtonClass}>
                {t('Start from a standard structure')}
            </Link>
        </div>
    );
}
