import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { index, store } from '@/actions/App/Http/Controllers/TimetableChangeController';
import { checks, index as overview } from '@/actions/App/Http/Controllers/TimetableController';
import { ErrorText, capsLabelClass, fieldLabelClass } from '../../components/structure/ui';
import { shortDate } from '../../components/students/ui';
import {
    TickBox,
    TimetableHeader,
    type TimetablePhase,
    amberText,
    linkClass,
    primaryActionClass,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';

type Mode = 'cover' | 'swap' | 'room';

interface Cover {
    id: string;
    name: string;
    teaches: boolean;
}

interface ChangesProps {
    phase: TimetablePhase;
    live: number | null;
    mode: Mode;
    date: string;
    termStarts: string;
    termEnds: string;
    recent: { id: string; summary: string; on: string; by: string | null }[];
    teachers?: { id: string; name: string }[];
    teacher?: string;
    isSchoolDay?: boolean;
    lessons?: { id: string; period: string | null; title: string; room: string | null; covers: Cover[] }[];
    classes?: { id: string; name: string }[];
    class?: string;
    slots?: { id: string; label: string; room_id: string | null; room: string | null }[];
    rooms?: { id: string; code: string }[];
}

const inputClass =
    'h-10 w-full rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary';

const MODES: { key: Mode; label: string }[] = [
    { key: 'cover', label: 'Cover a lesson' },
    { key: 'swap', label: 'Swap two lessons' },
    { key: 'room', label: 'Change a room' },
];

function Changes(props: ChangesProps) {
    const { phase, live, mode, date, termStarts, termEnds, recent } = props;
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const lessons = props.lessons ?? [];
    const slots = props.slots ?? [];
    const [covers, setCovers] = useState<Record<string, string>>({});
    const [first, setFirst] = useState('');
    const [second, setSecond] = useState('');
    const [room, setRoom] = useState('');
    const [wholeWeek, setWholeWeek] = useState(false);
    const chosen = lessons.filter((lesson) => (covers[lesson.id] ?? lesson.covers[0]?.id ?? '') !== '');
    const error = Object.values(errors).find(Boolean);

    function visit(patch: Record<string, string>) {
        const query: Record<string, string> = { mode, date, ...patch };

        if (mode === 'cover' && props.teacher && !('teacher' in patch)) {
            query.teacher = props.teacher;
        }
        if (mode !== 'cover' && props.class && !('class' in patch)) {
            query.class = props.class;
        }

        router.get(index.url({ query }), {}, { preserveScroll: true, preserveState: patch.mode === undefined });
    }

    function submit() {
        const base = { kind: mode, date };
        const done = {
            preserveScroll: true,
            onSuccess: () => {
                setCovers({});
                setFirst('');
                setSecond('');
                setRoom('');
            },
        };

        if (mode === 'cover') {
            router.post(
                store.url(),
                {
                    ...base,
                    covers: chosen.map((lesson) => ({
                        slot_id: lesson.id,
                        staff_id: covers[lesson.id] ?? lesson.covers[0]?.id,
                    })),
                },
                done,
            );
        } else if (mode === 'swap') {
            router.post(store.url(), { ...base, whole_week: wholeWeek, slot_id: first, other_slot_id: second }, done);
        } else {
            router.post(store.url(), { ...base, whole_week: wholeWeek, slot_id: first, room_id: room }, done);
        }
    }

    const ready = mode === 'cover' ? chosen.length > 0 : mode === 'swap' ? first !== '' && second !== '' && first !== second : first !== '' && room !== '';

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title="Timetable changes" />
            <TimetableHeader
                page="changes"
                phase={phase}
                trail={[{ label: 'Changes' }]}
                title="Changes"
                meta={
                    live !== null
                        ? `Version ${live} is live. Cover a lesson, swap two lessons or change a room. No new version needed.`
                        : 'Changes apply to a published timetable, and none is live yet.'
                }
            />

            {live === null ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">Nothing is published yet</p>
                    <p className="max-w-[600px] text-[13px] leading-[19px] text-text">
                        Covers, swaps and room changes are made against the
                        live timetable. Build and publish version {phase.draft} first.
                    </p>
                    <Link href={overview.url()} className={linkClass}>
                        Back to the overview →
                    </Link>
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        <div className="flex flex-wrap gap-2">
                            {MODES.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={option.key === mode}
                                    onClick={() => router.get(index.url({ query: { mode: option.key, date } }))}
                                    className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                        option.key === mode
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-border font-medium text-text hover:bg-surface'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <p className={capsLabelClass}>{MODES.find((option) => option.key === mode)?.label}</p>

                        <div className="flex flex-col gap-4 sm:flex-row">
                            {mode === 'cover' ? (
                                <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                                    Teacher who is away
                                    <select value={props.teacher ?? ''} onChange={(e) => visit({ teacher: e.target.value })} className={inputClass}>
                                        <option value="">Choose a teacher</option>
                                        {(props.teachers ?? []).map((teacher) => (
                                            <option key={teacher.id} value={teacher.id}>
                                                {teacher.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                                    Class
                                    <select
                                        value={props.class ?? ''}
                                        onChange={(e) => {
                                            setFirst('');
                                            setSecond('');
                                            visit({ class: e.target.value });
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="">Choose a class</option>
                                        {(props.classes ?? []).map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <label className={`flex shrink-0 flex-col gap-[6px] sm:w-[200px] ${fieldLabelClass}`}>
                                Day
                                <input
                                    type="date"
                                    value={date}
                                    min={termStarts}
                                    max={termEnds}
                                    onChange={(e) => e.target.value && visit({ date: e.target.value })}
                                    className={`${inputClass} font-mono`}
                                />
                            </label>
                        </div>

                        {mode === 'cover' && props.teacher && (
                            <>
                                {lessons.length === 0 ? (
                                    <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                        {props.isSchoolDay
                                            ? 'This teacher has no lessons that day, so there is nothing to cover.'
                                            : 'That day is not a school day.'}
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                        <div className="flex min-w-[560px] flex-col">
                                            <div className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}>
                                                <span className="w-[60px] shrink-0">Period</span>
                                                <span className="flex-1">Lesson</span>
                                                <span className="w-[240px] shrink-0">Cover by</span>
                                            </div>
                                            {lessons.map((lesson, position) => {
                                                const value = covers[lesson.id] ?? lesson.covers[0]?.id ?? '';
                                                const pick = lesson.covers.find((cover) => cover.id === value);
                                                const weak = lesson.covers.length === 0 || (pick !== undefined && !pick.teaches);

                                                return (
                                                    <div
                                                        key={lesson.id}
                                                        className={`flex min-h-12 items-center gap-4 border-b border-solid border-border px-[14px] py-[6px] last:border-b-0 ${
                                                            weak ? 'bg-warning-tint' : position % 2 === 1 ? 'bg-row-alt' : ''
                                                        }`}
                                                    >
                                                        <span className="w-[60px] shrink-0 font-mono text-[13px] leading-4 text-text">{lesson.period}</span>
                                                        <span className="flex min-w-0 flex-1 flex-col">
                                                            <span className="truncate text-[14px] leading-[18px] font-medium text-text">{lesson.title}</span>
                                                            <span className={`text-[12px] leading-4 ${weak ? amberText : 'text-text-muted'}`}>
                                                                {lesson.covers.length === 0
                                                                    ? 'Nobody is free in this period'
                                                                    : weak
                                                                      ? 'Not a teacher of the subject · supervised study'
                                                                      : `Room ${lesson.room ?? 'not set'}`}
                                                            </span>
                                                        </span>
                                                        <select
                                                            aria-label={`Cover for ${lesson.title}`}
                                                            value={value}
                                                            disabled={lesson.covers.length === 0}
                                                            onChange={(e) => setCovers({ ...covers, [lesson.id]: e.target.value })}
                                                            className="h-[34px] w-[240px] shrink-0 rounded-md border border-solid border-border bg-white px-[10px] text-[13px] leading-4 text-text outline-none focus:border-primary disabled:opacity-50"
                                                        >
                                                            <option value="">No cover</option>
                                                            {lesson.covers.map((cover) => (
                                                                <option key={cover.id} value={cover.id}>
                                                                    {cover.teaches ? `${cover.name} · free, teaches it` : `Supervised study · ${cover.name}`}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {mode !== 'cover' && props.class && (
                            <div className="flex flex-col gap-4">
                                {slots.length === 0 ? (
                                    <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                        This class has no lessons on the live timetable.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-4 sm:flex-row">
                                        <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                                            {mode === 'swap' ? 'First lesson' : 'Lesson'}
                                            <select value={first} onChange={(e) => setFirst(e.target.value)} className={inputClass}>
                                                <option value="">Choose a lesson</option>
                                                {slots.map((slot) => (
                                                    <option key={slot.id} value={slot.id}>
                                                        {slot.label}
                                                        {mode === 'room' ? ` · ${slot.room ?? 'no room'}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        {mode === 'swap' ? (
                                            <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                                                Swap with
                                                <select value={second} onChange={(e) => setSecond(e.target.value)} className={inputClass}>
                                                    <option value="">Choose a lesson</option>
                                                    {slots
                                                        .filter((slot) => slot.id !== first)
                                                        .map((slot) => (
                                                            <option key={slot.id} value={slot.id}>
                                                                {slot.label}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                        ) : (
                                            <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                                                New room
                                                <select value={room} onChange={(e) => setRoom(e.target.value)} className={inputClass}>
                                                    <option value="">Choose a room</option>
                                                    {(props.rooms ?? [])
                                                        .filter((option) => option.id !== slots.find((slot) => slot.id === first)?.room_id)
                                                        .map((option) => (
                                                            <option key={option.id} value={option.id}>
                                                                {option.code}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                )}
                                <TickBox checked={wholeWeek} onChange={setWholeWeek}>
                                    For the whole week of {shortDate(date)}, not only that day
                                </TickBox>
                            </div>
                        )}

                        <ErrorText message={error} />

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[13px] leading-4 text-text-muted">
                                {mode === 'cover'
                                    ? 'Suggestions are teachers free in that period, those who teach the subject first.'
                                    : 'The change is logged here. Whether the room or the teachers are free is for you to check.'}
                            </p>
                            <div className="flex gap-2">
                                <Link href={index.url({ query: { mode } })} className={quietActionClass}>
                                    Cancel
                                </Link>
                                <button type="button" disabled={!ready} onClick={submit} className={primaryActionClass}>
                                    {mode === 'cover' ? 'Assign cover' : mode === 'swap' ? 'Swap the lessons' : 'Change the room'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <aside className="flex shrink-0 flex-col gap-3 border-solid border-border lg:w-[320px] lg:border-l lg:pl-7">
                        <p className={capsLabelClass}>Recent changes</p>
                        {recent.length === 0 ? (
                            <p className="text-[13px] leading-[19px] text-text-muted">No changes yet this term.</p>
                        ) : (
                            <ul className="flex flex-col border-t border-solid border-border">
                                {recent.map((change) => (
                                    <li key={change.id} className="flex flex-col gap-1 border-b border-solid border-border py-[10px]">
                                        <span className="text-[13px] leading-[18px] text-text">{change.summary}</span>
                                        <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                            {shortDate(change.on)}
                                            {change.by ? ` · by ${change.by}` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                            <p className="text-[13px] leading-4 font-semibold text-text">When to make a new version</p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                If a teacher or class changes for good, go to
                                Check inputs and start version {phase.draft}.
                            </p>
                            <Link href={checks.url()} className={linkClass}>
                                Open Check inputs →
                            </Link>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

export default withAppShell(Changes);
