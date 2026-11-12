import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { t } from '../../../lib/i18n';
import { type AssessmentTabs, type PlanSummary, day } from '../ui';

export interface Paper {
    id: string;
    held_on: string;
    starts_at: string;
    hours: number;
    room_id: string | null;
    room: string | null;
    invigilator_ids: string[];
    invigilators: string[];
    clash: boolean;
}

export interface Row {
    subject_id: string;
    subject: string;
    paper: Paper | null;
}

export interface ScheduleProps {
    tabs: AssessmentTabs;
    plans: PlanSummary[];
    plan: PlanSummary | null;
    levels?: { id: string; name: string; missing: number; clash: boolean }[];
    level?: { id: string; name: string } | null;
    rows?: Row[];
    rooms?: { id: string; code: string; capacity: number }[];
    staff?: { id: string; name: string }[];
    clashes?: string[];
    unset?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const inputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-[10px] text-[13px] leading-4 text-text outline-none focus:border-primary';

export function weekday(iso: string): string {
    return `${t(WEEKDAYS[new Date(`${iso}T12:00:00`).getDay()])} ${day(iso)}`;
}

/** The exam whose papers are being set, once there is one. */
export type OpenPlan = NonNullable<ScheduleProps['plan']>;

/** The level whose papers are shown, once there is one. */
export type OpenLevel = NonNullable<ScheduleProps['level']>;

/**
 * The level's papers, the one being edited, and whether the schedule
 * is ready to publish.
 */
export function useSchedule({
    tabs,
    plans,
    plan,
    levels = [],
    level,
    rows = [],
    rooms = [],
    staff = [],
    clashes = [],
    unset = 0,
}: ScheduleProps & { plan: OpenPlan; level: OpenLevel }) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [editing, setEditing] = useState<string | null>(null);
    const current = rows.find((row) => row.subject_id === editing);
    const ready = unset === 0 && clashes.length === 0 && rows.length > 0;
    const locked = plan.state === 'published';

    return {
        tabs,
        plans,
        plan,
        levels,
        level,
        rows,
        rooms,
        staff,
        clashes,
        unset,
        errors,
        editing,
        setEditing,
        current,
        ready,
        locked,
    };
}

export type Schedule = ReturnType<typeof useSchedule>;
