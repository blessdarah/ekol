import { Link } from '@inertiajs/react';
import { one } from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { t } from '../../../lib/i18n';
import { outlineButtonClass, solidButtonClass } from '../../structure/ui';
import { type RegisterOne } from './model';

/** What the choice still needs, skipping, and registering the student. */
export function RegisterActions({
    registration,
}: {
    registration: RegisterOne;
}) {
    const {
        hasTerm,
        level,
        tab,
        student,
        nextId,
        chosen,
        problem,
        room,
        saving,
        submit,
    } = registration;

    if (!student) {
        return null;
    }

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p
                    className={`text-[13px] leading-4 ${problem ? 'text-warning-text' : 'text-text-muted'}`}
                >
                    {!chosen
                        ? t('Choose a series to see its subjects.')
                        : (problem ??
                          (room === null
                              ? t(
                                    'Core subjects are locked. Tick the electives this student takes.',
                                )
                              : room > 0
                                ? t('You can add :room more :electives.', {
                                      room,
                                      electives:
                                          room === 1 ? 'elective' : 'electives',
                                  })
                                : t(
                                      'That is the most subjects this series allows.',
                                  )))}
                </p>
                <div className="flex gap-2">
                    {tab === 'unassigned' && nextId && (
                        <Link
                            href={one.url({
                                query: {
                                    level: level.id,
                                    student: nextId,
                                },
                            })}
                            className={outlineButtonClass}
                        >
                            {t('Skip')}
                        </Link>
                    )}
                    <button
                        type="button"
                        disabled={!chosen || !!problem || saving || !hasTerm}
                        onClick={submit}
                        className={solidButtonClass}
                    >
                        {student.series_id
                            ? t('Save subjects')
                            : nextId
                              ? t('Register & next student')
                              : t('Register student')}
                        {!student.series_id && nextId && (
                            <svg width="14" height="14" viewBox="0 0 24 24">
                                <path
                                    d="M5 12h14M13 6l6 6-6 6"
                                    fill="none"
                                    stroke="var(--color-bg)"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
            {!hasTerm && (
                <p className="text-[13px] leading-[19px] text-warning">
                    {t(
                        'No term is active, so nothing can be saved. Make a term active in School Setup.',
                    )}
                </p>
            )}
        </>
    );
}
