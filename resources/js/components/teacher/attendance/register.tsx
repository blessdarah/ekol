import { t } from '../../../lib/i18n';
import { FullscreenRegister } from './fullscreen-register';
import { type Lesson, type RollRow, useRegister } from './model';
import { RegisterAside } from './register-aside';
import { RegisterBanner } from './register-banner';
import { RegisterFooter } from './register-footer';
import { RollHeader } from './roll-header';
import { RollList } from './roll-list';

/** One lesson's register, inline or fullscreen. */
export function Register(props: {
    lesson: Lesson;
    roll: RollRow[];
    date: string;
    dateLabel: string;
}) {
    const register = useRegister(props);
    const { full, roll, lesson } = register;

    if (full) {
        return <FullscreenRegister register={register} />;
    }

    return (
        <>
            <RegisterBanner register={register} />

            <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <RollHeader register={register} />
                    {roll.length === 0 ? (
                        <p className="rounded-lg border border-solid border-border p-4 text-[13px] leading-[19px] text-text-muted">
                            {t('No student is enrolled in :class.', {
                                class: lesson.class,
                            })}
                        </p>
                    ) : (
                        <RollList register={register} />
                    )}
                    <RegisterFooter register={register} />
                </div>

                <RegisterAside register={register} />
            </div>
        </>
    );
}
