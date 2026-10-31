import { ManagementTabs } from '../../components/structure/ui';
import { tableRowClass } from '../../components/table/ui';
import { Head, Link } from '@inertiajs/react';
import {
    edit as editSeries,
    index as seriesSetup,
} from '@/actions/App/Http/Controllers/SeriesController';
import { bulk } from '@/actions/App/Http/Controllers/SeriesBulkRegistrationController';
import {
    index,
    one,
} from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { edit as editSubject } from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import { SeriesHeader, STREAMS } from '../../components/series/ui';
import {
    StreamChip,
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface OverviewProps {
    yearLabel: string | null;
    hasTerm: boolean;
    levels: { id: string; name: string; total: number; registered: number }[];
    level: { id: string; name: string } | null;
    series?: {
        id: string;
        code: string;
        name: string;
        stream: string;
        core: string[];
        students: number;
    }[];
    unassigned?: {
        total: number;
        preview: { id: string; name: string; class: string | null }[];
    };
    unstaffed?: { id: string; name: string; students: number }[];
}

const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

function Overview({
    yearLabel,
    hasTerm,
    levels,
    level,
    series = [],
    unassigned,
    unstaffed = [],
}: OverviewProps) {
    const query = level ? { query: { level: level.id } } : undefined;
    const notSetUp = series.filter((item) => item.core.length === 0);

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Levels and series')} />
            <SeriesHeader
                title={t('Levels and series')}
                tag={yearLabel ?? undefined}
                meta={t(
                    'put each student of a series level into a series, with their electives',
                )}
                action={
                    level && (
                        <div className="flex gap-2">
                            <Link
                                href={bulk.url(query)}
                                className={outlineButtonClass}
                            >
                                {t('Register many at once')}
                            </Link>
                            <Link
                                href={one.url(query)}
                                className={solidButtonClass}
                            >
                                {t('Register one by one →')}
                            </Link>
                        </div>
                    )
                }
            />
            <ManagementTabs
                group="structure"
                active="registration"
                levelId={level?.id}
            />

            {!hasTerm && (
                <p className="rounded-md border border-solid border-warning bg-warning-tint p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'Series are registered for a term, and no term is active. Make one active in School Setup first.',
                    )}
                </p>
            )}

            {!level ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'No level uses series yet. Turn “Uses series” on for a high school level, then set its series up under',
                    )}{' '}
                    <Link
                        href={seriesSetup.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Series setup')}
                    </Link>
                    .
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {levels.map((option) => {
                            const selected = option.id === level.id;
                            const missing = option.total - option.registered;
                            const share =
                                option.total > 0
                                    ? Math.round(
                                          (option.registered / option.total) *
                                              100,
                                      )
                                    : 0;

                            return (
                                <Link
                                    key={option.id}
                                    href={index.url({
                                        query: { level: option.id },
                                    })}
                                    aria-current={selected ? 'page' : undefined}
                                    className={`flex flex-col gap-2 rounded-lg border border-solid p-[14px] ${
                                        selected
                                            ? 'border-primary bg-primary-tint'
                                            : 'border-border hover:bg-surface'
                                    }`}
                                >
                                    <span className="flex items-baseline justify-between">
                                        <span className="font-display text-[17px] leading-[22px] font-bold text-text">
                                            {option.name}
                                        </span>
                                        <span className="font-mono text-[12px] leading-4 text-text">
                                            {option.registered} / {option.total}
                                        </span>
                                    </span>
                                    <span
                                        className={`flex h-[6px] shrink-0 rounded-full ${selected ? 'bg-white' : 'bg-border'}`}
                                    >
                                        <span
                                            className={`h-[6px] rounded-full ${missing > 0 ? 'bg-warning' : 'bg-success'}`}
                                            style={{ width: `${share}%` }}
                                        />
                                    </span>
                                    <span
                                        className={`text-[12px] leading-4 ${missing > 0 ? 'text-warning-text' : option.total > 0 ? 'text-success' : 'text-text-muted'}`}
                                    >
                                        {option.total === 0
                                            ? t('No students yet')
                                            : missing > 0
                                              ? t(':missing without a series', {
                                                    missing,
                                                })
                                              : t('Everyone registered')}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                        <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
                            <div className="flex items-baseline justify-between">
                                <p className={capsLabelClass}>
                                    {t(':level · who is in each series', {
                                        level: level.name,
                                    })}
                                </p>
                                <Link
                                    href={seriesSetup.url(query)}
                                    className={linkClass}
                                >
                                    {t('Series setup →')}
                                </Link>
                            </div>
                            {series.length === 0 ? (
                                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                    {t(
                                        ':level has no series yet. Add them under Series setup.',
                                        { level: level.name },
                                    )}
                                </p>
                            ) : (
                                <div className="flex flex-col gap-3 md:flex-row">
                                    {STREAMS.map((stream) => {
                                        const group = series.filter(
                                            (item) =>
                                                item.stream === stream.value,
                                        );

                                        if (group.length === 0) {
                                            return null;
                                        }

                                        return (
                                            <div
                                                key={stream.value}
                                                className="flex min-w-0 flex-1 flex-col gap-[10px]"
                                            >
                                                <p
                                                    className={`text-[12px] leading-4 font-semibold tracking-[0.06em] uppercase ${stream.text}`}
                                                >
                                                    {t(stream.label)}
                                                </p>
                                                <ul className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                                                    {group.map(
                                                        (item, position) => (
                                                            <li
                                                                key={item.id}
                                                                className={`flex h-[42px] shrink-0 items-center gap-[10px] border-b border-solid border-border px-[14px] last:border-b-0 ${tableRowClass({ index: position })}`}
                                                            >
                                                                <StreamChip
                                                                    stream={
                                                                        item.stream
                                                                    }
                                                                >
                                                                    {item.code}
                                                                </StreamChip>
                                                                {item.core
                                                                    .length >
                                                                0 ? (
                                                                    <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-text-muted">
                                                                        {item.core.join(
                                                                            ', ',
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex flex-1 items-center gap-[6px] text-[13px] leading-4 text-warning-text">
                                                                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                                                        {t(
                                                                            'Needs setup',
                                                                        )}
                                                                    </span>
                                                                )}
                                                                <span
                                                                    className={`font-mono text-[14px] leading-[18px] ${item.students > 0 ? 'text-text' : 'text-text-muted'}`}
                                                                >
                                                                    {
                                                                        item.students
                                                                    }
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {t(
                                    'Core subjects come with the series and cannot be unticked. Each student then picks electives from the pool, within the series minimum and maximum.',
                                )}
                            </p>
                        </div>

                        <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[340px] lg:border-l lg:pl-7">
                            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                                <div className="flex items-baseline justify-between">
                                    <p className={capsLabelClass}>
                                        {t('Without a series ·')}{' '}
                                        {unassigned?.total ?? 0}
                                    </p>
                                    {(unassigned?.total ?? 0) > 0 && (
                                        <Link
                                            href={one.url(query)}
                                            className={linkClass}
                                        >
                                            {t('Start →')}
                                        </Link>
                                    )}
                                </div>
                                {(unassigned?.total ?? 0) === 0 ? (
                                    <p className="text-[13px] leading-[19px] text-text-muted">
                                        {t(
                                            'Every :level student has a series.',
                                            { level: level.name },
                                        )}
                                    </p>
                                ) : (
                                    <ul className="flex flex-col">
                                        {unassigned?.preview.map((student) => (
                                            <li
                                                key={student.id}
                                                className="border-t border-solid border-border"
                                            >
                                                <Link
                                                    href={one.url({
                                                        query: {
                                                            level: level.id,
                                                            student: student.id,
                                                        },
                                                    })}
                                                    className="flex justify-between gap-3 py-[7px] hover:underline"
                                                >
                                                    <span className="truncate text-[13px] leading-4 text-text">
                                                        {student.name}
                                                    </span>
                                                    <span className="shrink-0 font-mono text-[12px] leading-4 text-text-muted">
                                                        {student.class}
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                        <li className="flex justify-between border-t border-solid border-border py-[7px]">
                                            <span className="text-[13px] leading-4 text-text-muted">
                                                {unassigned &&
                                                unassigned.total >
                                                    unassigned.preview.length
                                                    ? t('and :preview more', {
                                                          preview:
                                                              unassigned.total -
                                                              unassigned.preview
                                                                  .length,
                                                      })
                                                    : ''}
                                            </span>
                                            <Link
                                                href={bulk.url(query)}
                                                className={linkClass}
                                            >
                                                {t('Register many at once')}
                                            </Link>
                                        </li>
                                    </ul>
                                )}
                            </div>

                            {unstaffed.map((subject) => (
                                <div
                                    key={subject.id}
                                    className="flex flex-col gap-2 rounded-lg border border-solid border-warning bg-warning-tint p-4"
                                >
                                    <p className="text-[14px] leading-[18px] font-semibold text-warning-text">
                                        {t(':subject has no teacher', {
                                            subject: subject.name,
                                        })}
                                    </p>
                                    <p className="text-[13px] leading-[19px] text-text">
                                        {subject.students} {level.name}{' '}
                                        {subject.students === 1
                                            ? t('student takes')
                                            : t('students take')}{' '}
                                        {t(
                                            'it in a class with no teacher for it. Their marks cannot be entered until one is assigned.',
                                        )}
                                    </p>
                                    <Link
                                        href={editSubject.url(subject.id)}
                                        className={linkClass}
                                    >
                                        {t('Assign a teacher →')}
                                    </Link>
                                </div>
                            ))}

                            {notSetUp.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4"
                                >
                                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                                        {t(':item is not set up', {
                                            item: item.name,
                                        })}
                                    </p>
                                    <p className="text-[13px] leading-[19px] text-text-muted">
                                        {t(
                                            'It has no core subjects, so students cannot be registered in it yet.',
                                        )}
                                    </p>
                                    <Link
                                        href={editSeries.url(item.id)}
                                        className={linkClass}
                                    >
                                        {t('Open series setup →')}
                                    </Link>
                                </div>
                            ))}
                        </aside>
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(Overview);
