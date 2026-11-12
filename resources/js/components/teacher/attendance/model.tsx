import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { store } from '@/actions/App/Http/Controllers/AttendanceController';

export type Status = 'present' | 'absent' | 'late';

export interface Lesson {
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

export interface RollRow {
    student_id: string;
    name: string;
    status: Status | 'excused' | null;
    note: string | null;
}

export interface AttendanceProps {
    dateLabel: string;
    date: string;
    weekLabel: string | null;
    hasTimetable: boolean;
    lessons: Lesson[];
    lesson: string | null;
    roll: RollRow[];
}

export interface Entry {
    status: Status | null;
    note: string;
}

export const monoCaps =
    'font-mono text-[11px] leading-[14px] tracking-[0.08em] uppercase';
export const MARKS: {
    key: Status;
    letter: string;
    on: string;
    avatar: string;
}[] = [
    {
        key: 'present',
        letter: 'P',
        on: 'border-success bg-success text-white',
        avatar: 'bg-primary-tint text-primary',
    },
    {
        key: 'absent',
        letter: 'A',
        on: 'border-danger bg-danger text-white',
        avatar: 'bg-danger-tint text-danger',
    },
    {
        key: 'late',
        letter: 'L',
        on: 'border-warning bg-warning text-white',
        avatar: 'bg-warning-tint text-warning-text',
    },
];

export function initials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);

    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function fromRoll(roll: RollRow[]): Record<string, Entry> {
    return Object.fromEntries(
        roll.map((row) => [
            row.student_id,
            {
                status: row.status === 'excused' ? 'absent' : row.status,
                note: row.note ?? '',
            },
        ]),
    );
}

/**
 * The marks for one lesson's register, kept as a draft on this device
 * until saved, with keyboard marking.
 */
export function useRegister({
    lesson,
    roll,
    date,
    dateLabel,
}: {
    lesson: Lesson;
    roll: RollRow[];
    date: string;
    dateLabel: string;
}) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const draftKey = `ekol.register.${lesson.id}.${date}`;
    const [entries, setEntries] = useState<Record<string, Entry>>(() => {
        const saved = fromRoll(roll);

        if (lesson.saved) {
            return saved;
        }

        try {
            const draft = JSON.parse(
                window.localStorage.getItem(draftKey) ?? 'null',
            ) as Record<string, Entry> | null;

            return draft
                ? {
                      ...saved,
                      ...Object.fromEntries(
                          Object.entries(draft).filter(([id]) => id in saved),
                      ),
                  }
                : saved;
        } catch {
            return saved;
        }
    });
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [full, setFull] = useState(false);
    const [focus, setFocus] = useState(0);
    const rows = useRef<(HTMLDivElement | null)[]>([]);

    const tally = (status: Status) =>
        roll.filter((row) => entries[row.student_id]?.status === status).length;
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
            const typing =
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement;

            if (event.key === 'Escape' && full) {
                setFull(false);

                return;
            }

            if (
                typing ||
                locked ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey
            ) {
                return;
            }

            const row = roll[focus];
            const mark = MARKS.find(
                (option) =>
                    option.letter.toLowerCase() === event.key.toLowerCase(),
            );

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const next = Math.max(
                    0,
                    Math.min(
                        roll.length - 1,
                        focus + (event.key === 'ArrowDown' ? 1 : -1),
                    ),
                );
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

    return {
        lesson,
        roll,
        dateLabel,
        errors,
        entries,
        dirty,
        saving,
        full,
        setFull,
        focus,
        setFocus,
        rows,
        tally,
        marked,
        locked,
        remember,
        set,
        save,
    };
}

export type RegisterModel = ReturnType<typeof useRegister>;

/** Today's lessons and the one whose register is open. */
export function useAttendance(props: AttendanceProps) {
    const { lessons, lesson } = props;
    const current = lessons.find((option) => option.id === lesson) ?? null;

    return { ...props, current };
}

export type AttendanceModel = ReturnType<typeof useAttendance>;
