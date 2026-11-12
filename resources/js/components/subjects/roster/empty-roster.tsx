import { Link } from '@inertiajs/react';
import { templates } from '@/actions/App/Http/Controllers/SubjectTemplateController';
import { outlineButtonClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';

/** What to do before the school has any subjects. */
export function EmptyRoster() {
    return (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
            <p className="text-[13px] leading-[19px] text-text">
                {t(
                    'No subjects yet. Register one from scratch, or start from a prepared set and give each subject its classes and teachers in one go.',
                )}
            </p>
            <Link href={templates.url()} className={outlineButtonClass}>
                {t('Use a template')}
            </Link>
        </div>
    );
}
