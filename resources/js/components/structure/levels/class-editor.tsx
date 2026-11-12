import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import {
    destroyClass,
    updateClass,
} from '@/actions/App/Http/Controllers/SchoolClassController';
import { storeRoom } from '@/actions/App/Http/Controllers/StructureController';
import { t } from '../../../lib/i18n';
import { ErrorText } from '../ui';
import {
    type ClassProp,
    type LevelsProps,
    NEW_ROOM,
    type RoomProp,
    smallInputClass,
    smallLabelClass,
} from './model';

/** The inline editor for one class: name, seats, form master and home room. */
export function ClassEditor({
    item,
    staff,
    rooms,
    onClose,
}: {
    item: ClassProp;
    staff: LevelsProps['staff'];
    rooms: RoomProp[];
    onClose: () => void;
}) {
    const form = useForm({
        name: item.name,
        capacity: String(item.capacity),
        form_master_id: item.form_master_id ?? '',
        home_room_id: item.home_room_id ?? '',
    });
    const { data, setData, errors, processing } = form;
    const [addingRoom, setAddingRoom] = useState(false);
    const [room, setRoom] = useState({
        code: '',
        capacity: String(item.capacity),
    });
    const [roomError, setRoomError] = useState<string | null>(null);
    const [removeError, setRemoveError] = useState<string | null>(null);
    const freeRooms = rooms.filter(
        (option) => option.home_of === null || option.home_of === item.id,
    );

    function submit(event: FormEvent) {
        event.preventDefault();
        form.transform((values) => ({
            ...values,
            form_master_id: values.form_master_id || null,
            home_room_id: values.home_room_id || null,
        }));
        form.patch(updateClass.url(item.id), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    }

    function addRoom() {
        router.post(storeRoom.url(), room, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (page) => {
                const created = (page.props.rooms as RoomProp[]).find(
                    (option) => option.code === room.code.trim(),
                );

                if (created) {
                    setData('home_room_id', created.id);
                }
                setAddingRoom(false);
                setRoomError(null);
            },
            onError: (failed) => setRoomError(Object.values(failed)[0] ?? null),
        });
    }

    function remove() {
        router.delete(destroyClass.url(item.id), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onClose,
            onError: (failed) =>
                setRemoveError(Object.values(failed)[0] ?? null),
        });
    }

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-3 border-b border-solid border-border bg-primary-tint px-[14px] pt-3 pb-[14px] last:border-b-0"
        >
            <div className="flex items-center justify-between">
                <span className="text-[14px] leading-[18px] font-semibold text-primary">
                    {item.name}
                </span>
                <span className="font-mono text-[13px] leading-4 text-text">
                    {item.students} / {item.capacity}
                </span>
            </div>
            <div className="flex gap-2">
                <label
                    className={`flex flex-1 flex-col gap-1 ${smallLabelClass}`}
                >
                    {t('Name')}
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className={smallInputClass}
                    />
                </label>
                <label
                    className={`flex w-[72px] shrink-0 flex-col gap-1 ${smallLabelClass}`}
                >
                    {t('Seats')}
                    <input
                        type="number"
                        min={1}
                        value={data.capacity}
                        onChange={(e) => setData('capacity', e.target.value)}
                        className={`${smallInputClass} font-mono`}
                    />
                </label>
            </div>
            <ErrorText message={errors.name ?? errors.capacity} />
            <label className={`flex flex-col gap-1 ${smallLabelClass}`}>
                {t('Form master')}
                <select
                    value={data.form_master_id}
                    onChange={(e) => setData('form_master_id', e.target.value)}
                    className={smallInputClass}
                >
                    <option value="">{t('No form master yet')}</option>
                    {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                            {member.name}
                        </option>
                    ))}
                </select>
                <ErrorText message={errors.form_master_id} />
            </label>
            <label className={`flex flex-col gap-1 ${smallLabelClass}`}>
                {t('Home room')}
                <select
                    value={addingRoom ? NEW_ROOM : data.home_room_id}
                    onChange={(e) => {
                        if (e.target.value === NEW_ROOM) {
                            setAddingRoom(true);
                        } else {
                            setAddingRoom(false);
                            setData('home_room_id', e.target.value);
                        }
                    }}
                    className={smallInputClass}
                >
                    <option value="">{t('No home room yet')}</option>
                    {freeRooms.map((option) => (
                        <option key={option.id} value={option.id}>
                            {t(':code · :capacity seats', {
                                code: option.code,
                                capacity: option.capacity,
                            })}
                        </option>
                    ))}
                    <option value={NEW_ROOM}>{t('+ Add a room…')}</option>
                </select>
                <ErrorText message={errors.home_room_id} />
            </label>
            {addingRoom && (
                <div className="flex flex-col gap-2 rounded-md border border-solid border-border bg-white p-2">
                    <div className="flex items-end gap-2">
                        <label
                            className={`flex flex-1 flex-col gap-1 ${smallLabelClass}`}
                        >
                            {t('Room name')}
                            <input
                                type="text"
                                placeholder="A5"
                                value={room.code}
                                onChange={(e) =>
                                    setRoom({ ...room, code: e.target.value })
                                }
                                className={smallInputClass}
                            />
                        </label>
                        <label
                            className={`flex w-[72px] shrink-0 flex-col gap-1 ${smallLabelClass}`}
                        >
                            {t('Seats')}
                            <input
                                type="number"
                                min={1}
                                value={room.capacity}
                                onChange={(e) =>
                                    setRoom({
                                        ...room,
                                        capacity: e.target.value,
                                    })
                                }
                                className={`${smallInputClass} font-mono`}
                            />
                        </label>
                        <button
                            type="button"
                            disabled={!room.code.trim()}
                            onClick={addRoom}
                            className="h-9 shrink-0 rounded-md border border-solid border-border px-3 text-[13px] font-medium text-primary hover:bg-surface disabled:opacity-50"
                        >
                            {t('Add')}
                        </button>
                    </div>
                    <ErrorText message={roomError} />
                </div>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={processing}
                    className="flex h-8 items-center rounded-md bg-primary px-[14px] text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                    {t('Save class')}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 items-center px-[10px] text-[13px] leading-4 font-medium text-text hover:underline"
                >
                    {t('Cancel')}
                </button>
                <span className="flex-1" />
                <button
                    type="button"
                    onClick={remove}
                    className="text-[13px] leading-4 font-medium text-danger hover:underline"
                >
                    {t('Remove class')}
                </button>
            </div>
            <ErrorText message={removeError} />
        </form>
    );
}
