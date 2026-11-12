import { t } from '../../../lib/i18n';
import { type RegisterModel } from './model';

/** Save the register once everyone is marked. */
export function SaveButton({ register }: { register: RegisterModel }) {
    const { saving, locked, marked, roll, lesson, dirty, save } = register;

    return (
        <button
            type="button"
            disabled={
                saving ||
                locked ||
                marked < roll.length ||
                roll.length === 0 ||
                (lesson.saved && !dirty)
            }
            onClick={save}
            className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
        >
            {saving
                ? t('Saving…')
                : lesson.saved
                  ? t('Save changes')
                  : t('Save register')}
        </button>
    );
}
