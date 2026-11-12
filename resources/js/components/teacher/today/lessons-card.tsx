import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { Card, Pending } from './card';
import { LESSON_PILLS, plural, type TodayModel } from './model';

/** The day's lessons, with whether attendance is marked. */
export function LessonsCard({ today }: { today: TodayModel }) {
    const { hasTimetable, isSchoolDay, lessons, next } = today;

    return (
        <Card
            title={t('Today’s lessons')}
            note={hasTimetable ? String(lessons.length) : undefined}
            className="xl:flex-1"
        >
            {lessons.length === 0 ? (
                <Pending>
                    {!hasTimetable
                        ? t('The term’s timetable is not published yet.')
                        : isSchoolDay
                          ? t('No lessons on your timetable today.')
                          : t('Not a school day.')}
                </Pending>
            ) : (
                lessons.map((lesson, position) => {
                    const focus = lesson.id === next?.id;
                    const pill = lesson.marked
                        ? {
                              label: t('Marked'),
                              pill: 'bg-success-tint text-success',
                          }
                        : lesson.state === 'done'
                          ? {
                                label: t('Not marked'),
                                pill: 'bg-warning-tint text-warning-text',
                            }
                          : LESSON_PILLS[lesson.state];

                    return (
                        <Link
                            key={lesson.id}
                            href={`/attendance?lesson=${lesson.id}`}
                            className={`flex items-center gap-3 px-4 py-[11px] hover:bg-surface ${focus ? 'bg-primary-faint' : position > 0 ? 'border-t border-solid border-border' : ''}`}
                        >
                            <span
                                className={`w-11 shrink-0 font-mono text-[13px] leading-4 ${focus ? 'text-primary' : 'text-text-muted'}`}
                            >
                                {lesson.starts_at}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                <span
                                    className={`truncate text-[13px] leading-[18px] text-text ${focus ? 'font-semibold' : 'font-medium'}`}
                                >
                                    {lesson.class} · {lesson.subject}
                                </span>
                                <span className="text-[12px] leading-4 text-text-muted">
                                    {lesson.room
                                        ? t('Room :room', {
                                              room: lesson.room,
                                          })
                                        : t('No room')}{' '}
                                    · {plural(lesson.students, 'student')}
                                </span>
                            </span>
                            <span
                                className={`shrink-0 rounded-full px-2 py-[3px] text-[12px] leading-4 font-medium ${pill.pill}`}
                            >
                                {t(pill.label)}
                            </span>
                        </Link>
                    );
                })
            )}
        </Card>
    );
}
