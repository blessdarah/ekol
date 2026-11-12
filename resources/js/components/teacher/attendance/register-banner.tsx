import { t } from '../../../lib/i18n';
import { type RegisterModel } from './model';
import { RegisterCounts } from './register-counts';

/** Which lesson's register is being marked, with its counts. */
export function RegisterBanner({ register }: { register: RegisterModel }) {
    const { lesson, dateLabel } = register;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary-tint px-4 py-3">
            <div className="flex flex-col gap-1">
                <p className="font-mono text-[11px] leading-[14px] text-text-muted">
                    {t('Register being marked')}
                </p>
                <p className="font-display text-[14px] leading-[18px] font-semibold text-text">
                    {lesson.period} · {lesson.class} · {lesson.subject}
                    {lesson.room
                        ? t(' · Room :room', { room: lesson.room })
                        : ''}{' '}
                    · {dateLabel}
                </p>
            </div>
            <RegisterCounts register={register} />
        </div>
    );
}
