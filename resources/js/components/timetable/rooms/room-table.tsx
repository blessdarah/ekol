import { Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/TimetableRoomController';
import { capsLabelClass } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { amberText } from '../ui';
import { t } from '../../../lib/i18n';
import { type RoomsModel } from './model';

/** The rooms in the chosen group, with how much of the week each is booked. */
export function RoomTable({ rooms: model }: { rooms: RoomsModel }) {
    const { rooms, booking, shared, selected, shown } = model;

    return (
        <>
            {rooms.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'No rooms yet. Add the classrooms, laboratories and halls lessons are held in.',
                    )}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[620px] flex-col">
                        <div
                            className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}
                        >
                            <span className="w-[86px] shrink-0">
                                {t('Room')}
                            </span>
                            <span className="w-[100px] shrink-0">
                                {t('Type')}
                            </span>
                            <span className="w-[46px] shrink-0 text-right">
                                {t('Seats')}
                            </span>
                            <span className="w-[90px] shrink-0">
                                {t('Home class')}
                            </span>
                            <span className="flex-1">{t('Booked a week')}</span>
                        </div>
                        {shown.map((room, position) => {
                            const active = selected?.id === room.id;
                            const share =
                                shared.slotsAWeek > 0
                                    ? room.booked / shared.slotsAWeek
                                    : 0;
                            const tight = share >= 0.9;

                            return (
                                <Link
                                    key={room.id}
                                    href={index.url({
                                        query: { room: room.id },
                                    })}
                                    preserveScroll
                                    aria-current={active ? 'true' : undefined}
                                    className={`flex min-h-10 shrink-0 items-center gap-4 border-b border-solid border-border px-[14px] py-1 last:border-b-0 ${
                                        active
                                            ? 'bg-primary-tint'
                                            : `hover:bg-surface ${tableRowClass({ index: position })}`
                                    }`}
                                >
                                    <span className="w-[86px] shrink-0 text-[14px] leading-[18px] font-semibold text-text">
                                        {room.code}
                                    </span>
                                    <span className="w-[100px] shrink-0 truncate text-[13px] leading-4 text-text">
                                        {t(
                                            shared.kinds.find(
                                                (kind) =>
                                                    kind.value === room.kind,
                                            )?.label,
                                        )}
                                    </span>
                                    <span className="w-[46px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                        {room.capacity}
                                    </span>
                                    <span
                                        className={`w-[90px] shrink-0 truncate text-[13px] leading-4 ${room.home ? 'text-text' : 'text-text-muted'}`}
                                    >
                                        {room.home ?? t('None')}
                                    </span>
                                    <span className="flex min-w-0 flex-1 items-center gap-2">
                                        <span className="flex h-1 flex-1 rounded-full bg-border">
                                            <span
                                                className={`h-1 rounded-full ${tight ? 'bg-warning' : 'bg-success'}`}
                                                style={{
                                                    width: `${Math.min(100, Math.round(share * 100))}%`,
                                                }}
                                            />
                                        </span>
                                        <span
                                            className={`w-[44px] shrink-0 text-right font-mono text-[12px] leading-4 ${tight ? amberText : 'text-text'}`}
                                        >
                                            {room.booked}/{shared.slotsAWeek}
                                        </span>
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t('Booked a week counts slots out of')} {shared.slotsAWeek}{' '}
                {t('that lessons use')}
                {booking === 'draft'
                    ? t(' in the draft')
                    : booking === 'live'
                      ? t(' in the live timetable')
                      : ''}
                {t('. A room above 90% leaves little room to move lessons.')}
            </p>
        </>
    );
}
