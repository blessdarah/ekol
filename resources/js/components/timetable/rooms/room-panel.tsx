import { router } from '@inertiajs/react';
import { destroy } from '@/actions/App/Http/Controllers/TimetableRoomController';
import { ErrorText, fieldLabelClass } from '../../structure/ui';
import { amberText, primaryActionClass } from '../ui';
import { t } from '../../../lib/i18n';
import { inputClass, type RoomPanelProps, useRoomPanel } from './model';
import { RoomBlocks } from './room-blocks';
import { RoomSubjects } from './room-subjects';

/** The side panel for adding a room or editing the one picked. */
export function RoomPanel(props: RoomPanelProps) {
    const panel = useRoomPanel(props);
    const {
        room,
        kinds,
        data,
        setData,
        processing,
        errors,
        kind,
        share,
        submit,
    } = panel;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            className="flex flex-col gap-4"
        >
            <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-[22px] leading-7 font-bold text-text">
                    {room ? room.code : t('New room')}
                </h2>
                {room && share >= 0.9 && (
                    <span
                        className={`flex h-[22px] items-center rounded-full bg-warning-tint px-2 text-[12px] leading-4 font-medium ${amberText}`}
                    >
                        {t('Nearly full')}
                    </span>
                )}
            </div>

            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                {t('Name')}
                <input
                    type="text"
                    value={data.code}
                    onChange={(e) => setData('code', e.target.value)}
                    className={inputClass}
                />
                <ErrorText message={errors.code} />
            </label>

            <div className="flex gap-[10px]">
                <label
                    className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Type')}
                    <select
                        value={data.kind}
                        onChange={(e) => setData('kind', e.target.value)}
                        className={inputClass}
                    >
                        {kinds.map((option) => (
                            <option key={option.value} value={option.value}>
                                {t(option.label)}
                            </option>
                        ))}
                    </select>
                </label>
                <label
                    className={`flex w-[90px] shrink-0 flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Seats')}
                    <input
                        type="number"
                        min={1}
                        value={data.capacity}
                        onChange={(e) => setData('capacity', e.target.value)}
                        className={`${inputClass} font-mono`}
                    />
                </label>
            </div>
            <ErrorText message={errors.kind ?? errors.capacity} />

            {room && kind?.special && (
                <RoomSubjects panel={panel} kind={kind} />
            )}

            <RoomBlocks panel={panel} />

            <div className="flex items-center gap-4">
                <button
                    type="submit"
                    disabled={processing}
                    className={`${primaryActionClass} h-9 flex-1`}
                >
                    {room ? t('Save room') : t('Add room')}
                </button>
                {room && (
                    <button
                        type="button"
                        onClick={() => {
                            if (
                                window.confirm(
                                    t(
                                        'Retire :code? Draft lessons in it keep their time and lose the room.',
                                        { code: room.code },
                                    ),
                                )
                            ) {
                                router.delete(destroy.url(room.id));
                            }
                        }}
                        className="shrink-0 px-2 text-[13px] leading-4 font-medium text-danger hover:underline"
                    >
                        {t('Retire room')}
                    </button>
                )}
            </div>
            <p className="text-[13px] leading-[19px] text-text-muted">
                {room
                    ? t(
                          'Retiring a room takes it off the list. Draft lessons that were in it show with no room in Review.',
                      )
                    : t('A new room can be booked the next time you generate.')}
            </p>
        </form>
    );
}
