import { Head, Link, router, usePage } from '@inertiajs/react';
import { type DragEvent, useState } from 'react';
import { index as changes } from '@/actions/App/Http/Controllers/TimetableChangeController';
import { generator, index as overview, publishing } from '@/actions/App/Http/Controllers/TimetableController';
import {
    destroy as removeSlot,
    show as review,
    store as placeLesson,
    update as updateSlot,
} from '@/actions/App/Http/Controllers/TimetableReviewController';
import { ErrorText, LockIcon, capsLabelClass } from '../../components/structure/ui';
import {
    TickBox,
    TimetableHeader,
    type TimetablePhase,
    amberText,
    linkClass,
    plural,
    primaryActionClass,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';

type View = 'class' | 'teacher' | 'room';

interface Cell {
    id: string;
    title: string;
    sub: string;
    tone: 'primary' | 'science';
    clash: boolean;
    locked: boolean;
}

interface Move {
    weekday: number;
    period_id: string;
    label: string;
}

interface SlotPanel {
    type: 'slot';
    id: string;
    title: string;
    when: string;
    problems: { title: string; text: string }[];
    teacher_id: string | null;
    teacher: string | null;
    teachers: { id: string; name: string; free: boolean }[];
    room_id: string | null;
    room: string | null;
    rooms: { id: string; code: string }[];
    locked: boolean;
    moves: Move[];
}

interface LessonPanel {
    type: 'lesson';
    id: string;
    title: string;
    count: number;
    why: string | null;
    teacher: string | null;
    moves: Move[];
}

interface PickerRow {
    id: string;
    name: string;
    meta: string | null;
    note: string | null;
    issues: number;
    clash: boolean;
    title: string;
    detail: string;
}

interface ReviewProps {
    phase: TimetablePhase;
    version: { number: number; live: boolean };
    view: View;
    picker: PickerRow[];
    current: PickerRow | null;
    days: { index: number; short: string }[];
    periods: { id: string; label: string; is_break: boolean }[];
    cells: Record<string, Cell[]>;
    closed: Record<string, string>;
    unplaced: { lesson_id: string; subject: string; count: number }[];
    clashes: { title: string; detail: string; slot_id: string | null }[];
    selected: SlotPanel | LessonPanel | null;
}

const VIEWS: { key: View; label: string; noun: string }[] = [
    { key: 'class', label: 'By class', noun: 'class' },
    { key: 'teacher', label: 'By teacher', noun: 'teacher' },
    { key: 'room', label: 'By room', noun: 'room' },
];

const visitOptions = { preserveScroll: true, preserveState: true } as const;

function Review({ phase, version, view, picker, current, days, periods, cells, closed, unplaced, clashes, selected }: ReviewProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [search, setSearch] = useState('');
    const [dragging, setDragging] = useState(false);
    const readOnly = version.live;
    const noun = VIEWS.find((option) => option.key === view)?.noun ?? 'class';
    const listed = picker.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()));

    function url(patch: { view?: View; id?: string; slot?: string; lesson?: string }): string {
        const query: Record<string, string> = { view: patch.view ?? view };
        const id = 'id' in patch ? patch.id : patch.view ? undefined : current?.id;

        if (id) {
            query.id = id;
        }
        if (patch.slot) {
            query.slot = patch.slot;
        }
        if (patch.lesson) {
            query.lesson = patch.lesson;
        }
        if (readOnly) {
            query.version = 'live';
        }

        return review.url({ query });
    }

    function select(patch: { slot?: string; lesson?: string }) {
        router.get(url(patch), {}, { ...visitOptions, replace: true });
    }

    function change(slotId: string, data: Record<string, string | number | boolean | null>) {
        router.patch(updateSlot.url(slotId), data, visitOptions);
    }

    function drop(token: string, weekday: number, periodId: string) {
        if (token.startsWith('lesson:')) {
            router.post(placeLesson.url(), { lesson_id: token.slice(7), weekday, period_id: periodId }, visitOptions);
        } else if (token) {
            change(token, { weekday, period_id: periodId });
        }
    }

    function onDrop(event: DragEvent, weekday: number, periodId: string) {
        event.preventDefault();
        setDragging(false);
        drop(event.dataTransfer.getData('text/plain'), weekday, periodId);
    }

    const active = selected ? (selected.type === 'slot' ? selected.id : `lesson:${selected.id}`) : '';
    const offered = new Set((selected?.moves ?? []).map((move) => `${move.weekday}|${move.period_id}`));

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title="Review the timetable" />
            <TimetableHeader
                page="review"
                phase={phase}
                trail={[{ label: readOnly ? 'Live timetable' : 'Review' }]}
                title={readOnly ? 'The live timetable' : 'Review the timetable'}
                meta={
                    readOnly
                        ? `Version ${version.number} · what the school works from. It changes only through Changes or a new version.`
                        : `Draft version ${version.number} · look at it by class, by teacher or by room, and fix what is flagged.`
                }
                action={
                    readOnly ? (
                        <>
                            <Link href={overview.url()} className={quietActionClass}>
                                ← Overview
                            </Link>
                            <Link href={changes.url()} className={primaryActionClass}>
                                Open Changes
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link href={generator.url()} className={quietActionClass}>
                                ← Generate again
                            </Link>
                            <Link
                                href={publishing.url()}
                                aria-disabled={phase.to_fix !== 0}
                                tabIndex={phase.to_fix !== 0 ? -1 : undefined}
                                className={primaryActionClass}
                            >
                                Next: publish →
                            </Link>
                        </>
                    )
                }
            />

            <div className="flex flex-1 flex-col gap-5 xl:flex-row">
                <div className="flex shrink-0 flex-col gap-[10px] xl:w-[220px]">
                    <div className="flex rounded-md bg-surface p-[3px]">
                        {VIEWS.map((option) => (
                            <Link
                                key={option.key}
                                href={url({ view: option.key })}
                                aria-current={option.key === view ? 'page' : undefined}
                                className={`flex h-7 flex-1 items-center justify-center rounded-[6px] text-[12px] leading-4 ${
                                    option.key === view ? 'bg-white font-semibold text-text' : 'font-medium text-text-muted hover:text-text'
                                }`}
                            >
                                {option.label}
                            </Link>
                        ))}
                    </div>
                    <input
                        type="search"
                        aria-label={`Find a ${noun}`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Find a ${noun}`}
                        className="h-[34px] shrink-0 rounded-md border border-solid border-border px-[10px] text-[13px] leading-4 text-text outline-none placeholder:text-text-muted focus:border-primary"
                    />
                    <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
                        {listed.map((row) => {
                            const on = row.id === current?.id;

                            return (
                                <Link
                                    key={row.id}
                                    href={url({ id: row.id })}
                                    preserveScroll
                                    aria-current={on ? 'true' : undefined}
                                    className={`flex h-[34px] shrink-0 items-center justify-between gap-2 rounded-md border border-solid px-[10px] ${
                                        on ? 'border-primary bg-primary-tint' : 'border-transparent hover:bg-surface'
                                    }`}
                                >
                                    <span className={`min-w-0 truncate text-[13px] leading-4 ${on ? 'font-semibold text-primary' : 'font-medium text-text'}`}>
                                        {row.name}
                                    </span>
                                    {row.meta !== null ? (
                                        <span className={`shrink-0 font-mono text-[11px] leading-[14px] ${row.clash ? 'text-danger' : row.note ? amberText : 'text-text-muted'}`}>
                                            {row.meta}
                                            {row.note && ` · ${row.note}`}
                                        </span>
                                    ) : row.issues > 0 ? (
                                        <span
                                            className={`flex h-[18px] shrink-0 items-center rounded-full px-[6px] font-mono text-[11px] leading-[14px] ${
                                                row.clash ? 'bg-danger-tint text-danger' : `bg-warning-tint ${amberText}`
                                            }`}
                                        >
                                            {row.issues}
                                        </span>
                                    ) : (
                                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                    )}
                                </Link>
                            );
                        })}
                        {listed.length === 0 && (
                            <p className="px-[10px] py-2 text-[13px] leading-4 text-text-muted">No {noun} matches.</p>
                        )}
                    </div>
                    <p className="text-[12px] leading-[17px] text-text-muted">
                        {view === 'class'
                            ? `Number = things to fix. A dot means the class is clean. ${plural(picker.length, 'class', 'classes')} in all.`
                            : view === 'teacher'
                              ? `Periods placed out of the most each teacher can teach. ${plural(picker.length, 'teacher')} in all.`
                              : `Slots used a week. ${plural(picker.length, 'room')} in all.`}
                    </p>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {!current ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            There is no {noun} to show yet.
                        </p>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
                                <h2 className="font-display text-[22px] leading-7 font-bold text-text">{current.title}</h2>
                                <p className="text-[13px] leading-4 text-text-muted">{current.detail}</p>
                            </div>

                            {unplaced.length > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-solid border-warning bg-warning-tint px-3 py-2">
                                    <p className="text-[13px] leading-[18px] text-text">
                                        Not placed: {unplaced.map((item) => `${item.subject}, ${plural(item.count, 'lesson')}`).join(' · ')}.
                                        {readOnly ? '' : ' Pick one, then a free slot, or drag it onto the grid.'}
                                    </p>
                                    <div className="flex flex-wrap gap-[6px]">
                                        {unplaced.map((item) => (
                                            <button
                                                key={item.lesson_id}
                                                type="button"
                                                draggable={!readOnly}
                                                onDragStart={(event) => {
                                                    event.dataTransfer.setData('text/plain', `lesson:${item.lesson_id}`);
                                                    setDragging(true);
                                                }}
                                                onDragEnd={() => setDragging(false)}
                                                onClick={() => select({ lesson: item.lesson_id })}
                                                className={`flex h-[26px] items-center rounded-sm border border-solid px-[10px] text-[12px] leading-4 font-semibold text-text ${
                                                    active === `lesson:${item.lesson_id}` ? 'border-primary bg-primary-tint' : 'border-warning bg-white'
                                                }`}
                                            >
                                                {item.subject}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {clashes.map((clash, position) => (
                                <div
                                    key={`${clash.title}-${position}`}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-solid border-danger bg-danger-tint px-3 py-2"
                                >
                                    <p className="text-[13px] leading-[18px] text-text">
                                        Clash: {clash.title}. {clash.detail}.
                                    </p>
                                    {clash.slot_id && (
                                        <button
                                            type="button"
                                            onClick={() => select({ slot: clash.slot_id ?? undefined })}
                                            className="text-[13px] leading-4 font-semibold text-danger hover:underline"
                                        >
                                            Fix it →
                                        </button>
                                    )}
                                </div>
                            ))}

                            <ErrorText message={errors.move} />

                            <div className="overflow-x-auto">
                                <div className="flex min-w-[520px] flex-col gap-1">
                                    <div className="flex gap-1 pl-11">
                                        {days.map((day) => (
                                            <span key={day.index} className="flex-1 text-center text-[12px] leading-4 font-semibold text-text-muted">
                                                {day.short}
                                            </span>
                                        ))}
                                    </div>
                                    {periods.map((period) =>
                                        period.is_break ? (
                                            <div key={period.id} className="flex h-5 shrink-0 items-center pl-11">
                                                <span className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                                                    {period.label}
                                                </span>
                                            </div>
                                        ) : (
                                            <div key={period.id} className="flex gap-1">
                                                <span className="w-10 shrink-0 truncate font-mono text-[11px] leading-[48px] text-text-muted">
                                                    {period.label}
                                                </span>
                                                {days.map((day) => {
                                                    const key = `${day.index}|${period.id}`;
                                                    const here = cells[key] ?? [];

                                                    if (here.length === 0) {
                                                        if (closed[key]) {
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className="flex h-12 min-w-0 flex-1 items-center rounded-[6px] bg-surface px-[7px] text-[11px] leading-[14px] text-text-muted"
                                                                >
                                                                    {closed[key]}
                                                                </div>
                                                            );
                                                        }

                                                        const open = offered.has(key);

                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                disabled={readOnly || (!active && !dragging)}
                                                                onClick={() => active && drop(active, day.index, period.id)}
                                                                onDragOver={(event) => !readOnly && event.preventDefault()}
                                                                onDrop={(event) => !readOnly && onDrop(event, day.index, period.id)}
                                                                className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-[6px] border border-dashed text-[11px] leading-[14px] ${
                                                                    open
                                                                        ? 'border-success bg-success-tint font-medium text-success'
                                                                        : 'border-border text-text-muted enabled:hover:bg-surface'
                                                                }`}
                                                            >
                                                                {open ? 'Move here' : 'Free'}
                                                            </button>
                                                        );
                                                    }

                                                    if (here.length > 1) {
                                                        return (
                                                            <div
                                                                key={key}
                                                                className="flex h-12 min-w-0 flex-1 flex-col overflow-clip rounded-[6px] border-2 border-solid border-danger bg-danger-tint px-[5px] py-[2px]"
                                                            >
                                                                <span className="text-[10px] leading-3 font-semibold text-danger">Clash</span>
                                                                {here.slice(0, 2).map((cell) => (
                                                                    <button
                                                                        key={cell.id}
                                                                        type="button"
                                                                        onClick={() => select({ slot: cell.id })}
                                                                        className={`truncate text-left text-[11px] leading-[14px] text-danger hover:underline ${active === cell.id ? 'font-bold' : 'font-medium'}`}
                                                                    >
                                                                        {cell.title} · {cell.sub}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        );
                                                    }

                                                    const cell = here[0];
                                                    const on = active === cell.id;

                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            draggable={!readOnly}
                                                            onDragStart={(event) => {
                                                                event.dataTransfer.setData('text/plain', cell.id);
                                                                setDragging(true);
                                                            }}
                                                            onDragEnd={() => setDragging(false)}
                                                            onClick={() => select({ slot: cell.id })}
                                                            aria-pressed={on}
                                                            className={`relative flex h-12 min-w-0 flex-1 flex-col rounded-[6px] px-[7px] py-[5px] text-left ${
                                                                cell.clash
                                                                    ? 'border-2 border-solid border-danger bg-danger-tint'
                                                                    : `border-l-[3px] border-solid ${
                                                                          cell.tone === 'science' ? 'border-science bg-science-tint' : 'border-primary bg-primary-tint'
                                                                      }`
                                                            } ${on ? 'outline outline-2 outline-offset-1 outline-text' : ''}`}
                                                        >
                                                            <span className={`w-full truncate text-[12px] leading-[15px] font-semibold ${cell.clash ? 'text-danger' : 'text-text'}`}>
                                                                {cell.title}
                                                            </span>
                                                            <span className={`w-full truncate text-[11px] leading-[14px] ${cell.clash ? 'text-danger' : 'text-text-muted'}`}>
                                                                {cell.clash ? `Clash · ${cell.sub}` : cell.sub}
                                                            </span>
                                                            {cell.locked && (
                                                                <span className="absolute top-[5px] right-[5px]">
                                                                    <LockIcon size={10} />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                            <p className="text-[12px] leading-[17px] text-text-muted">
                                {view === 'class'
                                    ? 'Each box is the subject, the teacher and the room.'
                                    : view === 'teacher'
                                      ? 'Each box is the class taught and the room. A grey box is a time this teacher does not work, taken from the staff record.'
                                      : 'Each box is the lesson and the class using the room. Grey is a time the room is closed, set on the Rooms screen.'}
                                {!readOnly && ' Drag a lesson onto a free slot, or pick it and choose where it goes. A padlock marks a locked lesson.'}
                            </p>
                        </>
                    )}
                </div>

                <aside className="flex shrink-0 flex-col gap-3 border-solid border-border xl:w-[290px] xl:border-l xl:pl-5">
                    <p className={capsLabelClass}>Selected lesson</p>
                    {!selected ? (
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            Pick a lesson on the grid to see who teaches it,
                            where, and {readOnly ? 'when' : 'where it can move'}.
                        </p>
                    ) : selected.type === 'lesson' ? (
                        <>
                            <div className="flex flex-col gap-1">
                                <p className="font-display text-[18px] leading-6 font-bold text-text">{selected.title}</p>
                                <p className="font-mono text-[12px] leading-4 text-text-muted uppercase">
                                    {plural(selected.count, 'lesson')} not placed{selected.teacher ? ` · ${selected.teacher}` : ''}
                                </p>
                            </div>
                            {selected.why && (
                                <div className="flex flex-col gap-[6px] rounded-md bg-warning-tint px-3 py-[10px]">
                                    <p className={`text-[13px] leading-4 font-semibold ${amberText}`}>Why it is not placed</p>
                                    <p className="text-[13px] leading-[18px] text-text">{selected.why}.</p>
                                </div>
                            )}
                            <Moves
                                title="Place it in a free slot"
                                moves={selected.moves}
                                empty="No slot has the class, the teacher and a room all free. Move another lesson first, or change the teacher on the subject."
                                onPick={(move) => drop(`lesson:${selected.id}`, move.weekday, move.period_id)}
                            />
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col gap-1">
                                <p className="font-display text-[18px] leading-6 font-bold text-text">{selected.title}</p>
                                <p className="font-mono text-[12px] leading-4 text-text-muted">{selected.when}</p>
                            </div>
                            {selected.problems.map((problem) => (
                                <div key={problem.text} className="flex flex-col gap-[6px] rounded-md bg-danger-tint px-3 py-[10px]">
                                    <p className="text-[13px] leading-4 font-semibold text-danger">{problem.title}</p>
                                    <p className="text-[13px] leading-[18px] text-text">{problem.text}</p>
                                </div>
                            ))}
                            <div className="flex flex-col border-t border-solid border-border">
                                <label className="flex items-center justify-between gap-3 border-b border-solid border-border py-[6px]">
                                    <span className="text-[13px] leading-4 text-text-muted">Teacher</span>
                                    {readOnly ? (
                                        <span className="py-[6px] text-[13px] leading-4 text-text">{selected.teacher ?? 'None'}</span>
                                    ) : (
                                        <select
                                            value={selected.teacher_id ?? ''}
                                            onChange={(e) => change(selected.id, { staff_id: e.target.value || null })}
                                            className="h-7 max-w-[170px] rounded-sm bg-transparent text-right text-[13px] leading-4 text-text outline-none focus:bg-surface"
                                        >
                                            {selected.teachers.map((teacher) => (
                                                <option key={teacher.id} value={teacher.id} disabled={!teacher.free && teacher.id !== selected.teacher_id}>
                                                    {teacher.name}
                                                    {!teacher.free && teacher.id !== selected.teacher_id ? ' (busy)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </label>
                                <label className="flex items-center justify-between gap-3 border-b border-solid border-border py-[6px]">
                                    <span className="text-[13px] leading-4 text-text-muted">Room</span>
                                    {readOnly ? (
                                        <span className="py-[6px] text-[13px] leading-4 text-text">{selected.room ?? 'None'}</span>
                                    ) : (
                                        <select
                                            value={selected.room_id ?? ''}
                                            onChange={(e) => change(selected.id, { room_id: e.target.value || null })}
                                            className="h-7 max-w-[170px] rounded-sm bg-transparent text-right text-[13px] leading-4 text-text outline-none focus:bg-surface"
                                        >
                                            <option value="">No room</option>
                                            {selected.rooms.map((room) => (
                                                <option key={room.id} value={room.id}>
                                                    {room.code}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </label>
                            </div>
                            {!readOnly && (
                                <>
                                    <Moves
                                        title="Move to a free slot"
                                        moves={selected.moves}
                                        empty="No other slot has the class, the teacher and the room all free."
                                        onPick={(move) => change(selected.id, { weekday: move.weekday, period_id: move.period_id })}
                                    />
                                    <TickBox checked={selected.locked} onChange={(next) => change(selected.id, { is_locked: next })}>
                                        Lock this lesson. Generate again keeps it.
                                    </TickBox>
                                    <button
                                        type="button"
                                        onClick={() => router.delete(removeSlot.url(selected.id), visitOptions)}
                                        className={`self-start ${linkClass}`}
                                    >
                                        Take it off the timetable
                                    </button>
                                    <p className="text-[12px] leading-[17px] text-text-muted">
                                        A move is only offered where the class,
                                        the teacher and the room are all free.
                                    </p>
                                </>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}

function Moves({ title, moves, empty, onPick }: { title: string; moves: Move[]; empty: string; onPick: (move: Move) => void }) {
    return (
        <div className="flex flex-col gap-[6px]">
            <p className="text-[13px] leading-4 font-medium text-text">{title}</p>
            {moves.length === 0 ? (
                <p className="text-[13px] leading-[18px] text-text-muted">{empty}</p>
            ) : (
                moves.map((move) => (
                    <button
                        key={`${move.weekday}-${move.period_id}`}
                        type="button"
                        onClick={() => onPick(move)}
                        className="flex h-9 shrink-0 items-center justify-between rounded-md border border-solid border-border px-[10px] hover:bg-surface"
                    >
                        <span className="text-[13px] leading-4 text-text">{move.label}</span>
                        <span className="text-[12px] leading-4 text-success">All free</span>
                    </button>
                ))
            )}
        </div>
    );
}

export default withAppShell(Review);
