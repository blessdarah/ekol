import { t } from '../../../lib/i18n';
import { fieldLabelClass } from '../../structure/ui';
import { shortDate } from '../../students/ui';
import { TickBox } from '../ui';
import { inputClass, type TimetableChanges } from './model';

/** The lessons to swap, or the lesson and its new room. */
export function ClassChange({ changes }: { changes: TimetableChanges }) {
    const {
        props,
        mode,
        date,
        slots,
        first,
        setFirst,
        second,
        setSecond,
        room,
        setRoom,
        wholeWeek,
        setWholeWeek,
    } = changes;

    return (
        <div className="flex flex-col gap-4">
            {slots.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t('This class has no lessons on the live timetable.')}
                </p>
            ) : (
                <div className="flex flex-col gap-4 sm:flex-row">
                    <label
                        className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                    >
                        {mode === 'swap' ? t('First lesson') : t('Lesson')}
                        <select
                            value={first}
                            onChange={(e) => setFirst(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">{t('Choose a lesson')}</option>
                            {slots.map((slot) => (
                                <option key={slot.id} value={slot.id}>
                                    {t(slot.label)}
                                    {mode === 'room'
                                        ? ` · ${slot.room ?? t('no room')}`
                                        : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    {mode === 'swap' ? (
                        <label
                            className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                        >
                            {t('Swap with')}
                            <select
                                value={second}
                                onChange={(e) => setSecond(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">{t('Choose a lesson')}</option>
                                {slots
                                    .filter((slot) => slot.id !== first)
                                    .map((slot) => (
                                        <option key={slot.id} value={slot.id}>
                                            {t(slot.label)}
                                        </option>
                                    ))}
                            </select>
                        </label>
                    ) : (
                        <label
                            className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                        >
                            {t('New room')}
                            <select
                                value={room}
                                onChange={(e) => setRoom(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">{t('Choose a room')}</option>
                                {(props.rooms ?? [])
                                    .filter(
                                        (option) =>
                                            option.id !==
                                            slots.find(
                                                (slot) => slot.id === first,
                                            )?.room_id,
                                    )
                                    .map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.code}
                                        </option>
                                    ))}
                            </select>
                        </label>
                    )}
                </div>
            )}
            <TickBox checked={wholeWeek} onChange={setWholeWeek}>
                {t('For the whole week of :date, not only that day', {
                    date: shortDate(date),
                })}
            </TickBox>
        </div>
    );
}
