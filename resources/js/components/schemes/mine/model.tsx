import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    add,
    place,
} from '@/actions/App/Http/Controllers/TeacherSchemeController';
import { STATUSES, type Item, type Week } from '../ui';

export interface MineProps {
    term: { label: string; week: number | null; weeks: number } | null;
    opening: {
        due_on: string;
        approval: string;
        closed: boolean;
        free_changes: boolean;
    } | null;
    schemes: {
        id: string;
        subject: string | null;
        class: string | null;
        status: string;
    }[];
    scheme: {
        id: string;
        subject: string | null;
        class: string | null;
        status: string;
        weekly_periods: number;
        weeks: Week[];
        items: Item[];
        last_note: {
            action: string;
            by: string | null;
            on: string;
            note: string;
        } | null;
    } | null;
    toApprove: number;
}

export const smallSelect =
    'h-7 rounded-md border border-solid border-border bg-white px-1 text-[12px] text-text outline-none focus:border-primary';

/** The scheme being planned, once the term, opening and scheme all exist. */
export type OpenScheme = MineProps & {
    term: NonNullable<MineProps['term']>;
    opening: NonNullable<MineProps['opening']>;
    scheme: NonNullable<MineProps['scheme']>;
};

/**
 * The teacher's scheme for the term: where each sub-topic sits, what the
 * plan still lacks, and placing, adding or ticking sub-topics.
 */
export function useMyScheme({
    term,
    opening,
    schemes,
    scheme,
    toApprove,
}: OpenScheme) {
    const [open, setOpen] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({
        topic: '',
        name: '',
        periods: 1,
        week: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [changing, setChanging] = useState(false);

    const editable =
        !opening.closed &&
        ['not_started', 'draft', 'changes_requested', 'approved'].includes(
            scheme.status,
        );
    const approved = scheme.status === 'approved';
    const planning = !approved || changing;
    const unplaced = scheme.items.filter((item) => item.week === null);
    const topics = [...new Set(unplaced.map((item) => item.topic))];
    const freeWeeks = new Set(
        scheme.weeks.filter((week) => week.free).map((week) => week.week),
    );
    const periodsIn = (week: number) =>
        scheme.items
            .filter((item) => item.week === week)
            .reduce((sum, item) => sum + item.periods, 0);
    const overfull = scheme.weeks.filter(
        (week) =>
            scheme.weekly_periods > 0 &&
            periodsIn(week.week) > scheme.weekly_periods,
    );
    const inFree = scheme.items.filter(
        (item) => item.week !== null && freeWeeks.has(item.week),
    );
    const placed = scheme.items.length - unplaced.length;
    const style = STATUSES[scheme.status] ?? STATUSES.draft;

    function move(item: Item, week: number | null) {
        setOpen(null);
        router.patch(
            place.url({ scheme: scheme.id, item: item.id }),
            { week },
            { preserveScroll: true, preserveState: true },
        );
    }

    function addOwn() {
        router.post(
            add.url(scheme.id),
            { ...draft, week: draft.week === '' ? null : Number(draft.week) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setAdding(false);
                    setDraft({ topic: '', name: '', periods: 1, week: '' });
                    setErrors({});
                },
                onError: (failed) => setErrors(failed),
            },
        );
    }

    return {
        term,
        opening,
        schemes,
        scheme,
        toApprove,
        open,
        setOpen,
        adding,
        setAdding,
        draft,
        setDraft,
        errors,
        setErrors,
        changing,
        setChanging,
        editable,
        approved,
        planning,
        unplaced,
        topics,
        periodsIn,
        overfull,
        inFree,
        placed,
        style,
        move,
        addOwn,
    };
}

export type MySchemeModel = ReturnType<typeof useMyScheme>;
