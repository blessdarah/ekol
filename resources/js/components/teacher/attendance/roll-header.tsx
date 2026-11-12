import { t } from '../../../lib/i18n';
import { type RegisterModel } from './model';
import { SaveButton } from './save-button';

/** The roll's title, with marking the rest present, fullscreen and save. */
export function RollHeader({ register }: { register: RegisterModel }) {
    const { lesson, locked, roll, remember, entries, setFull } = register;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3">
            <h2 className="font-display text-[15px] leading-5 font-semibold text-text">
                {t('Roll · :class', { class: lesson.class })}
            </h2>
            <div className="flex gap-2 print:hidden">
                <button
                    type="button"
                    disabled={locked || roll.length === 0}
                    onClick={() =>
                        remember(
                            Object.fromEntries(
                                roll.map((row) => [
                                    row.student_id,
                                    {
                                        ...entries[row.student_id],
                                        status:
                                            entries[row.student_id].status ??
                                            'present',
                                    },
                                ]),
                            ),
                        )
                    }
                    className="flex h-8 items-center rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text hover:bg-surface disabled:opacity-40"
                >
                    {t('Mark the rest present')}
                </button>
                <button
                    type="button"
                    onClick={() => setFull(true)}
                    className="flex h-8 items-center rounded-md border border-solid border-primary bg-white px-3 text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint"
                >
                    {t('Fullscreen')}
                </button>
                <SaveButton register={register} />
            </div>
        </div>
    );
}
