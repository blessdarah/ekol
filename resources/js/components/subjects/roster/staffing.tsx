import { t } from '../../../lib/i18n';
import { plural, type SubjectRow } from './model';

/** Whether a subject's classes all have a teacher. */
export function Staffing({ row }: { row: SubjectRow }) {
    if (row.classes === 0) {
        return (
            <span className="flex items-center gap-[6px] text-[13px] leading-4 text-text">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                {t('No classes yet')}
            </span>
        );
    }

    if (row.not_taught.length > 0 && row.unstaffed === 0) {
        return (
            <span className="flex items-start gap-[6px] text-[13px] leading-4 text-text">
                <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                <span>
                    {plural(row.classes, 'class', 'classes')}{' '}
                    {t('· in a series but not taught in')}{' '}
                    {row.not_taught.join(', ')}
                </span>
            </span>
        );
    }

    if (row.unstaffed > 0) {
        return (
            <span className="flex items-center gap-[6px] text-[13px] leading-4 text-text">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                {plural(row.classes, 'class', 'classes')} ·{' '}
                {row.teachers === 0
                    ? t('no teacher yet')
                    : t(':unstaffed without a teacher', {
                          unstaffed: row.unstaffed,
                      })}
            </span>
        );
    }

    return (
        <span className="text-[13px] leading-4 text-text">
            {plural(row.classes, 'class', 'classes')} ·{' '}
            {plural(row.teachers, 'teacher', 'teachers')}
        </span>
    );
}
