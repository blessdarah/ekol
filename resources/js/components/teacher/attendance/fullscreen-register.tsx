import { t } from '../../../lib/i18n';
import { type RegisterModel, monoCaps } from './model';
import { RegisterCounts } from './register-counts';
import { RegisterFooter } from './register-footer';
import { RollList } from './roll-list';
import { SaveButton } from './save-button';

/** The register filling the screen, without the sidebar or lesson picker. */
export function FullscreenRegister({ register }: { register: RegisterModel }) {
    const { lesson, dateLabel, setFull } = register;

    return (
        <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary-tint px-4 py-3">
                <div className="flex flex-col gap-1">
                    <p className="font-mono text-[11px] leading-[14px] text-text-muted">
                        {t('Fullscreen · :period · :date_label :time', {
                            period: lesson.period,
                            date_label: dateLabel,
                            time: lesson.time,
                        })}
                    </p>
                    <p className="font-display text-[14px] leading-[18px] font-semibold text-text">
                        {lesson.class} · {lesson.subject}
                        {lesson.room
                            ? t(' · Room :room', { room: lesson.room })
                            : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <RegisterCounts register={register} />
                    <button
                        type="button"
                        onClick={() => setFull(false)}
                        className="flex h-9 items-center rounded-md border border-solid border-primary bg-white px-[14px] text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint"
                    >
                        {t('Exit fullscreen · Esc')}
                    </button>
                    <SaveButton register={register} />
                </div>
            </div>
            <div
                className={`flex items-center gap-3 px-4 ${monoCaps} text-text-muted`}
            >
                <span className="w-[30px] shrink-0" />
                <span className="w-[240px] shrink-0">{t('Student')}</span>
                <span className="flex-1">{t('Note for this lesson')}</span>
                <span className="w-[136px] shrink-0">{t('Mark')}</span>
            </div>
            <RollList register={register} />
            <RegisterFooter register={register} />
        </div>
    );
}
