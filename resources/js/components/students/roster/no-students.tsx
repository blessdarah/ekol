import { Link } from '@inertiajs/react';
import { show as importPage } from '@/actions/App/Http/Controllers/StudentImportController';
import { t } from '../../../lib/i18n';
import { outlineButtonClass } from '../../structure/ui';

/** Shown before the school has any student. */
export function NoStudents() {
    return (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
            <p className="text-[13px] leading-[19px] text-text">
                {t(
                    'No students yet. Register one at a time, or bring in a whole intake from a spreadsheet.',
                )}
            </p>
            <Link href={importPage.url()} className={outlineButtonClass}>
                {t('Import students')}
            </Link>
        </div>
    );
}
