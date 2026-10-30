import { router } from '@inertiajs/react';
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { ordinalOf, t } from '../../lib/i18n';

export interface SchoolProp {
    id: string;
    name: string;
    motto: string | null;
    code: string;
    slug: string;
    logo_url: string | null;
    school_days: number;
    locale: string;
    day_starts_at: string;
    period_minutes: number;
}

export interface YearProp {
    id: string;
    label: string;
    status: string;
    starts_on: string;
    ends_on: string;
}

export interface TermProp {
    id?: string;
    label: string;
    sequence: number;
    starts_on: string;
    ends_on: string;
    week_count: number;
    is_current?: boolean;
    has_marks?: boolean;
}

export interface TemplateProp {
    seq: number;
    percent: number | string;
    due_on: string | null;
}

export interface PeriodProp {
    id?: string;
    label: string;
    starts_at?: string;
    ends_at?: string;
    is_break?: boolean;
    /** Its own length; without one a lesson takes the default length. */
    custom_minutes: number | null;
    _delete?: boolean;
}

export interface AssessmentProp {
    ids: string[];
    name: string;
    kind: string;
    window_starts_on: string | null;
    window_ends_on: string | null;
    window_status: 'unscheduled' | 'scheduled' | 'open' | 'closed';
}

export interface SetupProps {
    school: SchoolProp;
    years: YearProp[];
    year: YearProp | null;
    terms: TermProp[];
    templates: TemplateProp[];
    periods: PeriodProp[];
    assessments: AssessmentProp[];
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export const SaveContext = createContext<(state: SaveState) => void>(() => {});

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MONTHS = [
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

export const DAY_MS = 86_400_000;

export const dateInputClass =
    'h-7 rounded-sm border border-solid border-border bg-white px-1 font-mono text-[12px] text-text outline-none focus:border-primary';

export const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

export function shortDate(iso: string | null, padded = true): string {
    if (!iso) {
        return '—';
    }

    const [, month, day] = iso.split('-');

    return `${padded ? day : Number(day)} ${t(MONTHS[Number(month) - 1])}`;
}

export function longDate(iso: string): string {
    return `${shortDate(iso, false)} ${iso.slice(0, 4)}`;
}

export function addDays(iso: string, days: number): string {
    return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function weeksBetween(startsOn: string, endsOn: string): number {
    const days = (Date.parse(endsOn) - Date.parse(startsOn)) / DAY_MS + 1;

    return Math.max(1, Math.ceil(days / 7));
}

export function ordinal(n: number): string {
    return ordinalOf(n);
}

/**
 * Debounced per-zone autosave. After each successful save the zone's
 * local state is re-read from the server props, so rows created by
 * that save carry their ids into the next one.
 */
export function useAutosave<T>(
    url: string,
    initial: T,
    fromProps: (props: SetupProps) => T,
    serialize: (data: T) => unknown = (data) => data,
) {
    const report = useContext(SaveContext);
    const [data, setData] = useState<T>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function send(next: T) {
        timer.current = null;
        router.patch(url, serialize(next) as never, {
            async: true,
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                setErrors({});
                report('saved');
                if (!timer.current) {
                    setData(fromProps(page.props as unknown as SetupProps));
                }
            },
            onError: (failed) => {
                setErrors(failed);
                report('error');
            },
        });
    }

    function hold(next: T) {
        setData(next);
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }

    function save(next: T) {
        hold(next);
        report('saving');
        timer.current = setTimeout(() => send(next), 800);
    }

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    return { data, save, hold, error: Object.values(errors)[0] };
}

export function Zone({
    title,
    desc,
    children,
}: {
    title: string;
    desc: string;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4 border-b border-solid border-border pb-6 last:border-b-0 lg:flex-row lg:gap-10">
            <div className="flex shrink-0 flex-col gap-1 lg:w-[220px]">
                <h2 className="text-[14px] leading-[18px] font-semibold text-text">
                    {title}
                </h2>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {desc}
                </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
                {children}
            </div>
        </section>
    );
}

export function ZoneError({ message }: { message?: string | null }) {
    if (!message) {
        return null;
    }

    return (
        <p role="alert" className="text-[13px] leading-4 text-danger">
            {message}
        </p>
    );
}
