import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    index,
    store,
} from '@/actions/App/Http/Controllers/TimetableChangeController';
import { type TimetablePhase } from '../ui';

export type Mode = 'cover' | 'swap' | 'room';

export interface Cover {
    id: string;
    name: string;
    teaches: boolean;
}

export interface ChangesProps {
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
    lessons?: {
        id: string;
        period: string | null;
        title: string;
        room: string | null;
        covers: Cover[];
    }[];
    classes?: { id: string; name: string }[];
    class?: string;
    slots?: {
        id: string;
        label: string;
        room_id: string | null;
        room: string | null;
    }[];
    rooms?: { id: string; code: string }[];
}

export const inputClass =
    'h-10 w-full rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary';

export const MODES: { key: Mode; label: string }[] = [
    { key: 'cover', label: 'Cover a lesson' },
    { key: 'swap', label: 'Swap two lessons' },
    { key: 'room', label: 'Change a room' },
];

export function useTimetableChanges(props: ChangesProps) {
    const { phase, live, mode, date, termStarts, termEnds, recent } = props;
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const lessons = props.lessons ?? [];
    const slots = props.slots ?? [];
    const [covers, setCovers] = useState<Record<string, string>>({});
    const [first, setFirst] = useState('');
    const [second, setSecond] = useState('');
    const [room, setRoom] = useState('');
    const [wholeWeek, setWholeWeek] = useState(false);
    const chosen = lessons.filter(
        (lesson) => (covers[lesson.id] ?? lesson.covers[0]?.id ?? '') !== '',
    );
    const error = Object.values(errors).find(Boolean);

    function visit(patch: Record<string, string>) {
        const query: Record<string, string> = { mode, date, ...patch };

        if (mode === 'cover' && props.teacher && !('teacher' in patch)) {
            query.teacher = props.teacher;
        }
        if (mode !== 'cover' && props.class && !('class' in patch)) {
            query.class = props.class;
        }

        router.get(
            index.url({ query }),
            {},
            { preserveScroll: true, preserveState: patch.mode === undefined },
        );
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
            router.post(
                store.url(),
                {
                    ...base,
                    whole_week: wholeWeek,
                    slot_id: first,
                    other_slot_id: second,
                },
                done,
            );
        } else {
            router.post(
                store.url(),
                {
                    ...base,
                    whole_week: wholeWeek,
                    slot_id: first,
                    room_id: room,
                },
                done,
            );
        }
    }

    const ready =
        mode === 'cover'
            ? chosen.length > 0
            : mode === 'swap'
              ? first !== '' && second !== '' && first !== second
              : first !== '' && room !== '';

    return {
        props,
        phase,
        live,
        mode,
        date,
        termStarts,
        termEnds,
        recent,
        lessons,
        slots,
        covers,
        setCovers,
        first,
        setFirst,
        second,
        setSecond,
        room,
        setRoom,
        wholeWeek,
        setWholeWeek,
        error,
        visit,
        submit,
        ready,
    };
}

export type TimetableChanges = ReturnType<typeof useTimetableChanges>;
