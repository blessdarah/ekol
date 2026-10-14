import { Head, Link } from '@inertiajs/react';
import { show } from '@/actions/App/Http/Controllers/TeacherTimetableController';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Cell {
    id: string;
    class: string;
    subject: string;
    room: string | null;
    note: string | null;
    tone: 'lesson' | 'changed' | 'away' | 'cover';
}

interface TimetableProps {
    termLabel: string | null;
    yearLabel?: string | null;
    week: {
        number: number;
        of: number;
        start: string;
        label: string;
        previous: string | null;
        next: string | null;
        isCurrent: boolean;
    } | null;
    version?: { number: number; published: string | null };
    summary?: {
        subjects: number;
        classes: number;
        rooms: number;
        periods: number;
        free: number;
    };
    days?: { index: number; short: string; date: string; today: boolean }[];
    periods?: { id: string; label: string; time: string; is_break: boolean }[];
    cells?: Record<string, Cell[]>;
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
const monoCaps =
    'font-mono text-[11px] leading-[14px] tracking-[0.08em] uppercase';
const buttonClass =
    'flex h-9 items-center rounded-md border border-solid border-border px-[14px] text-[14px] leading-[18px] font-medium text-text hover:bg-surface';

const TONES: Record<Cell['tone'], string> = {
    lesson: 'border-l-[3px] border-solid border-primary bg-primary-tint',
    changed: 'border-l-[3px] border-solid border-warning bg-warning-tint',
    cover: 'border-l-[3px] border-solid border-science bg-science-tint',
    away: 'border border-dashed border-border bg-surface',
};

function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? t(one) : t(many)}`;
}

function shortDay(iso: string | null): string {
    if (!iso) {
        return '';
    }

    const [, month, date] = iso.split('-');

    return `${Number(date)} ${t(MONTHS[Number(month) - 1])}`;
}

function Timetable({
    termLabel,
    yearLabel,
    week,
    version,
    summary,
    days = [],
    periods = [],
    cells = {},
}: TimetableProps) {
    if (!week || !summary || !version) {
        return (
            <div className="flex flex-col gap-6">
                <Head title={t('My timetable')} />
                <div className="flex flex-col gap-[6px]">
                    <p className={`${monoCaps} text-text-muted`}>
                        {termLabel ?? t('No active term')}
                    </p>
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {t('My timetable')}
                    </h1>
                </div>
                <div className="flex flex-col gap-2 rounded-lg bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {termLabel
                            ? t('No timetable is published yet')
                            : t('No term is active')}
                    </p>
                    <p className="max-w-[600px] text-[13px] leading-[19px] text-text">
                        {termLabel
                            ? t(
                                  'Your week appears here once the school publishes the :term_label timetable.',
                                  { term_label: termLabel },
                              )
                            : t(
                                  'A timetable belongs to a term. Your week appears here once the school makes a term active.',
                              )}
                    </p>
                </div>
            </div>
        );
    }

    const changed = Object.values(cells).some((list) =>
        list.some((cell) => cell.tone !== 'lesson'),
    );

    return (
        <div className="flex flex-col gap-6">
            <Head title={t('My timetable')} />
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <p className={`${monoCaps} text-text-muted`}>
                        {termLabel}
                        {yearLabel ? ` · ${yearLabel}` : ''} {t('· Week')}{' '}
                        {week.number} {t('of')} {week.of}
                    </p>
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {t('My timetable')}
                    </h1>
                    <p className="text-[14px] leading-5 text-text-muted">
                        {plural(summary.subjects, 'subject')} ·{' '}
                        {plural(summary.classes, 'class', 'classes')} ·{' '}
                        {plural(summary.rooms, 'room')} ·{' '}
                        {plural(summary.periods, 'period')} {t('a week ·')}{' '}
                        {plural(summary.free, 'free period')}
                    </p>
                </div>
                <div className="flex gap-3 print:hidden">
                    <div className="flex">
                        {week.previous ? (
                            <Link
                                href={show.url({
                                    query: { week: week.previous },
                                })}
                                preserveScroll
                                aria-label={t('Previous week')}
                                className="flex h-9 w-9 items-center justify-center rounded-l-md border border-solid border-border text-[14px] text-text hover:bg-surface"
                            >
                                ←
                            </Link>
                        ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-l-md border border-solid border-border text-[14px] text-text-muted opacity-40">
                                ←
                            </span>
                        )}
                        <Link
                            href={show.url()}
                            preserveScroll
                            aria-current={week.isCurrent ? 'true' : undefined}
                            className={`-mx-px flex h-9 items-center border border-solid px-[14px] text-[14px] leading-[18px] font-medium ${
                                week.isCurrent
                                    ? 'z-10 border-primary bg-primary-tint text-primary'
                                    : 'border-border text-text hover:bg-surface'
                            }`}
                        >
                            {t('This week')}
                        </Link>
                        {week.next ? (
                            <Link
                                href={show.url({ query: { week: week.next } })}
                                preserveScroll
                                aria-label={t('Next week')}
                                className="flex h-9 w-9 items-center justify-center rounded-r-md border border-solid border-border text-[14px] text-text hover:bg-surface"
                            >
                                →
                            </Link>
                        ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-r-md border border-solid border-border text-[14px] text-text-muted opacity-40">
                                →
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className={buttonClass}
                    >
                        {t('Print')}
                    </button>
                </div>
            </div>

            <section className="flex flex-col overflow-clip rounded-lg border border-solid border-border bg-white">
                <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-solid border-border bg-surface px-4 py-[14px]">
                    <h2 className="font-display text-[14px] leading-[18px] font-semibold text-text">
                        {t('Week :number · :label', {
                            number: week.number,
                            label: week.label,
                        })}
                    </h2>
                    <p className="font-mono text-[12px] leading-4 text-text-muted">
                        {t('Published version')} {version.number}
                        {version.published
                            ? ` · ${shortDay(version.published)}`
                            : ''}
                        {t('. Only the office can move a lesson')}
                    </p>
                </header>

                <div className="overflow-x-auto p-4">
                    <div className="flex min-w-[640px] flex-col gap-1">
                        <div className="flex h-5 shrink-0 items-center gap-1 pl-11">
                            {days.map((day) => (
                                <div
                                    key={day.index}
                                    className="flex flex-1 justify-center"
                                >
                                    {day.today ? (
                                        <span className="rounded-full bg-primary-tint px-[10px] py-[2px] text-[12px] leading-4 font-semibold text-primary">
                                            {t(':short · today', {
                                                short: day.short,
                                            })}
                                        </span>
                                    ) : (
                                        <span className="text-[12px] leading-4 font-semibold text-text-muted">
                                            {day.short}{' '}
                                            {Number(day.date.slice(8))}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        {periods.map((period) =>
                            period.is_break ? (
                                <div
                                    key={period.id}
                                    className="flex h-5 shrink-0 items-center pl-11"
                                >
                                    <span className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                                        {t(period.label)}
                                    </span>
                                </div>
                            ) : (
                                <div key={period.id} className="flex gap-1">
                                    <span
                                        title={period.time}
                                        className="w-10 shrink-0 truncate font-mono text-[11px] leading-[48px] text-text-muted"
                                    >
                                        {t(period.label)}
                                    </span>
                                    {days.map((day) => {
                                        const here =
                                            cells[
                                                `${day.index}|${period.id}`
                                            ] ?? [];

                                        if (here.length === 0) {
                                            return (
                                                <div
                                                    key={day.index}
                                                    className="flex h-12 min-w-0 flex-1 items-center rounded-[6px] bg-surface px-2 text-[12px] leading-4 text-text-muted"
                                                >
                                                    {t('Free')}
                                                </div>
                                            );
                                        }

                                        if (here.length > 1) {
                                            return (
                                                <div
                                                    key={day.index}
                                                    className="flex h-12 min-w-0 flex-1 flex-col justify-center overflow-clip rounded-[6px] border-2 border-solid border-danger bg-danger-tint px-2"
                                                >
                                                    <span className="truncate text-[12px] leading-[17px] font-semibold text-danger">
                                                        {t('Clash ·')}{' '}
                                                        {here
                                                            .map(
                                                                (cell) =>
                                                                    cell.class,
                                                            )
                                                            .join(' + ')}
                                                    </span>
                                                    <span className="truncate text-[11px] leading-[14px] text-danger">
                                                        {t('Tell the office')}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        const cell = here[0];

                                        return (
                                            <div
                                                key={day.index}
                                                title={`${cell.class} · ${cell.subject}${cell.room ? ` · ${cell.room}` : ''} · ${period.time}`}
                                                className={`flex h-12 min-w-0 flex-1 flex-col justify-center rounded-[6px] px-2 ${TONES[cell.tone]}`}
                                            >
                                                <span
                                                    className={`truncate text-[12px] leading-[17px] font-semibold ${cell.tone === 'away' ? 'text-text-muted line-through' : 'text-text'}`}
                                                >
                                                    {cell.class} ·{' '}
                                                    {cell.subject}
                                                </span>
                                                <span
                                                    className={`truncate text-[12px] leading-[17px] ${cell.note ? 'font-medium' : 'font-semibold'} ${cell.tone === 'away' ? 'text-text-muted' : 'text-text'}`}
                                                >
                                                    {cell.note
                                                        ? `${cell.room ?? t('No room')} · ${cell.note}`
                                                        : (cell.room ??
                                                          t('No room'))}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ),
                        )}
                    </div>
                </div>

                <p className="border-t border-solid border-border px-4 py-3 text-[13px] leading-[18px] text-text-muted">
                    {t(
                        'Each box is the class, the subject and the room. Free means no lesson.',
                    )}
                    {changed
                        ? t(
                              ' Amber is a lesson the office moved or re-roomed this week, blue is a lesson you cover, and a struck-out lesson is covered for you.',
                          )
                        : t(
                              ' A cover, a swap or a room change for the week shows here when the office logs one.',
                          )}
                </p>
            </section>
        </div>
    );
}

export default withAppShell(Timetable);
