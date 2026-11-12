import { ManagementTabs } from '../../components/structure/ui';
import PageHeader from '../../components/shell/page-header';
import { Head, Link } from '@inertiajs/react';
import { setup } from '@/actions/App/Http/Controllers/TimetableController';
import { index } from '@/actions/App/Http/Controllers/TimetableRoomController';
import { PlusIcon } from '../../components/structure/ui';
import {
    primaryActionClass,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import {
    type RoomsProps,
    useRooms,
} from '../../components/timetable/rooms/model';
import { RoomFilters } from '../../components/timetable/rooms/room-filters';
import { RoomPanel } from '../../components/timetable/rooms/room-panel';
import { RoomTable } from '../../components/timetable/rooms/room-table';

function Rooms(props: RoomsProps) {
    const model = useRooms(props);
    const { rooms, shared, adding, selected } = model;

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Rooms and subjects')} />
            <PageHeader
                root={{ label: t('Rooms and subjects'), href: index.url() }}
                title={t('Rooms and subjects')}
                meta={t(
                    ':rooms :rooms_a. The timetable books lessons from this list.',
                    {
                        rooms: rooms.length,
                        rooms_a: rooms.length === 1 ? 'room' : 'rooms',
                    },
                )}
                action={
                    <>
                        <Link href={setup.url()} className={quietActionClass}>
                            {t('Timetable')}
                        </Link>
                        <Link
                            href={index.url({ query: { new: '1' } })}
                            className={primaryActionClass}
                        >
                            <PlusIcon />
                            {t('Add a room')}
                        </Link>
                    </>
                }
            />
            <ManagementTabs group="resources" active="rooms" />

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <RoomFilters rooms={model} />
                    <RoomTable rooms={model} />
                </div>

                <aside className="shrink-0 border-solid border-border lg:w-[340px] lg:border-l lg:pl-7">
                    {selected || adding || rooms.length === 0 ? (
                        <RoomPanel
                            key={selected?.id ?? 'new'}
                            room={selected}
                            {...shared}
                        />
                    ) : null}
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Rooms);
