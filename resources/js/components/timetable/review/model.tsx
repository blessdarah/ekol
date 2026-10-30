import { router, usePage } from '@inertiajs/react';
import { type DragEvent, useState } from 'react';
import {
    show as review,
    store as placeLesson,
    update as updateSlot,
} from '@/actions/App/Http/Controllers/TimetableReviewController';
import { type TimetablePhase } from '../ui';
import { t } from '../../../lib/i18n';

export type View = 'class' | 'teacher' | 'room';

export interface Cell {
    id: string;
    title: string;
    sub: string;
    tone: 'primary' | 'science';
    clash: boolean;
    locked: boolean;
}

export interface Move {
    weekday: number;
    period_id: string;
    label: string;
}

export interface SlotPanel {
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

export interface LessonPanel {
    type: 'lesson';
    id: string;
    title: string;
    count: number;
    why: string | null;
    teacher: string | null;
    moves: Move[];
}

export interface PickerRow {
    id: string;
    name: string;
    meta: string | null;
    note: string | null;
    issues: number;
    clash: boolean;
    title: string;
    detail: string;
}

export interface ReviewProps {
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

export const VIEWS: { key: View; label: string; noun: string }[] = [
    { key: 'class', label: 'By class', noun: 'class' },
    { key: 'teacher', label: 'By teacher', noun: 'teacher' },
    { key: 'room', label: 'By room', noun: 'room' },
];

export const visitOptions = {
    preserveScroll: true,
    preserveState: true,
} as const;

export function Moves({
    title,
    moves,
    empty,
    onPick,
}: {
    title: string;
    moves: Move[];
    empty: string;
    onPick: (move: Move) => void;
}) {
    return (
        <div className="flex flex-col gap-[6px]">
            <p className="text-[13px] leading-4 font-medium text-text">
                {title}
            </p>
            {moves.length === 0 ? (
                <p className="text-[13px] leading-[18px] text-text-muted">
                    {empty}
                </p>
            ) : (
                moves.map((move) => (
                    <button
                        key={`${move.weekday}-${move.period_id}`}
                        type="button"
                        onClick={() => onPick(move)}
                        className="flex h-9 shrink-0 items-center justify-between rounded-md border border-solid border-border px-[10px] hover:bg-surface"
                    >
                        <span className="text-[13px] leading-4 text-text">
                            {t(move.label)}
                        </span>
                        <span className="text-[12px] leading-4 text-success">
                            {t('All free')}
                        </span>
                    </button>
                ))
            )}
        </div>
    );
}
export function useTimetableReview({
    phase,
    version,
    view,
    picker,
    current,
    days,
    periods,
    cells,
    closed,
    unplaced,
    clashes,
    selected,
}: ReviewProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;

    const [search, setSearch] = useState('');

    const [dragging, setDragging] = useState(false);

    const readOnly = version.live;

    const noun = VIEWS.find((option) => option.key === view)?.noun ?? 'class';

    const listed = picker.filter((row) =>
        row.name.toLowerCase().includes(search.trim().toLowerCase()),
    );

    function url(patch: {
        view?: View;
        id?: string;
        slot?: string;
        lesson?: string;
    }): string {
        const query: Record<string, string> = { view: patch.view ?? view };
        const id =
            'id' in patch ? patch.id : patch.view ? undefined : current?.id;

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

    function change(
        slotId: string,
        data: Record<string, string | number | boolean | null>,
    ) {
        router.patch(updateSlot.url(slotId), data, visitOptions);
    }

    function drop(token: string, weekday: number, periodId: string) {
        if (token.startsWith('lesson:')) {
            router.post(
                placeLesson.url(),
                { lesson_id: token.slice(7), weekday, period_id: periodId },
                visitOptions,
            );
        } else if (token) {
            change(token, { weekday, period_id: periodId });
        }
    }

    function onDrop(event: DragEvent, weekday: number, periodId: string) {
        event.preventDefault();
        setDragging(false);
        drop(event.dataTransfer.getData('text/plain'), weekday, periodId);
    }

    const active = selected
        ? selected.type === 'slot'
            ? selected.id
            : `lesson:${selected.id}`
        : '';

    const offered = new Set(
        (selected?.moves ?? []).map(
            (move) => `${move.weekday}|${move.period_id}`,
        ),
    );
    return {
        phase,
        version,
        view,
        picker,
        current,
        days,
        periods,
        cells,
        closed,
        unplaced,
        clashes,
        selected,
        errors,
        search,
        setSearch,
        dragging,
        setDragging,
        readOnly,
        noun,
        listed,
        url,
        select,
        change,
        drop,
        onDrop,
        active,
        offered,
    };
}
export type TimetableReviewModel = ReturnType<typeof useTimetableReview>;
