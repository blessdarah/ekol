import { Link, router } from '@inertiajs/react';
import {
    copyClasses,
    storeClass,
} from '@/actions/App/Http/Controllers/EnrolmentController';
import { placement as placementPage } from '@/actions/App/Http/Controllers/StudentPlacementController';
import { t } from '../../../lib/i18n';
import { capsLabelClass, solidButtonClass } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { FillBar, amberText, count, linkClass } from '../ui';
import { type EnrolmentOverview, type LevelRow } from './model';

/** Seats against expected students, level by level, and adding classes. */
export function RoomNextYear({ overview }: { overview: EnrolmentOverview }) {
    const { enrolment, currentLabel, levels, copyable, short } = overview;

    return (
        <section className="flex flex-col gap-[14px]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <p className={capsLabelClass}>{t('Room next year')}</p>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {t(
                            'Students expected in each level, against the seats in its classes.',
                        )}
                    </p>
                </div>
                {short.length > 0 && (
                    <p className="flex items-center gap-[6px] text-[13px] leading-4 text-text">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                        {short.length}{' '}
                        {short.length === 1
                            ? t('level needs')
                            : t('levels need')}{' '}
                        {t('another class')}
                    </p>
                )}
            </div>

            {enrolment.classes === 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
                    <p className="text-[13px] leading-[19px] text-text">
                        {enrolment.year}{' '}
                        {t('has no classes yet, so nobody can be placed.')}
                        {copyable > 0
                            ? t(
                                  ' Start with the same :copyable classes as :current_label, then add or change them.',
                                  {
                                      copyable: count(copyable),
                                      current_label: currentLabel,
                                  },
                              )
                            : t(' Add a class to a level below.')}
                    </p>
                    {copyable > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    copyClasses.url(),
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                            className={solidButtonClass}
                        >
                            {t('Copy this year’s classes')}
                        </button>
                    )}
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                <div className="flex min-w-[860px] flex-col">
                    <div
                        className={`flex h-[34px] items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                    >
                        <span className="w-[130px] shrink-0">{t('Level')}</span>
                        <span className="w-[70px] shrink-0">
                            {t('Classes')}
                        </span>
                        <span className="w-20 shrink-0 text-right">
                            {t('Seats')}
                        </span>
                        <span className="w-[90px] shrink-0 text-right">
                            {t('Expected')}
                        </span>
                        <span className="flex-1">{t('Filled')}</span>
                        <span className="w-[120px] shrink-0 text-right">
                            {t('Placed')}
                        </span>
                        <span className="w-[130px] shrink-0">
                            {t('Status')}
                        </span>
                        <span className="w-[92px] shrink-0" />
                    </div>
                    {levels.map((level, position) => (
                        <div
                            key={level.id}
                            className={`flex h-11 items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 ${tableRowClass({ index: position })}`}
                        >
                            <Link
                                href={placementPage.url({
                                    query: { level: level.id },
                                })}
                                className="w-[130px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                            >
                                {level.name}
                            </Link>
                            <span className="w-[70px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                {level.classes}
                            </span>
                            <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                {count(level.seats)}
                            </span>
                            <span className="w-[90px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                {count(level.expected)}
                            </span>
                            <span className="flex flex-1 flex-col">
                                <FillBar
                                    value={level.expected}
                                    max={level.seats}
                                    tone="bg-success"
                                />
                            </span>
                            <span className="w-[120px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                {t(':placed of :expected', {
                                    placed: count(level.placed),
                                    expected: count(level.expected),
                                })}
                            </span>
                            <span className="flex w-[130px] shrink-0">
                                <LevelStatus level={level} />
                            </span>
                            <span className="flex w-[92px] shrink-0 justify-end">
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            storeClass.url(level.id),
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className={linkClass}
                                >
                                    {t('Add a class')}
                                </button>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'Expected counts promoted students, repeaters and admitted applicants. Students who are not decided yet are not counted.',
                )}
            </p>
        </section>
    );
}

/** Whether a level has room, is full, is over, or has no classes. */
function LevelStatus({ level }: { level: LevelRow }) {
    const room = level.seats - level.expected;

    if (level.classes === 0) {
        return level.expected > 0 ? (
            <span
                className={`flex h-[22px] items-center rounded-full bg-warning-tint px-2 text-[12px] leading-4 font-medium ${amberText}`}
            >
                {t('No classes yet')}
            </span>
        ) : (
            <span className="text-[13px] leading-4 text-text-muted">—</span>
        );
    }

    return room < 0 ? (
        <span className="flex h-[22px] items-center rounded-full bg-danger-tint px-2 text-[12px] leading-4 font-medium text-danger">
            {t(':room over', { room: count(-room) })}
        </span>
    ) : (
        <span className="flex h-[22px] items-center rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
            {room === 0
                ? t('Full')
                : t('Room for :room', { room: count(room) })}
        </span>
    );
}
