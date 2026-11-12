import { useState } from 'react';

export interface ClassProp {
    id: string;
    name: string;
    capacity: number;
    students: number;
    form_master_id: string | null;
    form_master: string | null;
    home_room_id: string | null;
    home_room: string | null;
}

export interface LevelProp {
    id: string;
    name: string;
    code: string | null;
    cycle: string;
    subsystem: string | null;
    uses_series: boolean;
    series_allowed: boolean;
    series: { stream: string; label: string }[];
    students: number;
    classes: ClassProp[];
}

export interface RoomProp {
    id: string;
    code: string;
    kind: string;
    capacity: number;
    home_of: string | null;
}

export interface LevelsProps {
    yearLabel: string | null;
    selected: string | null;
    levels: LevelProp[];
    staff: { id: string; name: string }[];
    rooms: RoomProp[];
}

export const NEW_ROOM = '__new';

export const smallLabelClass =
    'text-[12px] leading-4 font-medium text-text-muted';

export const smallInputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-[10px] text-[14px] leading-[18px] text-text outline-none focus:border-primary';

export function useStructureLevels({
    yearLabel,
    selected,
    levels,
    staff,
    rooms,
}: LevelsProps) {
    const [selectedId, setSelectedId] = useState(
        selected ?? levels[0]?.id ?? null,
    );
    const level =
        levels.find((option) => option.id === selectedId) ?? levels[0];
    const classCount = levels.reduce(
        (sum, option) => sum + option.classes.length,
        0,
    );
    const seriesLevels = levels.filter((option) => option.uses_series).length;

    return {
        yearLabel,
        levels,
        staff,
        rooms,
        selectedId,
        setSelectedId,
        level,
        classCount,
        seriesLevels,
    };
}

export type StructureLevels = ReturnType<typeof useStructureLevels>;
