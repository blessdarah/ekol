import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    store,
    update,
} from '@/actions/App/Http/Controllers/TimetableRoomController';
import { WEEKDAYS } from '../ui';
import { t } from '../../../lib/i18n';

export interface Block {
    weekday: number;
    period_id: string;
    reason: string | null;
}

export interface RoomRow {
    id: string;
    code: string;
    kind: string;
    capacity: number;
    home: string | null;
    booked: number;
    unavailable: Block[];
}

export interface RoomsProps {
    booking: 'draft' | 'live' | null;
    slotsAWeek: number;
    schoolDays: number;
    periods: { id: string; label: string }[];
    kinds: { value: string; label: string; special: boolean }[];
    subjects: { id: string; name: string; room_kind: string | null }[];
    rooms: RoomRow[];
}

export type RoomPanelProps = Omit<RoomsProps, 'rooms' | 'booking'> & {
    room: RoomRow | null;
};

export const inputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-[10px] text-[14px] leading-[18px] text-text outline-none focus:border-primary';

export const GROUPS = [
    { key: 'all', label: 'All', test: () => true },
    {
        key: 'classroom',
        label: 'Classrooms',
        test: (kind: string) => kind === 'classroom',
    },
    {
        key: 'special',
        label: 'Laboratories',
        test: (kind: string) => kind === 'laboratory' || kind === 'computer',
    },
    {
        key: 'other',
        label: 'Halls and other',
        test: (kind: string) =>
            !['classroom', 'laboratory', 'computer'].includes(kind),
    },
];

/** Which rooms show, and which one is open in the panel. */
export function useRooms({ rooms, booking, ...shared }: RoomsProps) {
    const params = new URLSearchParams(usePage().url.split('?')[1] ?? '');
    const [group, setGroup] = useState('all');
    const adding = params.get('new') === '1';
    const selected = adding
        ? null
        : (rooms.find((room) => room.id === params.get('room')) ??
          rooms[0] ??
          null);
    const shown = rooms.filter((room) =>
        GROUPS.find((option) => option.key === group)?.test(room.kind),
    );

    return {
        rooms,
        booking,
        shared,
        group,
        setGroup,
        adding,
        selected,
        shown,
    };
}

export type RoomsModel = ReturnType<typeof useRooms>;

/** One room's edits as drafted so far, and saving them. */
export function useRoomPanel({
    room,
    slotsAWeek,
    schoolDays,
    periods,
    kinds,
    subjects,
}: RoomPanelProps) {
    const form = useForm({
        code: room?.code ?? '',
        kind: room?.kind ?? 'classroom',
        capacity: String(room?.capacity ?? 45),
        unavailable: room?.unavailable ?? ([] as Block[]),
        subject_ids: subjects
            .filter((subject) => room && subject.room_kind === room.kind)
            .map((subject) => subject.id),
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const days = WEEKDAYS.map((name) => t(name))
        .map((label, index) => ({ label, index }))
        .filter(({ index }) => (schoolDays & (1 << index)) !== 0);
    const [draft, setDraft] = useState<{
        open: boolean;
        weekday: number;
        period_id: string;
        reason: string;
    }>({
        open: false,
        weekday: days[0]?.index ?? 0,
        period_id: periods[0]?.id ?? '',
        reason: '',
    });
    const kind = kinds.find((option) => option.value === data.kind);
    const share = room && slotsAWeek > 0 ? room.booked / slotsAWeek : 0;
    const left = subjects.filter(
        (subject) => !data.subject_ids.includes(subject.id),
    );

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

        const exists = data.unavailable.some(
            (block) =>
                block.weekday === draft.weekday &&
                block.period_id === draft.period_id,
        );

        if (!exists) {
            setData('unavailable', [
                ...data.unavailable,
                {
                    weekday: draft.weekday,
                    period_id: draft.period_id,
                    reason: draft.reason.trim() || null,
                },
            ]);
        }

        setDraft({ ...draft, open: false, reason: '' });
    }

    return {
        room,
        periods,
        kinds,
        subjects,
        data,
        setData,
        processing,
        errors,
        days,
        draft,
        setDraft,
        kind,
        share,
        left,
        submit,
        addBlock,
    };
}

export type RoomPanelModel = ReturnType<typeof useRoomPanel>;
