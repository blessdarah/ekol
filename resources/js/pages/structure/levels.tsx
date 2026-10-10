import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { index as seriesIndex } from '@/actions/App/Http/Controllers/SeriesController';
import {
    createLevel,
    destroyClass,
    levelTemplates,
    storeClass,
    storeRoom,
    updateClass,
    updateLevel,
} from '@/actions/App/Http/Controllers/StructureController';
import {
    CYCLE_LABELS,
    ErrorText,
    LockIcon,
    PlusIcon,
    StreamChip,
    StructureHeader,
    StructureTabs,
    SUBSYSTEM_LABELS,
    Toggle,
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface ClassProp {
    id: string;
    name: string;
    capacity: number;
    students: number;
    form_master_id: string | null;
    form_master: string | null;
    home_room_id: string | null;
    home_room: string | null;
}

interface LevelProp {
    id: string;
    name: string;
    code: string | null;
    cycle: string;
    subsystem: string | null;
    uses_series: boolean;
    series_allowed: boolean;
    series: { stream: string; label: string }[];
    students: number;
    classes: ClassProp[];
}

interface RoomProp {
    id: string;
    code: string;
    kind: string;
    capacity: number;
    home_of: string | null;
}

interface LevelsProps {
    yearLabel: string | null;
    selected: string | null;
    levels: LevelProp[];
    staff: { id: string; name: string }[];
    rooms: RoomProp[];
}

const NEW_ROOM = '__new';

const smallLabelClass = 'text-[12px] leading-4 font-medium text-text-muted';

const smallInputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-[10px] text-[14px] leading-[18px] text-text outline-none focus:border-primary';

function ClassEditor({
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
    const [room, setRoom] = useState({ code: '', capacity: String(item.capacity) });
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
            onError: (failed) => setRemoveError(Object.values(failed)[0] ?? null),
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
                <label className={`flex flex-1 flex-col gap-1 ${smallLabelClass}`}>
                    Name
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className={smallInputClass}
                    />
                </label>
                <label className={`flex w-[72px] shrink-0 flex-col gap-1 ${smallLabelClass}`}>
                    Seats
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
                Form master
                <select
                    value={data.form_master_id}
                    onChange={(e) => setData('form_master_id', e.target.value)}
                    className={smallInputClass}
                >
                    <option value="">No form master yet</option>
                    {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                            {member.name}
                        </option>
                    ))}
                </select>
                <ErrorText message={errors.form_master_id} />
            </label>
            <label className={`flex flex-col gap-1 ${smallLabelClass}`}>
                Home room
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
                    <option value="">No home room yet</option>
                    {freeRooms.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.code} · {option.capacity} seats
                        </option>
                    ))}
                    <option value={NEW_ROOM}>+ Add a room…</option>
                </select>
                <ErrorText message={errors.home_room_id} />
            </label>
            {addingRoom && (
                <div className="flex flex-col gap-2 rounded-md border border-solid border-border bg-white p-2">
                    <div className="flex items-end gap-2">
                        <label className={`flex flex-1 flex-col gap-1 ${smallLabelClass}`}>
                            Room name
                            <input
                                type="text"
                                placeholder="A5"
                                value={room.code}
                                onChange={(e) => setRoom({ ...room, code: e.target.value })}
                                className={smallInputClass}
                            />
                        </label>
                        <label className={`flex w-[72px] shrink-0 flex-col gap-1 ${smallLabelClass}`}>
                            Seats
                            <input
                                type="number"
                                min={1}
                                value={room.capacity}
                                onChange={(e) => setRoom({ ...room, capacity: e.target.value })}
                                className={`${smallInputClass} font-mono`}
                            />
                        </label>
                        <button
                            type="button"
                            disabled={!room.code.trim()}
                            onClick={addRoom}
                            className="h-9 shrink-0 rounded-md border border-solid border-border px-3 text-[13px] font-medium text-primary hover:bg-surface disabled:opacity-50"
                        >
                            Add
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
                    Save class
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 items-center px-[10px] text-[13px] leading-4 font-medium text-text hover:underline"
                >
                    Cancel
                </button>
                <span className="flex-1" />
                <button
                    type="button"
                    onClick={remove}
                    className="text-[13px] leading-4 font-medium text-danger hover:underline"
                >
                    Remove class
                </button>
            </div>
            <ErrorText message={removeError} />
        </form>
    );
}

function LevelPanel({
    level,
    hasYear,
    staff,
    rooms,
}: {
    level: LevelProp;
    hasYear: boolean;
    staff: LevelsProps['staff'];
    rooms: RoomProp[];
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function toggleSeries(next: boolean) {
        router.patch(
            updateLevel.url(level.id),
            { uses_series: next },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setError(null),
                onError: (failed) => setError(Object.values(failed)[0] ?? null),
            },
        );
    }

    function addClass() {
        router.post(
            storeClass.url(level.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setError(null),
                onError: (failed) => setError(Object.values(failed)[0] ?? null),
            },
        );
    }

    return (
        <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[340px] lg:border-l lg:pl-8">
            <div className="flex flex-col gap-[2px]">
                <h2 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-text">
                    {level.name}
                </h2>
                <p className="font-mono text-[13px] leading-4 text-text-muted">
                    {[level.code, CYCLE_LABELS[level.cycle]].filter(Boolean).join(' · ')}
                </p>
            </div>

            <dl className="flex flex-col">
                {[
                    ['Cycle', CYCLE_LABELS[level.cycle]],
                    ['Subsystem', level.subsystem ? SUBSYSTEM_LABELS[level.subsystem] : '—'],
                ].map(([label, value]) => (
                    <div
                        key={label}
                        className="flex items-baseline gap-4 border-t border-solid border-border py-[10px]"
                    >
                        <dt className="w-24 shrink-0 text-[13px] leading-[1.35] text-text-muted">
                            {label}
                        </dt>
                        <dd className="text-[14px] leading-[1.35] text-text">{value}</dd>
                    </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-y border-solid border-border py-[14px]">
                    <div className="flex flex-col gap-[2px]">
                        <span className="flex items-center gap-2 text-[14px] leading-[18px] font-semibold text-text">
                            {!level.series_allowed && <LockIcon />}
                            Uses series
                        </span>
                        <span className="text-[13px] leading-[18px] text-text-muted">
                            {level.series_allowed
                                ? 'Students pick a series, then electives.'
                                : 'Only for high school levels in the GCE subsystem.'}
                        </span>
                    </div>
                    <Toggle
                        checked={level.uses_series}
                        disabled={!level.series_allowed}
                        label={`${level.name} uses series`}
                        onChange={toggleSeries}
                    />
                </div>
            </dl>

            {level.uses_series && (
                <Link
                    href={seriesIndex.url({ query: { level: level.id } })}
                    className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-solid border-border bg-white text-[13px] leading-4 font-medium text-text hover:bg-surface"
                >
                    Manage series for {level.name}
                    <svg width="14" height="14" viewBox="0 0 24 24">
                        <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#101915" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </Link>
            )}

            <div className="flex flex-col gap-[10px]">
                <div className="flex items-baseline justify-between">
                    <p className={capsLabelClass}>
                        Classes · {level.classes.length} · {level.students} students
                    </p>
                    {hasYear && (
                        <button
                            type="button"
                            onClick={addClass}
                            className="text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            + Add a class
                        </button>
                    )}
                </div>
                {level.classes.length > 0 ? (
                    <div className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                        {level.classes.map((item, position) =>
                            editing === item.id ? (
                                <ClassEditor
                                    key={item.id}
                                    item={item}
                                    staff={staff}
                                    rooms={rooms}
                                    onClose={() => setEditing(null)}
                                />
                            ) : (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setEditing(item.id)}
                                    className={`flex items-center gap-3 border-b border-solid border-border px-[14px] py-[10px] text-left last:border-b-0 hover:bg-surface ${
                                        position % 2 === 1 ? 'bg-row-alt' : ''
                                    }`}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                        <span className="text-[14px] leading-[18px] font-medium text-text">
                                            {item.name}
                                        </span>
                                        <span
                                            className={`truncate text-[12px] leading-4 ${
                                                item.form_master ? 'text-text-muted' : 'text-warning'
                                            }`}
                                        >
                                            {item.form_master ?? 'No form master yet'} ·{' '}
                                            {item.home_room ? `Room ${item.home_room}` : 'No home room'}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                        {item.students} / {item.capacity}
                                    </span>
                                </button>
                            ),
                        )}
                    </div>
                ) : (
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {hasYear
                            ? 'No classes yet for this level.'
                            : 'Classes belong to an academic year. Make a year active in School Setup first.'}
                    </p>
                )}
                <ErrorText message={error} />
                <p className="text-[13px] leading-[19px] text-text-muted">
                    Numbers are students out of seats. A class with students
                    or timetable lessons cannot be removed; move them first.
                    The form master and home room are read by the timetable
                    and report cards.
                </p>
            </div>
        </aside>
    );
}

function Levels({ yearLabel, selected, levels, staff, rooms }: LevelsProps) {
    const [selectedId, setSelectedId] = useState(selected ?? levels[0]?.id ?? null);
    const level = levels.find((option) => option.id === selectedId) ?? levels[0];
    const classCount = levels.reduce((sum, option) => sum + option.classes.length, 0);
    const seriesLevels = levels.filter((option) => option.uses_series).length;

    return (
        <div className="flex flex-col gap-7">
            <Head title="Levels and series" />
            <StructureHeader
                title="Levels and series"
                tag={`Structure${yearLabel ? ` · ${yearLabel}` : ''}`}
                meta={`${levels.length} levels · ${classCount} classes · series on ${seriesLevels} levels`}
                action={
                    <div className="flex items-center gap-4">
                        {levels.length > 0 && (
                            <Link
                                href={levelTemplates.url()}
                                className="text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                Standard structure
                            </Link>
                        )}
                        <Link href={createLevel.url()} className={solidButtonClass}>
                            <PlusIcon />
                            Add level
                        </Link>
                    </div>
                }
            />
            <StructureTabs active="levels" />

            {levels.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
                    <p className="text-[13px] leading-[19px] text-text">
                        No levels yet. Start from a standard structure to
                        create Form 1 to Upper Sixth (or Sixième to
                        Terminale) with their classes in one go, or add
                        levels one at a time.
                    </p>
                    <Link href={levelTemplates.url()} className={outlineButtonClass}>
                        Start from a standard structure
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-8 lg:flex-row">
                    <div className="min-w-0 flex-1 overflow-x-auto">
                        <div className="flex min-w-[640px] flex-col self-start overflow-clip rounded-lg border border-solid border-border">
                            <div className="flex items-center gap-4 border-b border-solid border-border bg-surface px-4 py-2 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                                <span className="w-[150px] shrink-0">Level</span>
                                <span className="w-[100px] shrink-0">Cycle</span>
                                <span className="w-14 shrink-0 text-[11px] tracking-normal">Classes</span>
                                <span className="w-16 shrink-0 text-[11px] tracking-normal">Students</span>
                                <span className="flex-1">Series</span>
                            </div>
                            {levels.map((option, position) => {
                                const active = option.id === level?.id;
                                const high = option.cycle === 'high_school';

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setSelectedId(option.id)}
                                        className={`flex h-[54px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 text-left last:border-b-0 ${
                                            active
                                                ? 'bg-primary-tint'
                                                : `hover:bg-surface ${position % 2 === 1 ? 'bg-row-alt' : ''}`
                                        }`}
                                    >
                                        <span className="flex w-[150px] shrink-0 flex-col">
                                            <span
                                                className={`truncate text-[15px] leading-5 ${active ? 'font-semibold text-primary' : 'font-medium text-text'}`}
                                            >
                                                {option.name}
                                            </span>
                                            <span className="font-mono text-[12px] leading-4 text-text-muted">
                                                {option.code ?? '—'}
                                            </span>
                                        </span>
                                        <span className="flex w-[100px] shrink-0">
                                            <span
                                                className={`flex h-[22px] items-center rounded-full border border-solid px-2 text-[12px] leading-4 font-medium ${
                                                    high
                                                        ? 'border-primary bg-white text-primary'
                                                        : 'border-border bg-surface text-text-muted'
                                                }`}
                                            >
                                                {CYCLE_LABELS[option.cycle]}
                                            </span>
                                        </span>
                                        <span className="w-14 shrink-0 font-mono text-[13px] leading-4 text-text">
                                            {option.classes.length}
                                        </span>
                                        <span className="w-16 shrink-0 font-mono text-[13px] leading-4 text-text">
                                            {option.students}
                                        </span>
                                        <span className="flex flex-1 items-center gap-[6px]">
                                            {!option.uses_series ? (
                                                <>
                                                    <LockIcon />
                                                    <span className="text-[13px] leading-4 text-text-muted">
                                                        Not available
                                                    </span>
                                                </>
                                            ) : option.series.length > 0 ? (
                                                option.series.map((range) => (
                                                    <StreamChip key={range.stream} stream={range.stream}>
                                                        {range.label}
                                                    </StreamChip>
                                                ))
                                            ) : (
                                                <span className="text-[13px] leading-4 text-warning">
                                                    No series set up yet
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {level && (
                        <LevelPanel
                            key={level.id}
                            level={level}
                            hasYear={yearLabel !== null}
                            staff={staff}
                            rooms={rooms}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default withAppShell(Levels);
