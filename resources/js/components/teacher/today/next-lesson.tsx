import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { monoCaps, plural, type TodayModel, wait } from './model';

/** The lesson on now or next, or why there is none. */
export function NextLesson({ today }: { today: TodayModel }) {
    const { hasTimetable, isSchoolDay, lessons, next } = today;

    return (
        <div className="flex flex-wrap items-center gap-6 rounded-lg bg-primary-tint p-6">
            {next ? (
                <>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <p className={`${monoCaps} text-primary`}>
                            {next.state === 'now'
                                ? t('Now')
                                : wait(next.in_minutes ?? 0)}{' '}
                            · {next.starts_at} – {next.ends_at}
                        </p>
                        <p className="font-display text-[20px] leading-[26px] font-semibold text-text">
                            {next.class} · {next.subject}
                        </p>
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            {next.room
                                ? t('Room :room', { room: next.room })
                                : t('No room set')}{' '}
                            · {plural(next.students, 'student')}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href={`/attendance?lesson=${next.id}`}
                            className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-medium text-white hover:bg-primary-hover"
                        >
                            {t('Take attendance')}
                        </Link>
                        <Link
                            href="/teaching-log"
                            className="flex h-9 items-center rounded-md border border-solid border-primary-divider bg-white px-4 text-[14px] leading-[18px] font-medium text-text hover:bg-surface"
                        >
                            {t('Start lesson')}
                        </Link>
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-2">
                    <p className={`${monoCaps} text-primary`}>
                        {t('Next lesson')}
                    </p>
                    <p className="font-display text-[20px] leading-[26px] font-semibold text-text">
                        {!hasTimetable
                            ? t('No timetable is published yet')
                            : lessons.length > 0
                              ? t('Your lessons are done for today')
                              : isSchoolDay
                                ? t('You have no lessons today')
                                : t('No school today')}
                    </p>
                    <p className="text-[13px] leading-[18px] text-text-muted">
                        {hasTimetable
                            ? t(
                                  'Your next lesson shows here on your next teaching day.',
                              )
                            : t(
                                  'Your lessons appear here once the school publishes the term’s timetable.',
                              )}
                    </p>
                </div>
            )}
        </div>
    );
}
