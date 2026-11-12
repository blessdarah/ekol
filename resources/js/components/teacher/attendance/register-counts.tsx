import { t } from '../../../lib/i18n';
import { type RegisterModel } from './model';

/** How many are present, absent and late, and whether it is saved. */
export function RegisterCounts({ register }: { register: RegisterModel }) {
    const { tally, lesson, dirty, marked, roll } = register;

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] leading-[18px] font-medium text-text">
            <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                {tally('present')} {t('present')}
            </span>
            <span className="flex items-center gap-2 border-l border-solid border-border pl-4">
                <span className="h-2 w-2 rounded-full bg-danger" />
                {tally('absent')} {t('absent')}
            </span>
            <span className="flex items-center gap-2 border-l border-solid border-border pl-4">
                <span className="h-2 w-2 rounded-full bg-warning" />
                {tally('late')} {t('late')}
            </span>
            <span className="border-l border-solid border-border pl-4 font-mono text-[12px] leading-4 font-normal text-text-muted">
                {lesson.saved && !dirty
                    ? t('Saved')
                    : dirty
                      ? t('Draft on this device')
                      : t('Not saved')}{' '}
                · {marked} {t('of')} {roll.length} {t('marked')}
            </span>
        </div>
    );
}
