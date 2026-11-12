import { t } from '../../../lib/i18n';

export interface Lesson {
    id: string;
    starts_at: string;
    ends_at: string;
    class: string;
    subject: string;
    room: string | null;
    students: number;
    state: 'done' | 'now' | 'next' | 'later';
    marked: boolean;
    in_minutes: number | null;
}

export interface SheetRow {
    id: string;
    plan: string;
    class: string;
    subject: string;
    students: number;
    entered: number;
    open: boolean;
    submitted: boolean;
    opens_on: string | null;
    closes_on: string | null;
}

export interface TodayProps {
    date: string;
    greeting: string;
    name: string;
    hasTimetable: boolean;
    isSchoolDay: boolean;
    lessons: Lesson[];
    unmarked: number;
    next: Lesson | null;
    sheets: SheetRow[];
    openSheets: number;
    closesOn: string | null;
}

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
export const monoCaps =
    'font-mono text-[11px] leading-[14px] tracking-[0.08em] uppercase';
export const outlineButton =
    'flex h-[34px] shrink-0 items-center rounded-md border border-solid border-border px-[14px] text-[13px] leading-4 font-medium text-text hover:bg-surface';

export function day(iso: string | null): string {
    if (!iso) {
        return 'soon';
    }

    const [, month, date] = iso.split('-');

    return `${Number(date)} ${t(MONTHS[Number(month) - 1])}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? t(one) : t(many)}`;
}

export function wait(minutes: number): string {
    if (minutes < 60) {
        return `In ${plural(minutes, 'minute')}`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return t('In :hour:rest', {
        hour: plural(hours, 'hour'),
        rest: rest > 0 ? ` ${rest} min` : '',
    });
}

export const LESSON_PILLS: Record<
    Lesson['state'],
    { label: string; pill: string }
> = {
    done: { label: 'Done', pill: 'bg-surface text-text-muted' },
    now: { label: 'Now', pill: 'bg-white text-primary' },
    next: { label: 'Up next', pill: 'bg-white text-primary' },
    later: { label: 'Later', pill: 'bg-surface text-text-muted' },
};

/** The teacher's day in one line, and the mark sheets still to open. */
export function useToday(props: TodayProps) {
    const { hasTimetable, lessons, unmarked, sheets, openSheets } = props;
    const summary = [
        hasTimetable
            ? plural(lessons.length, 'lesson') + ' today'
            : 'no timetable published yet',
        ...(unmarked > 0
            ? [t(':unmarked attendance still to mark', { unmarked })]
            : []),
        plural(openSheets, 'mark sheet') + ' open',
    ].join(' · ');
    const upcoming = sheets.filter((sheet) => !sheet.open);

    return { ...props, summary, upcoming };
}

export type TodayModel = ReturnType<typeof useToday>;
