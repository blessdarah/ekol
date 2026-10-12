import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { show, store } from '@/actions/App/Http/Controllers/AttendanceController';
import { withAppShell } from '../../layouts/app-layout';

type Status = 'present' | 'absent' | 'late';

interface Lesson {
    id: string;
    period: string;
    time: string;
    class: string;
    subject: string;
    room: string | null;
    students: number;
    present: number;
    saved: boolean;
    started: boolean;
    cover: boolean;
}

interface RollRow {
    student_id: string;
    name: string;
    status: Status | 'excused' | null;
    note: string | null;
}

interface AttendanceProps {
    dateLabel: string;
    date: string;
    weekLabel: string | null;
    hasTimetable: boolean;
    lessons: Lesson[];
    lesson: string | null;
    roll: RollRow[];
}

interface Entry {
    status: Status | null;
    note: string;
}

const monoCaps = 'font-mono text-[11px] leading-[14px] tracking-[0.08em] uppercase';
const MARKS: { key: Status; letter: string; on: string; avatar: string }[] = [
    { key: 'present', letter: 'P', on: 'border-success bg-success text-white', avatar: 'bg-primary-tint text-primary' },
    { key: 'absent', letter: 'A', on: 'border-danger bg-danger text-white', avatar: 'bg-danger-tint text-danger' },
    { key: 'late', letter: 'L', on: 'border-warning bg-warning text-white', avatar: 'bg-warning-tint text-[#8A5A12]' },
];

function initials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);

    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function fromRoll(roll: RollRow[]): Record<string, Entry> {
    return Object.fromEntries(
        roll.map((row) => [row.student_id, { status: row.status === 'excused' ? 'absent' : row.status, note: row.note ?? '' }]),
    );
}

function Register({ lesson, roll, date, dateLabel }: { lesson: Lesson; roll: RollRow[]; date: string; dateLabel: string }) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const draftKey = `ekol.register.${lesson.id}.${date}`;
    const [entries, setEntries] = useState<Record<string, Entry>>(() => {
        const saved = fromRoll(roll);

        if (lesson.saved) {
            return saved;
        }

        try {
            const draft = JSON.parse(window.localStorage.getItem(draftKey) ?? 'null') as Record<string, Entry> | null;

            return draft ? { ...saved, ...Object.fromEntries(Object.entries(draft).filter(([id]) => id in saved)) } : saved;
        } catch {
            return saved;
        }
    });
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [full, setFull] = useState(false);
    const [focus, setFocus] = useState(0);
    const rows = useRef<(HTMLDivElement | null)[]>([]);

    const tally = (status: Status) => roll.filter((row) => entries[row.student_id]?.status === status).length;
    const marked = roll.filter((row) => entries[row.student_id]?.status).length;
    const locked = !lesson.started;

    function remember(next: Record<string, Entry>) {
        setEntries(next);
        setDirty(true);

        try {
            window.localStorage.setItem(draftKey, JSON.stringify(next));
        } catch {
            // A draft is a convenience; the register still works without it.
        }
    }

    function set(id: string, patch: Partial<Entry>) {
        remember({ ...entries, [id]: { ...entries[id], ...patch } });
    }

    function save() {
        router.post(
            store.url(lesson.id),
            {
                marks: roll
                    .filter((row) => entries[row.student_id]?.status)
                    .map((row) => ({
                        student_id: row.student_id,
                        status: entries[row.student_id].status,
                        note: entries[row.student_id].note.trim() || null,
                    })),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setDirty(false);

                    try {
                        window.localStorage.removeItem(draftKey);
                    } catch {
                        // Nothing to clear.
                    }
                },
            },
        );
    }

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

            if (event.key === 'Escape' && full) {
                setFull(false);

                return;
            }

            if (typing || locked || event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }

            const row = roll[focus];
            const mark = MARKS.find((option) => option.letter.toLowerCase() === event.key.toLowerCase());

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const next = Math.max(0, Math.min(roll.length - 1, focus + (event.key === 'ArrowDown' ? 1 : -1)));
                setFocus(next);
                rows.current[next]?.scrollIntoView({ block: 'nearest' });
            } else if (mark && row) {
                event.preventDefault();
                set(row.student_id, { status: mark.key });
                const next = Math.min(roll.length - 1, focus + 1);
                setFocus(next);
                rows.current[next]?.scrollIntoView({ block: 'nearest' });
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    });

    const counts = (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] leading-[18px] font-medium text-text">
            <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                {tally('present')} present
            </span>
            <span className="flex items-center gap-2 border-l border-solid border-border pl-4">
                <span className="h-2 w-2 rounded-full bg-danger" />
                {tally('absent')} absent
            </span>
            <span className="flex items-center gap-2 border-l border-solid border-border pl-4">
                <span className="h-2 w-2 rounded-full bg-warning" />
                {tally('late')} late
            </span>
            <span className="border-l border-solid border-border pl-4 font-mono text-[12px] leading-4 font-normal text-text-muted">
                {lesson.saved && !dirty ? 'Saved' : dirty ? 'Draft on this device' : 'Not saved'} · {marked} of {roll.length} marked
            </span>
        </div>
    );

    const saveButton = (
        <button
            type="button"
            disabled={saving || locked || marked < roll.length || roll.length === 0 || (lesson.saved && !dirty)}
            onClick={save}
            className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
        >
            {saving ? 'Saving…' : lesson.saved ? 'Save changes' : 'Save register'}
        </button>
    );

    const list = (
        <div className="flex flex-col gap-[6px]">
            {roll.map((row, position) => {
                const entry = entries[row.student_id];
                const tone = MARKS.find((mark) => mark.key === entry.status);

                return (
                    <div
                        key={row.student_id}
                        ref={(element) => {
                            rows.current[position] = element;
                        }}
                        onClick={() => setFocus(position)}
                        className={`flex min-h-[50px] items-center gap-3 rounded-lg border border-solid px-4 py-[6px] ${
                            entry.status === 'absent'
                                ? 'border-[#F1D5D1] bg-[#FDF6F5]'
                                : entry.status === 'late'
                                  ? 'border-[#EFDDBB] bg-[#FDFAF3]'
                                  : 'border-border bg-white'
                        } ${position === focus && !locked ? 'outline outline-2 outline-offset-1 outline-primary' : ''}`}
                    >
                        <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] leading-[14px] font-semibold ${tone?.avatar ?? 'bg-surface text-text-muted'}`}>
                            {initials(row.name)}
                        </span>
                        <span className={`min-w-0 truncate text-[14px] leading-[18px] font-semibold text-text ${full ? 'w-[240px] shrink-0' : 'flex-1'}`}>
                            {row.name}
                            {row.status === 'excused' && <span className="ml-2 text-[12px] font-normal text-text-muted">excused by the office</span>}
                        </span>
                        {(full || entry.status === 'absent' || entry.status === 'late') && (
                            <input
                                type="text"
                                aria-label={`Note for ${row.name}`}
                                value={entry.note}
                                disabled={locked}
                                onChange={(e) => set(row.student_id, { note: e.target.value })}
                                placeholder={entry.status === 'late' ? 'When they arrived' : entry.status === 'absent' ? 'Anything known' : '—'}
                                className={`h-8 min-w-0 rounded-sm bg-transparent px-2 text-[13px] leading-4 text-text-muted outline-none placeholder:text-text-muted focus:bg-white focus:text-text focus:outline focus:outline-1 focus:outline-primary ${
                                    full ? 'flex-1' : 'w-[220px] shrink-0'
                                }`}
                            />
                        )}
                        <span role="radiogroup" aria-label={`Mark ${row.name}`} className="flex shrink-0 gap-2">
                            {MARKS.map((mark) => (
                                <button
                                    key={mark.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={entry.status === mark.key}
                                    aria-label={mark.key}
                                    disabled={locked}
                                    onClick={() => set(row.student_id, { status: mark.key })}
                                    className={`flex h-[30px] w-10 items-center justify-center rounded-md border border-solid text-[12px] leading-4 font-semibold disabled:opacity-50 ${
                                        entry.status === mark.key ? mark.on : 'border-border bg-white text-text-muted enabled:hover:bg-surface'
                                    }`}
                                >
                                    {mark.letter}
                                </button>
                            ))}
                        </span>
                    </div>
                );
            })}
        </div>
    );

    const footer = (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3">
            <p className={`text-[12px] leading-4 ${errors.marks ? 'font-medium text-danger' : 'text-text-muted'}`}>
                {errors.marks ??
                    (locked
                        ? `This lesson has not started. Its register opens at ${lesson.time.slice(0, 5)}.`
                        : marked < roll.length
                          ? `${roll.length - marked} still to mark`
                          : 'Everyone is marked')}
            </p>
            <p className="font-mono text-[11px] leading-[14px] text-text-muted">P, A, L mark · ↑ ↓ move</p>
        </div>
    );

    if (full) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary-tint px-4 py-3">
                    <div className="flex flex-col gap-1">
                        <p className="font-mono text-[11px] leading-[14px] text-text-muted">
                            Fullscreen · {lesson.period} · {dateLabel} {lesson.time}
                        </p>
                        <p className="font-display text-[14px] leading-[18px] font-semibold text-text">
                            {lesson.class} · {lesson.subject}
                            {lesson.room ? ` · Room ${lesson.room}` : ''}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {counts}
                        <button
                            type="button"
                            onClick={() => setFull(false)}
                            className="flex h-9 items-center rounded-md border border-solid border-primary bg-white px-[14px] text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint"
                        >
                            Exit fullscreen · Esc
                        </button>
                        {saveButton}
                    </div>
                </div>
                <div className={`flex items-center gap-3 px-4 ${monoCaps} text-text-muted`}>
                    <span className="w-[30px] shrink-0" />
                    <span className="w-[240px] shrink-0">Student</span>
                    <span className="flex-1">Note for this lesson</span>
                    <span className="w-[136px] shrink-0">Mark</span>
                </div>
                {list}
                {footer}
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary-tint px-4 py-3">
                <div className="flex flex-col gap-1">
                    <p className="font-mono text-[11px] leading-[14px] text-text-muted">Register being marked</p>
                    <p className="font-display text-[14px] leading-[18px] font-semibold text-text">
                        {lesson.period} · {lesson.class} · {lesson.subject}
                        {lesson.room ? ` · Room ${lesson.room}` : ''} · {dateLabel}
                    </p>
                </div>
                {counts}
            </div>

            <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3">
                        <h2 className="font-display text-[15px] leading-5 font-semibold text-text">Roll · {lesson.class}</h2>
                        <div className="flex gap-2 print:hidden">
                            <button
                                type="button"
                                disabled={locked || roll.length === 0}
                                onClick={() =>
                                    remember(Object.fromEntries(roll.map((row) => [row.student_id, { ...entries[row.student_id], status: entries[row.student_id].status ?? 'present' }])))
                                }
                                className="flex h-8 items-center rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text hover:bg-surface disabled:opacity-40"
                            >
                                Mark the rest present
                            </button>
                            <button
                                type="button"
                                onClick={() => setFull(true)}
                                className="flex h-8 items-center rounded-md border border-solid border-primary bg-white px-3 text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint"
                            >
                                Fullscreen
                            </button>
                            {saveButton}
                        </div>
                    </div>
                    {roll.length === 0 ? (
                        <p className="rounded-lg border border-solid border-border p-4 text-[13px] leading-[19px] text-text-muted">No student is enrolled in {lesson.class}.</p>
                    ) : (
                        list
                    )}
                    {footer}
                </div>

                <aside className="flex shrink-0 flex-col gap-4 xl:w-[300px]">
                    <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className="text-[13px] leading-[18px] font-semibold text-text">How this register works</p>
                        <ul className="flex flex-col gap-2 text-[12px] leading-4 text-text-muted">
                            <li>· One register per lesson, so a class you teach twice today has two.</li>
                            <li>· An absence applies to this lesson only. It never marks the student absent for the day.</li>
                            <li>· The office sees it on the student’s record as soon as you save.</li>
                            <li>· You can change it until the end of today. After that the office handles corrections.</li>
                        </ul>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">Tired of scrolling?</p>
                        <p className="text-[12px] leading-4 text-text-muted">Fullscreen hides the sidebar and the lesson picker so the roll fills the screen.</p>
                        <button
                            type="button"
                            onClick={() => setFull(true)}
                            className="flex h-8 items-center justify-center rounded-md border border-solid border-primary text-[12px] leading-4 font-semibold text-primary hover:bg-primary-tint"
                        >
                            Open fullscreen · Esc to exit
                        </button>
                    </div>
                </aside>
            </div>
        </>
    );
}

function Attendance({ dateLabel, date, weekLabel, hasTimetable, lessons, lesson, roll }: AttendanceProps) {
    const current = lessons.find((option) => option.id === lesson) ?? null;

    return (
        <div className="flex flex-col gap-6">
            <Head title="Take attendance" />
            <div className="flex flex-col gap-[6px]">
                <p className={`${monoCaps} text-text-muted`}>
                    {dateLabel}
                    {weekLabel ? ` · ${weekLabel}` : ''}
                    {current ? ` · ${current.period} · ${current.time}` : ''}
                </p>
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">Take attendance</h1>
                <p className="text-[14px] leading-5 text-text-muted">
                    {current
                        ? `${current.class} · ${current.subject}${current.room ? ` · Room ${current.room}` : ''} · one register per lesson, not per class`
                        : 'One register per lesson, not per class'}
                </p>
            </div>

            {lessons.length === 0 || !current ? (
                <div className="flex flex-col gap-2 rounded-lg bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {hasTimetable ? 'You have no lessons today' : 'No timetable is published yet'}
                    </p>
                    <p className="max-w-[600px] text-[13px] leading-[19px] text-text">
                        {hasTimetable
                            ? 'A register appears here for each lesson on your timetable, on the day it is taught.'
                            : 'Registers follow the published timetable. They appear here once the school publishes it.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className={`${monoCaps} text-text-muted`}>Today’s lessons · {lessons.length}</p>
                            <p className="text-[12px] leading-4 text-text-muted">Switching lesson keeps each register separate</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {lessons.map((option) => {
                                const active = option.id === current.id;
                                const state = option.saved
                                    ? { label: 'Marked', dot: 'bg-success', text: 'text-success' }
                                    : active && option.started
                                      ? { label: 'Marking', dot: 'bg-warning', text: 'text-[#8A5A12]' }
                                      : option.started
                                        ? { label: 'Not marked', dot: 'bg-warning', text: 'text-[#8A5A12]' }
                                        : { label: 'Not started', dot: 'bg-border', text: 'text-text-muted' };

                                return (
                                    <Link
                                        key={option.id}
                                        href={show.url({ query: { lesson: option.id } })}
                                        preserveScroll
                                        aria-current={active ? 'true' : undefined}
                                        className={`flex flex-col gap-[6px] rounded-lg border-solid p-3 ${
                                            active ? 'border-2 border-primary bg-[#F3F7F5]' : 'border border-border bg-white hover:bg-surface'
                                        }`}
                                    >
                                        <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                            {option.period} · {option.time}
                                            {option.cover ? ' · cover' : ''}
                                        </span>
                                        <span className="truncate font-display text-[14px] leading-[18px] font-semibold text-text">
                                            {option.class} · {option.subject}
                                        </span>
                                        <span className="text-[12px] leading-4 text-text-muted">
                                            {option.room ? `Room ${option.room}` : 'No room'} ·{' '}
                                            {option.saved ? `${option.present} of ${option.students} present` : `${option.students} students`}
                                        </span>
                                        <span className={`flex items-center gap-[6px] text-[12px] leading-4 font-medium ${state.text}`}>
                                            <span className={`h-[6px] w-[6px] rounded-full ${state.dot}`} />
                                            {state.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    <Register key={current.id} lesson={current} roll={roll} date={date} dateLabel={dateLabel} />
                </>
            )}
        </div>
    );
}

export default withAppShell(Attendance);
