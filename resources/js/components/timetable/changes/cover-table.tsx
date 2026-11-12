import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { amberText } from '../ui';
import { type TimetableChanges } from './model';

/** The away teacher's lessons that day, each with a cover to pick. */
export function CoverTable({ changes }: { changes: TimetableChanges }) {
    const { props, lessons, covers, setCovers } = changes;

    return (
        <>
            {lessons.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {props.isSchoolDay
                        ? t(
                              'This teacher has no lessons that day, so there is nothing to cover.',
                          )
                        : t('That day is not a school day.')}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[560px] flex-col">
                        <div
                            className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}
                        >
                            <span className="w-[60px] shrink-0">
                                {t('Period')}
                            </span>
                            <span className="flex-1">{t('Lesson')}</span>
                            <span className="w-[240px] shrink-0">
                                {t('Cover by')}
                            </span>
                        </div>
                        {lessons.map((lesson, position) => {
                            const value =
                                covers[lesson.id] ?? lesson.covers[0]?.id ?? '';
                            const pick = lesson.covers.find(
                                (cover) => cover.id === value,
                            );
                            const weak =
                                lesson.covers.length === 0 ||
                                (pick !== undefined && !pick.teaches);

                            return (
                                <div
                                    key={lesson.id}
                                    className={`flex min-h-12 items-center gap-4 border-b border-solid border-border px-[14px] py-[6px] last:border-b-0 ${
                                        weak
                                            ? 'bg-warning-tint'
                                            : position % 2 === 1
                                              ? 'bg-row-alt'
                                              : ''
                                    }`}
                                >
                                    <span className="w-[60px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {lesson.period}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-[14px] leading-[18px] font-medium text-text">
                                            {t(lesson.title)}
                                        </span>
                                        <span
                                            className={`text-[12px] leading-4 ${weak ? amberText : 'text-text-muted'}`}
                                        >
                                            {lesson.covers.length === 0
                                                ? t(
                                                      'Nobody is free in this period',
                                                  )
                                                : weak
                                                  ? t(
                                                        'Not a teacher of the subject · supervised study',
                                                    )
                                                  : t('Room :set', {
                                                        set:
                                                            lesson.room ??
                                                            'not set',
                                                    })}
                                        </span>
                                    </span>
                                    <select
                                        aria-label={t('Cover for :title', {
                                            title: lesson.title,
                                        })}
                                        value={value}
                                        disabled={lesson.covers.length === 0}
                                        onChange={(e) =>
                                            setCovers({
                                                ...covers,
                                                [lesson.id]: e.target.value,
                                            })
                                        }
                                        className="h-[34px] w-[240px] shrink-0 rounded-md border border-solid border-border bg-white px-[10px] text-[13px] leading-4 text-text outline-none focus:border-primary disabled:opacity-50"
                                    >
                                        <option value="">
                                            {t('No cover')}
                                        </option>
                                        {lesson.covers.map((cover) => (
                                            <option
                                                key={cover.id}
                                                value={cover.id}
                                            >
                                                {cover.teaches
                                                    ? t(
                                                          ':cover · free, teaches it',
                                                          {
                                                              cover: cover.name,
                                                          },
                                                      )
                                                    : t(
                                                          'Supervised study · :cover',
                                                          {
                                                              cover: cover.name,
                                                          },
                                                      )}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
