import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { setup } from '@/actions/App/Http/Controllers/TimetableController';
import {
    destroy,
    index,
    store,
    update,
} from '@/actions/App/Http/Controllers/TimetableRoomController';
import {
    ErrorText,
    PlusIcon,
    RemoveIcon,
    capsLabelClass,
    fieldLabelClass,
} from '../../components/structure/ui';
import {
    TimetableHeader,
    type TimetablePhase,
    WEEKDAYS,
    amberText,
    linkClass,
    primaryActionClass,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';

interface Block {
    weekday: number;
    period_id: string;
    reason: string | null;
}

interface RoomRow {
    id: string;
    code: string;
    kind: string;
    capacity: number;
    home: string | null;
    booked: number;
    unavailable: Block[];
}

interface RoomsProps {
    phase: TimetablePhase;
    slotsAWeek: number;
    schoolDays: number;
    periods: { id: string; label: string }[];
    kinds: { value: string; label: string; special: boolean }[];
    subjects: { id: string; name: string; room_kind: string | null }[];
    rooms: RoomRow[];
}

const inputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-[10px] text-[14px] leading-[18px] text-text outline-none focus:border-primary';

const GROUPS = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'classroom', label: 'Classrooms', test: (kind: string) => kind === 'classroom' },
    { key: 'special', label: 'Laboratories', test: (kind: string) => kind === 'laboratory' || kind === 'computer' },
    { key: 'other', label: 'Halls and other', test: (kind: string) => !['classroom', 'laboratory', 'computer'].includes(kind) },
];

function RoomPanel({
    room,
    slotsAWeek,
    schoolDays,
    periods,
    kinds,
    subjects,
}: Omit<RoomsProps, 'phase' | 'rooms'> & { room: RoomRow | null }) {
    const form = useForm({
        code: room?.code ?? '',
        kind: room?.kind ?? 'classroom',
        capacity: String(room?.capacity ?? 45),
        unavailable: room?.unavailable ?? ([] as Block[]),
        subject_ids: subjects.filter((subject) => room && subject.room_kind === room.kind).map((subject) => subject.id),
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const days = WEEKDAYS.map((label, index) => ({ label, index })).filter(({ index }) => (schoolDays & (1 << index)) !== 0);
    const [draft, setDraft] = useState<{ open: boolean; weekday: number; period_id: string; reason: string }>({
        open: false,
        weekday: days[0]?.index ?? 0,
        period_id: periods[0]?.id ?? '',
        reason: '',
    });
    const kind = kinds.find((option) => option.value === data.kind);
    const share = room && slotsAWeek > 0 ? room.booked / slotsAWeek : 0;
    const left = subjects.filter((subject) => !data.subject_ids.includes(subject.id));

    function submit() {
        form.transform((values) => {
            const { subject_ids: subjectIds, ...rest } = values;

            return {
                ...rest,
                capacity: Number(values.capacity),
                ...(room && kind?.special ? { subject_ids: subjectIds } : {}),
            };
        });

        if (room) {
            form.patch(update.url(room.id), { preserveScroll: true });
        } else {
            form.post(store.url());
        }
    }

    function addBlock() {
        if (!draft.period_id) {
            return;
        }

        const exists = data.unavailable.some((block) => block.weekday === draft.weekday && block.period_id === draft.period_id);

        if (!exists) {
            setData('unavailable', [
                ...data.unavailable,
                { weekday: draft.weekday, period_id: draft.period_id, reason: draft.reason.trim() || null },
            ]);
        }

        setDraft({ ...draft, open: false, reason: '' });
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            className="flex flex-col gap-4"
        >
            <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-[22px] leading-7 font-bold text-text">{room ? room.code : 'New room'}</h2>
                {room && share >= 0.9 && (
                    <span className={`flex h-[22px] items-center rounded-full bg-warning-tint px-2 text-[12px] leading-4 font-medium ${amberText}`}>
                        Nearly full
                    </span>
                )}
            </div>

            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                Name
                <input type="text" value={data.code} onChange={(e) => setData('code', e.target.value)} className={inputClass} />
                <ErrorText message={errors.code} />
            </label>

            <div className="flex gap-[10px]">
                <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                    Type
                    <select value={data.kind} onChange={(e) => setData('kind', e.target.value)} className={inputClass}>
                        {kinds.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={`flex w-[90px] shrink-0 flex-col gap-[6px] ${fieldLabelClass}`}>
                    Seats
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
                <div className="flex flex-col gap-2">
                    <p className={fieldLabelClass}>Lessons that need this kind of room</p>
                    <div className="flex flex-wrap gap-[6px]">
                        {subjects
                            .filter((subject) => data.subject_ids.includes(subject.id))
                            .map((subject) => (
                                <span
                                    key={subject.id}
                                    className="flex h-6 items-center gap-[6px] rounded-sm bg-primary-tint pr-[6px] pl-[10px] text-[13px] leading-4 font-medium text-primary"
                                >
                                    {subject.name}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${subject.name}`}
                                        onClick={() => setData('subject_ids', data.subject_ids.filter((id) => id !== subject.id))}
                                        className="flex size-4 items-center justify-center rounded-sm hover:bg-white"
                                    >
                                        <RemoveIcon tone="#0E4D3A" />
                                    </button>
                                </span>
                            ))}
                        {data.subject_ids.length === 0 && (
                            <span className="text-[13px] leading-6 text-text-muted">None yet</span>
                        )}
                    </div>
                    {left.length > 0 && (
                        <select
                            aria-label="Add a subject"
                            value=""
                            onChange={(e) => e.target.value && setData('subject_ids', [...data.subject_ids, e.target.value])}
                            className={`${inputClass} h-8 text-[13px]`}
                        >
                            <option value="">Add a subject…</option>
                            {left.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                    {subject.name}
                                    {subject.room_kind ? ' (moves from another kind)' : ''}
                                </option>
                            ))}
                        </select>
                    )}
                    <p className="text-[12px] leading-[17px] text-text-muted">
                        This applies to every {kind.label.toLowerCase()}, not only this one.
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <p className={fieldLabelClass}>Not available</p>
                {data.unavailable.length > 0 ? (
                    <ul className="flex flex-col gap-1 rounded-md bg-surface px-3 py-2">
                        {data.unavailable.map((block, position) => (
                            <li key={`${block.weekday}-${block.period_id}`} className="flex items-center justify-between gap-3 py-1">
                                <span className="text-[13px] leading-4 text-text">
                                    {WEEKDAYS[block.weekday]}{' '}
                                    {periods.find((period) => period.id === block.period_id)?.label ?? 'period'}
                                    {block.reason ? ` · ${block.reason}` : ''}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Remove this block"
                                    onClick={() => setData('unavailable', data.unavailable.filter((_, index) => index !== position))}
                                    className="flex size-5 items-center justify-center rounded-sm hover:bg-white"
                                >
                                    <RemoveIcon tone="#56625C" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[13px] leading-4 text-text-muted">Open every period.</p>
                )}
                {draft.open ? (
                    <div className="flex flex-col gap-2 rounded-md border border-solid border-border p-3">
                        <div className="flex gap-2">
                            <select
                                aria-label="Day"
                                value={draft.weekday}
                                onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}
                                className={`${inputClass} h-8 text-[13px]`}
                            >
                                {days.map((day) => (
                                    <option key={day.index} value={day.index}>
                                        {day.label}
                                    </option>
                                ))}
                            </select>
                            <select
                                aria-label="Period"
                                value={draft.period_id}
                                onChange={(e) => setDraft({ ...draft, period_id: e.target.value })}
                                className={`${inputClass} h-8 text-[13px]`}
                            >
                                {periods.map((period) => (
                                    <option key={period.id} value={period.id}>
                                        {period.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <input
                            type="text"
                            value={draft.reason}
                            onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                            placeholder="Reason, such as cleaning"
                            className={`${inputClass} h-8 text-[13px]`}
                        />
                        <div className="flex gap-3">
                            <button type="button" onClick={addBlock} className={linkClass}>
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => setDraft({ ...draft, open: false })}
                                className="text-[13px] leading-4 text-text-muted hover:underline"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    periods.length > 0 && (
                        <button type="button" onClick={() => setDraft({ ...draft, open: true })} className={`self-start ${linkClass}`}>
                            Block {data.unavailable.length > 0 ? 'another' : 'a'} period
                        </button>
                    )
                )}
                <ErrorText message={errors.unavailable} />
            </div>

            <div className="flex items-center gap-4">
                <button type="submit" disabled={processing} className={`${primaryActionClass} h-9 flex-1`}>
                    {room ? 'Save room' : 'Add room'}
                </button>
                {room && (
                    <button
                        type="button"
                        onClick={() => {
                            if (window.confirm(`Retire ${room.code}? Draft lessons in it keep their time and lose the room.`)) {
                                router.delete(destroy.url(room.id));
                            }
                        }}
                        className="shrink-0 px-2 text-[13px] leading-4 font-medium text-danger hover:underline"
                    >
                        Retire room
                    </button>
                )}
            </div>
            <p className="text-[13px] leading-[19px] text-text-muted">
                {room
                    ? 'Retiring a room takes it off the list. Draft lessons that were in it show with no room in Review.'
                    : 'A new room can be booked the next time you generate.'}
            </p>
        </form>
    );
}

function Rooms({ phase, rooms, ...shared }: RoomsProps) {
    const params = new URLSearchParams(usePage().url.split('?')[1] ?? '');
    const [group, setGroup] = useState('all');
    const adding = params.get('new') === '1';
    const selected = adding ? null : (rooms.find((room) => room.id === params.get('room')) ?? rooms[0] ?? null);
    const shown = rooms.filter((room) => GROUPS.find((option) => option.key === group)?.test(room.kind));

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title="Rooms" />
            <TimetableHeader
                page="setup"
                phase={phase}
                trail={[{ label: 'Setup', href: setup.url() }, { label: 'Rooms' }]}
                title="Rooms"
                meta={`${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}. The timetable books lessons from this list.`}
                action={
                    <>
                        <Link href={setup.url()} className={quietActionClass}>
                            ← Back to Setup
                        </Link>
                        <Link href={index.url({ query: { new: '1' } })} className={primaryActionClass}>
                            <PlusIcon />
                            Add a room
                        </Link>
                    </>
                }
            />

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        {GROUPS.map((option) => {
                            const total = rooms.filter((room) => option.test(room.kind)).length;
                            const active = option.key === group;

                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setGroup(option.key)}
                                    className={`flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
                                        active
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-border font-medium text-text hover:bg-surface'
                                    }`}
                                >
                                    {option.label} · {total}
                                </button>
                            );
                        })}
                    </div>

                    {rooms.length === 0 ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            No rooms yet. Add the classrooms, laboratories and
                            halls lessons are held in.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[620px] flex-col">
                                <div className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}>
                                    <span className="w-[86px] shrink-0">Room</span>
                                    <span className="w-[100px] shrink-0">Type</span>
                                    <span className="w-[46px] shrink-0 text-right">Seats</span>
                                    <span className="w-[90px] shrink-0">Home class</span>
                                    <span className="flex-1">Booked a week</span>
                                </div>
                                {shown.map((room, position) => {
                                    const active = selected?.id === room.id;
                                    const share = shared.slotsAWeek > 0 ? room.booked / shared.slotsAWeek : 0;
                                    const tight = share >= 0.9;

                                    return (
                                        <Link
                                            key={room.id}
                                            href={index.url({ query: { room: room.id } })}
                                            preserveScroll
                                            aria-current={active ? 'true' : undefined}
                                            className={`flex min-h-10 shrink-0 items-center gap-4 border-b border-solid border-border px-[14px] py-1 last:border-b-0 ${
                                                active ? 'bg-primary-tint' : `hover:bg-surface ${position % 2 === 1 ? 'bg-row-alt' : ''}`
                                            }`}
                                        >
                                            <span className="w-[86px] shrink-0 text-[14px] leading-[18px] font-semibold text-text">{room.code}</span>
                                            <span className="w-[100px] shrink-0 truncate text-[13px] leading-4 text-text">
                                                {shared.kinds.find((kind) => kind.value === room.kind)?.label}
                                            </span>
                                            <span className="w-[46px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">{room.capacity}</span>
                                            <span className={`w-[90px] shrink-0 truncate text-[13px] leading-4 ${room.home ? 'text-text' : 'text-text-muted'}`}>
                                                {room.home ?? 'None'}
                                            </span>
                                            <span className="flex min-w-0 flex-1 items-center gap-2">
                                                <span className="flex h-1 flex-1 rounded-full bg-border">
                                                    <span
                                                        className={`h-1 rounded-full ${tight ? 'bg-warning' : 'bg-success'}`}
                                                        style={{ width: `${Math.min(100, Math.round(share * 100))}%` }}
                                                    />
                                                </span>
                                                <span className={`w-[44px] shrink-0 text-right font-mono text-[12px] leading-4 ${tight ? amberText : 'text-text'}`}>
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
                        Booked a week counts slots out of {shared.slotsAWeek} that
                        lessons use{phase.has_draft ? ' in the draft' : phase.live !== null ? ' in the live timetable' : ''}. A room above 90%
                        leaves little room to move lessons.
                    </p>
                </div>

                <aside className="shrink-0 border-solid border-border lg:w-[340px] lg:border-l lg:pl-7">
                    {selected || adding || rooms.length === 0 ? (
                        <RoomPanel key={selected?.id ?? 'new'} room={selected} {...shared} />
                    ) : null}
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Rooms);
