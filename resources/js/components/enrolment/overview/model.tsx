import { type EnrolmentProgress } from '../ui';

export interface LevelRow {
    id: string;
    name: string;
    classes: number;
    seats: number;
    expected: number;
    placed: number;
}

export interface OverviewProps {
    enrolment: EnrolmentProgress | null;
    currentLabel: string | null;
    startsOn?: string;
    applications?: {
        total: number;
        admitted: number;
        to_review: number;
        waitlist: number;
        declined: number;
    };
    continuing?: {
        total: number;
        promote: number;
        repeat: number;
        leaving: number;
        undecided: number;
        graduating: number;
    };
    levels?: LevelRow[];
    copyable?: number;
}

export const cardClass =
    'flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-solid border-border bg-surface p-5';

/** The overview once a new year is open and counted. */
export type OpenOverview = OverviewProps & {
    enrolment: NonNullable<OverviewProps['enrolment']>;
    applications: NonNullable<OverviewProps['applications']>;
    continuing: NonNullable<OverviewProps['continuing']>;
};

/** The new year's counts, the levels short of seats, and who is placed. */
export function useEnrolmentOverview({
    enrolment,
    currentLabel,
    startsOn,
    applications,
    continuing,
    levels = [],
    copyable = 0,
}: OpenOverview) {
    const short = levels.filter((level) => level.expected > level.seats);
    const placed = enrolment.expected - enrolment.unplaced;

    return {
        enrolment,
        currentLabel,
        startsOn,
        applications,
        continuing,
        levels,
        copyable,
        short,
        placed,
    };
}

export type EnrolmentOverview = ReturnType<typeof useEnrolmentOverview>;
