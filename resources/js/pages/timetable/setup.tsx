import { Head, Link } from '@inertiajs/react';
import { show as schoolSetup } from '@/actions/App/Http/Controllers/SetupController';
import {
    index as staffRoster,
    show as staffRecord,
} from '@/actions/App/Http/Controllers/StaffController';
import { checks } from '@/actions/App/Http/Controllers/TimetableController';
import { index as roomsIndex } from '@/actions/App/Http/Controllers/TimetableRoomController';
import { capsLabelClass } from '../../components/structure/ui';
import {
    TimetableHeader,
    type TimetablePhase,
    WEEKDAYS,
    amberText,
    linkClass,
    primaryActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface SetupProps {
    phase: TimetablePhase;
    schoolDays: number;
    periods: {
        id: string;
        label: string;
        starts_at: string;
        ends_at: string;
        is_break: boolean;
    }[];
    rooms: {
        total: number;
        rows: {
            id: string;
            code: string;
            kind: string;
            capacity: number;
            home: string | null;
            subjects: string[];
        }[];
    };
    practicals: string[];
    teachers: {
        id: string;
        name: string;
        days: number;
        part_time: boolean;
        periods: number;
        max: number | null;
    }[];
}

function minutes(from: string, to: string): number {
    const [fromHour, fromMinute] = from.split(':').map(Number);
    const [toHour, toMinute] = to.split(':').map(Number);

    return toHour * 60 + toMinute - (fromHour * 60 + fromMinute);
}

/** "Mon – Fri" for a run of days, "Mon, Wed, Fri" otherwise. */
function dayRange(mask: number): string {
    const on = WEEKDAYS.map((name) => t(name))
        .map((_, index) => index)
        .filter((index) => (mask & (1 << index)) !== 0);

    if (on.length === 0) {
        return t('No days');
    }

    const run = on.every(
        (day, position) => position === 0 || day === on[position - 1] + 1,
    );

    return run && on.length > 2
        ? `${t(WEEKDAYS[on[0]])} – ${t(WEEKDAYS[on[on.length - 1]])}`
        : on.map((day) => t(WEEKDAYS[day])).join(', ');
}

function Setup({
    phase,
    schoolDays,
    periods,
    rooms,
    practicals,
    teachers,
}: SetupProps) {
    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Timetable setup')} />
            <TimetableHeader
                page="setup"
                phase={phase}
                trail={[{ label: t('Setup') }]}
                title={t('Setup')}
                meta={t(
                    'The rooms and who teaches when. The school day itself comes from School Setup.',
                )}
                action={
                    <Link href={checks.url()} className={primaryActionClass}>
                        {t('Save and check inputs →')}
                    </Link>
                }
            />

            <div className="flex flex-col gap-7 lg:flex-row">
                <section className="flex shrink-0 flex-col gap-3 lg:w-[430px]">
                    <p className={capsLabelClass}>
                        {t('School day (from School Setup)')}
                    </p>
                    <div className="flex flex-wrap gap-[6px]">
                        {WEEKDAYS.map((name) => t(name)).map((day, index) =>
                            (schoolDays & (1 << index)) !== 0 ? (
                                <span
                                    key={day}
                                    className="flex h-[30px] items-center rounded-md border border-solid border-primary bg-primary-tint px-[14px] text-[13px] leading-4 font-semibold text-primary"
                                >
                                    {day}
                                </span>
                            ) : null,
                        )}
                    </div>
                    {periods.length === 0 ? (
                        <p className="rounded-md border border-solid border-warning bg-warning-tint p-4 text-[13px] leading-[19px] text-text">
                            {t(
                                'The school day has no periods yet. Lessons need periods to be placed in.',
                            )}
                        </p>
                    ) : (
                        <ul className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                            {periods.map((period, position) => (
                                <li
                                    key={period.id}
                                    className={`flex items-center gap-4 border-b border-solid border-border px-[14px] last:border-b-0 ${
                                        period.is_break
                                            ? 'h-[34px] bg-surface'
                                            : `h-10 ${position % 2 === 1 ? 'bg-row-alt' : ''}`
                                    }`}
                                >
                                    <span
                                        className={`w-[46px] shrink-0 truncate ${
                                            period.is_break
                                                ? 'text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted uppercase'
                                                : 'text-[14px] leading-[18px] font-semibold text-text'
                                        }`}
                                    >
                                        {t(period.label)}
                                    </span>
                                    <span
                                        className={`flex-1 font-mono text-[13px] leading-4 ${period.is_break ? 'text-text-muted' : 'text-text'}`}
                                    >
                                        {period.starts_at} – {period.ends_at}
                                    </span>
                                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                                        {t(':ends_at min', {
                                            ends_at: minutes(
                                                period.starts_at,
                                                period.ends_at,
                                            ),
                                        })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Days and periods are set once for the whole school, in School Setup under School day. Change them there.',
                        )}{' '}
                        <Link
                            href={schoolSetup.url()}
                            className="font-medium text-primary hover:underline"
                        >
                            {t('Edit in School Setup →')}
                        </Link>
                    </p>
                </section>

                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <section className="flex flex-col gap-3">
                        <div className="flex items-baseline justify-between">
                            <p className={capsLabelClass}>
                                {t('Rooms · :total', { total: rooms.total })}
                            </p>
                            <Link href={roomsIndex.url()} className={linkClass}>
                                {t('Manage rooms →')}
                            </Link>
                        </div>
                        {rooms.total === 0 ? (
                            <p className="rounded-md border border-solid border-warning bg-warning-tint p-4 text-[13px] leading-[19px] text-text">
                                {t(
                                    'The school has no rooms yet. Add the classrooms and laboratories lessons are held in.',
                                )}
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                <div className="flex min-w-[480px] flex-col">
                                    <div
                                        className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}
                                    >
                                        <span className="w-[86px] shrink-0">
                                            {t('Room')}
                                        </span>
                                        <span className="w-[104px] shrink-0">
                                            {t('Type')}
                                        </span>
                                        <span className="w-[58px] shrink-0 text-right">
                                            {t('Seats')}
                                        </span>
                                        <span className="flex-1">
                                            {t('Home class')}
                                        </span>
                                    </div>
                                    {rooms.rows.map((room, position) => (
                                        <Link
                                            key={room.id}
                                            href={roomsIndex.url({
                                                query: { room: room.id },
                                            })}
                                            className={`flex h-9 shrink-0 items-center gap-4 border-b border-solid border-border px-[14px] last:border-b-0 hover:bg-surface ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                        >
                                            <span className="w-[86px] shrink-0 truncate text-[14px] leading-[18px] font-semibold text-text">
                                                {room.code}
                                            </span>
                                            <span className="w-[104px] shrink-0 truncate text-[13px] leading-4 text-text">
                                                {room.kind}
                                            </span>
                                            <span className="w-[58px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                                {room.capacity}
                                            </span>
                                            <span
                                                className={`min-w-0 flex-1 truncate text-[13px] leading-4 ${room.home ? 'text-text' : 'text-text-muted'}`}
                                            >
                                                {room.home ??
                                                    (room.subjects.length > 0
                                                        ? room.subjects.join(
                                                              ', ',
                                                          )
                                                        : t('None'))}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {rooms.total > rooms.rows.length &&
                                t(':rows more under Manage rooms. ', {
                                    rows: rooms.total - rooms.rows.length,
                                })}
                            {practicals.length > 0
                                ? t(
                                      'Lessons that need a special room (:practicals) are only placed in a room of that kind.',
                                      { practicals: practicals.join(', ') },
                                  )
                                : t(
                                      'No subject needs a laboratory or computer room yet. Say which do on a laboratory’s room page.',
                                  )}
                        </p>
                    </section>

                    <section className="flex flex-col gap-3">
                        <div className="flex items-baseline justify-between">
                            <p className={capsLabelClass}>
                                {t('Teaching days and hours · :teachers', {
                                    teachers: teachers.length,
                                })}
                            </p>
                            <Link
                                href={staffRoster.url()}
                                className={linkClass}
                            >
                                {t('Set on each teacher’s record')}
                            </Link>
                        </div>
                        {teachers.length === 0 ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                {t(
                                    'No teacher is assigned to a subject in a class yet.',
                                )}
                            </p>
                        ) : (
                            <ul className="flex max-h-[296px] flex-col overflow-y-auto rounded-lg border border-solid border-border">
                                {teachers.map((teacher, position) => {
                                    const over =
                                        teacher.max !== null &&
                                        teacher.periods > teacher.max;

                                    return (
                                        <li
                                            key={teacher.id}
                                            className="border-b border-solid border-border last:border-b-0"
                                        >
                                            <Link
                                                href={staffRecord.url(
                                                    teacher.id,
                                                )}
                                                className={`flex min-h-9 items-center gap-4 px-[14px] py-2 hover:bg-surface ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                            >
                                                <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium text-text">
                                                    {teacher.name}
                                                </span>
                                                <span
                                                    className={`w-[150px] shrink-0 text-[13px] leading-4 ${teacher.part_time ? amberText : 'text-text'}`}
                                                >
                                                    {dayRange(teacher.days)}
                                                    {teacher.part_time &&
                                                        t(' · part-time')}
                                                </span>
                                                <span
                                                    className={`w-[130px] shrink-0 text-right font-mono text-[13px] leading-4 ${over ? amberText : 'text-text'}`}
                                                >
                                                    {teacher.periods}{' '}
                                                    {t('a week')}
                                                    {over &&
                                                        t(' · max :teacher', {
                                                            teacher:
                                                                teacher.max,
                                                        })}
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

export default withAppShell(Setup);
