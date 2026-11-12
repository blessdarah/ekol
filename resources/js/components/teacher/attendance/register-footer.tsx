import { t } from '../../../lib/i18n';
import { type RegisterModel } from './model';

/** What is left to mark, or why the register is closed. */
export function RegisterFooter({ register }: { register: RegisterModel }) {
    const { errors, locked, lesson, marked, roll } = register;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3">
            <p
                className={`text-[12px] leading-4 ${errors.marks ? 'font-medium text-danger' : 'text-text-muted'}`}
            >
                {errors.marks ??
                    (locked
                        ? t(
                              'This lesson has not started. Its register opens at :slice.',
                              { slice: lesson.time.slice(0, 5) },
                          )
                        : marked < roll.length
                          ? t(':marked still to mark', {
                                marked: roll.length - marked,
                            })
                          : t('Everyone is marked'))}
            </p>
            <p className="font-mono text-[11px] leading-[14px] text-text-muted">
                {t('P, A, L mark · ↑ ↓ move')}
            </p>
        </div>
    );
}
