import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { index as seriesIndex } from '@/actions/App/Http/Controllers/SeriesController';
import { updateLevel } from '@/actions/App/Http/Controllers/LevelController';
import { storeClass } from '@/actions/App/Http/Controllers/SchoolClassController';
import { t } from '../../../lib/i18n';
import { tableRowClass } from '../../table/ui';
import {
    CYCLE_LABELS,
    ErrorText,
    LockIcon,
    SUBSYSTEM_LABELS,
    Toggle,
    capsLabelClass,
} from '../ui';
import { ClassEditor } from './class-editor';
import { type LevelProp, type LevelsProps, type RoomProp } from './model';

/** The selected level's details, series switch and classes. */
export function LevelPanel({
    level,
    hasYear,
    staff,
    rooms,
}: {
    level: LevelProp;
    hasYear: boolean;
    staff: LevelsProps['staff'];
    rooms: RoomProp[];
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function toggleSeries(next: boolean) {
        router.patch(
            updateLevel.url(level.id),
            { uses_series: next },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setError(null),
                onError: (failed) => setError(Object.values(failed)[0] ?? null),
            },
        );
    }

    function addClass() {
        router.post(
            storeClass.url(level.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setError(null),
                onError: (failed) => setError(Object.values(failed)[0] ?? null),
            },
        );
    }

    return (
        <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[340px] lg:border-l lg:pl-8">
            <div className="flex flex-col gap-[2px]">
                <h2 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-text">
                    {level.name}
                </h2>
                <p className="font-mono text-[13px] leading-4 text-text-muted">
                    {[level.code, CYCLE_LABELS[level.cycle]]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
            </div>

            <dl className="flex flex-col">
                {[
                    ['Cycle', CYCLE_LABELS[level.cycle]],
                    [
                        'Subsystem',
                        level.subsystem
                            ? SUBSYSTEM_LABELS[level.subsystem]
                            : '—',
                    ],
                ].map(([label, value]) => (
                    <div
                        key={label}
                        className="flex items-baseline gap-4 border-t border-solid border-border py-[10px]"
                    >
                        <dt className="w-24 shrink-0 text-[13px] leading-[1.35] text-text-muted">
                            {label}
                        </dt>
                        <dd className="text-[14px] leading-[1.35] text-text">
                            {value}
                        </dd>
                    </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-y border-solid border-border py-[14px]">
                    <div className="flex flex-col gap-[2px]">
                        <span className="flex items-center gap-2 text-[14px] leading-[18px] font-semibold text-text">
                            {!level.series_allowed && <LockIcon />}
                            {t('Uses series')}
                        </span>
                        <span className="text-[13px] leading-[18px] text-text-muted">
                            {level.series_allowed
                                ? t('Students pick a series, then electives.')
                                : t(
                                      'Only for high school levels in the GCE subsystem.',
                                  )}
                        </span>
                    </div>
                    <Toggle
                        checked={level.uses_series}
                        disabled={!level.series_allowed}
                        label={t(':level uses series', { level: level.name })}
                        onChange={toggleSeries}
                    />
                </div>
            </dl>

            {level.uses_series && (
                <Link
                    href={seriesIndex.url({ query: { level: level.id } })}
                    className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-solid border-border bg-white text-[13px] leading-4 font-medium text-text hover:bg-surface"
                >
                    {t('Manage series for')} {level.name}
                    <svg width="14" height="14" viewBox="0 0 24 24">
                        <path
                            d="M5 12h14M13 6l6 6-6 6"
                            fill="none"
                            stroke="var(--color-text)"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </Link>
            )}

            <div className="flex flex-col gap-[10px]">
                <div className="flex items-baseline justify-between">
                    <p className={capsLabelClass}>
                        {t('Classes · :classes · :students students', {
                            classes: level.classes.length,
                            students: level.students,
                        })}
                    </p>
                    {hasYear && (
                        <button
                            type="button"
                            onClick={addClass}
                            className="text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            {t('+ Add a class')}
                        </button>
                    )}
                </div>
                {level.classes.length > 0 ? (
                    <div className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                        {level.classes.map((item, position) =>
                            editing === item.id ? (
                                <ClassEditor
                                    key={item.id}
                                    item={item}
                                    staff={staff}
                                    rooms={rooms}
                                    onClose={() => setEditing(null)}
                                />
                            ) : (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setEditing(item.id)}
                                    className={`flex items-center gap-3 border-b border-solid border-border px-[14px] py-[10px] text-left last:border-b-0 hover:bg-surface ${tableRowClass(
                                        { index: position },
                                    )}`}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                        <span className="text-[14px] leading-[18px] font-medium text-text">
                                            {item.name}
                                        </span>
                                        <span
                                            className={`truncate text-[12px] leading-4 ${
                                                item.form_master
                                                    ? 'text-text-muted'
                                                    : 'text-warning'
                                            }`}
                                        >
                                            {item.form_master ??
                                                t('No form master yet')}{' '}
                                            ·{' '}
                                            {item.home_room
                                                ? t('Room :home_room', {
                                                      home_room: item.home_room,
                                                  })
                                                : t('No home room')}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                        {item.students} / {item.capacity}
                                    </span>
                                </button>
                            ),
                        )}
                    </div>
                ) : (
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {hasYear
                            ? t('No classes yet for this level.')
                            : t(
                                  'Classes belong to an academic year. Make a year active in School Setup first.',
                              )}
                    </p>
                )}
                <ErrorText message={error} />
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'Numbers are students out of seats. A class with students or timetable lessons cannot be removed; move them first. The form master and home room are read by the timetable and report cards.',
                    )}
                </p>
            </div>
        </aside>
    );
}
