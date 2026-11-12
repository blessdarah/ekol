import { show } from '@/actions/App/Http/Controllers/AttendanceController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { type Lesson, monoCaps } from './model';

/** Today's lessons, each with its own register. */
export function LessonPicker({
    lessons,
    current,
}: {
    lessons: Lesson[];
    current: Lesson;
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={`${monoCaps} text-text-muted`}>
                    {t('Today’s lessons · :lessons', {
                        lessons: lessons.length,
                    })}
                </p>
                <p className="text-[12px] leading-4 text-text-muted">
                    {t('Switching lesson keeps each register separate')}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {lessons.map((option) => {
                    const active = option.id === current.id;
                    const state = option.saved
                        ? {
                              label: t('Marked'),
                              dot: 'bg-success',
                              text: 'text-success',
                          }
                        : active && option.started
                          ? {
                                label: t('Marking'),
                                dot: 'bg-warning',
                                text: 'text-warning-text',
                            }
                          : option.started
                            ? {
                                  label: t('Not marked'),
                                  dot: 'bg-warning',
                                  text: 'text-warning-text',
                              }
                            : {
                                  label: t('Not started'),
                                  dot: 'bg-border',
                                  text: 'text-text-muted',
                              };

                    return (
                        <Link
                            key={option.id}
                            href={show.url({
                                query: { lesson: option.id },
                            })}
                            preserveScroll
                            aria-current={active ? 'true' : undefined}
                            className={`flex flex-col gap-[6px] rounded-lg border-solid p-3 ${
                                active
                                    ? 'border-2 border-primary bg-surface-raised'
                                    : 'border border-border bg-white hover:bg-surface'
                            }`}
                        >
                            <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                {option.period} · {option.time}
                                {option.cover ? t(' · cover') : ''}
                            </span>
                            <span className="truncate font-display text-[14px] leading-[18px] font-semibold text-text">
                                {option.class} · {option.subject}
                            </span>
                            <span className="text-[12px] leading-4 text-text-muted">
                                {option.room
                                    ? t('Room :room', {
                                          room: option.room,
                                      })
                                    : t('No room')}{' '}
                                ·{' '}
                                {option.saved
                                    ? t(':present of :students present', {
                                          present: option.present,
                                          students: option.students,
                                      })
                                    : t(':students students', {
                                          students: option.students,
                                      })}
                            </span>
                            <span
                                className={`flex items-center gap-[6px] text-[12px] leading-4 font-medium ${state.text}`}
                            >
                                <span
                                    className={`h-[6px] w-[6px] rounded-full ${state.dot}`}
                                />
                                {t(state.label)}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
