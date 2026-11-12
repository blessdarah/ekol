import { t } from '../../../lib/i18n';
import { type RegisterModel } from './model';

/** How the register works, and a way into fullscreen. */
export function RegisterAside({ register }: { register: RegisterModel }) {
    const { setFull } = register;

    return (
        <aside className="flex shrink-0 flex-col gap-4 xl:w-[300px]">
            <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                <p className="text-[13px] leading-[18px] font-semibold text-text">
                    {t('How this register works')}
                </p>
                <ul className="flex flex-col gap-2 text-[12px] leading-4 text-text-muted">
                    <li>
                        {t(
                            '· One register per lesson, so a class you teach twice today has two.',
                        )}
                    </li>
                    <li>
                        {t(
                            '· An absence applies to this lesson only. It never marks the student absent for the day.',
                        )}
                    </li>
                    <li>
                        {t(
                            '· The office sees it on the student’s record as soon as you save.',
                        )}
                    </li>
                    <li>
                        {t(
                            '· You can change it until the end of today. After that the office handles corrections.',
                        )}
                    </li>
                </ul>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                <p className="text-[13px] leading-4 font-semibold text-text">
                    {t('Tired of scrolling?')}
                </p>
                <p className="text-[12px] leading-4 text-text-muted">
                    {t(
                        'Fullscreen hides the sidebar and the lesson picker so the roll fills the screen.',
                    )}
                </p>
                <button
                    type="button"
                    onClick={() => setFull(true)}
                    className="flex h-8 items-center justify-center rounded-md border border-solid border-primary text-[12px] leading-4 font-semibold text-primary hover:bg-primary-tint"
                >
                    {t('Open fullscreen · Esc to exit')}
                </button>
            </div>
        </aside>
    );
}
