import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { place } from '@/actions/App/Http/Controllers/StudentPlacementController';
import { type EnrolmentProgress } from '../ui';

export type Kind = 'promoted' | 'repeating' | 'new';

export interface PlacementProps {
    enrolment: EnrolmentProgress;
    levels: { id: string; name: string; over: boolean; waiting: number }[];
    level: {
        id: string;
        name: string;
        classes: number;
        seats: number;
        expected: number;
        placed: number;
    } | null;
    waiting: {
        id: string;
        name: string | null;
        kind: Kind;
        from: string | null;
    }[];
    classes: {
        id: string;
        name: string;
        capacity: number;
        placed: number;
        promoted: number;
        repeating: number;
        new: number;
    }[];
}

export type PlacementLevel = NonNullable<PlacementProps['level']>;

export const KINDS: { key: Kind; label: string }[] = [
    { key: 'promoted', label: 'Promoted' },
    { key: 'repeating', label: 'Repeating' },
    { key: 'new', label: 'New' },
];

export function useClassPlacement({
    enrolment,
    levels,
    level,
    waiting,
    classes,
}: PlacementProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [picked, setPicked] = useState<string[]>([]);
    const [kind, setKind] = useState<Kind | 'all'>('all');
    const [target, setTarget] = useState('');

    const selected = picked.filter((id) =>
        waiting.some((row) => row.id === id),
    );
    const shown = waiting.filter((row) => kind === 'all' || row.kind === kind);
    const withRoom = classes.filter(
        (option) => option.placed < option.capacity,
    );
    const targetId = classes.some((option) => option.id === target)
        ? target
        : (withRoom[0]?.id ?? classes[0]?.id ?? '');
    const targetClass = classes.find((option) => option.id === targetId);
    const allShown =
        shown.length > 0 && shown.every((row) => selected.includes(row.id));
    const freeSeats = classes.reduce(
        (sum, option) => sum + Math.max(0, option.capacity - option.placed),
        0,
    );

    function toggle(id: string) {
        setPicked(
            selected.includes(id)
                ? selected.filter((item) => item !== id)
                : [...selected, id],
        );
    }

    function toggleAll() {
        const ids = shown.map((row) => row.id);

        setPicked(
            allShown
                ? selected.filter((id) => !ids.includes(id))
                : [...new Set([...selected, ...ids])],
        );
    }

    function placeSelected() {
        router.post(
            place.url(),
            { class_id: targetId, enrolment_ids: selected },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setPicked([]),
            },
        );
    }

    return {
        enrolment,
        levels,
        level,
        waiting,
        classes,
        errors,
        selected,
        kind,
        setKind,
        setTarget,
        shown,
        targetId,
        targetClass,
        allShown,
        freeSeats,
        toggle,
        toggleAll,
        placeSelected,
    };
}

export type ClassPlacement = ReturnType<typeof useClassPlacement>;
