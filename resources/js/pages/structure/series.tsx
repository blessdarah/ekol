import {
    ManagementTabs,
    StreamChip,
    SearchPicker,
} from '../../components/structure/ui';
import { tableRowClass } from '../../components/table/ui';
import { useState } from 'react';
import { router } from '@inertiajs/react';
import { index as registration } from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { STREAMS } from '../../components/series/ui';
import { Head, Link } from '@inertiajs/react';
import {
    create,
    edit,
    index,
} from '@/actions/App/Http/Controllers/SeriesController';
import { index as levelsIndex } from '@/actions/App/Http/Controllers/StructureController';
import {
    LockIcon,
    PlusIcon,
    StructureHeader,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface SeriesRow {
    id: string;
    code: string;
    name: string;
    stream: string;
    core: string[];
    electives: number;
    students: number;
}

interface SeriesProps {
    yearLabel: string | null;
    levels: { id: string; name: string }[];
    level: { id: string; name: string } | null;
    enrolled: number;
    registered: number;
    series: SeriesRow[];
}

function SeriesByLevel({
    yearLabel,
    levels,
    level,
    enrolled,
    registered,
    series,
}: SeriesProps) {
    const unassigned = Math.max(0, enrolled - registered);
    const [search, setSearch] = useState('');
    const shown = series.filter((item) =>
        `${item.code} ${item.name}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
    );

    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Levels and series')} />
            <StructureHeader
                section="series"
                trail={[{ label: t('Series setup') }]}
                title={t('Levels and series')}
                tag={t('Structure:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={
                    level
                        ? t(
                              ':level · :series series · :registered of :enrolled students registered',
                              {
                                  level: level.name,
                                  series: series.length,
                                  registered,
                                  enrolled,
                              },
                          )
                        : t('no level uses series yet')
                }
                action={
                    level && (
                        <Link
                            href={create.url({ query: { level: level.id } })}
                            className={solidButtonClass}
                        >
                            <PlusIcon />
                            {t('Add series')}
                        </Link>
                    )
                }
            />
            <ManagementTabs
                group="structure"
                active="setup"
                levelId={level?.id}
            />

            {!level ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'Series are for high school levels in the GCE subsystem. Turn “Uses series” on for a level under',
                    )}{' '}
                    <Link
                        href={levelsIndex.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Levels')}
                    </Link>{' '}
                    {t('and it appears here.')}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[13px] leading-4 font-medium text-text">
                            {t('Level')}
                        </span>
                        <div className="w-[220px]">
                            <SearchPicker
                                label={t('Level')}
                                placeholder={level.name}
                                options={levels}
                                onSelect={(id) =>
                                    router.get(
                                        index.url({ query: { level: id } }),
                                    )
                                }
                            />
                        </div>
                        <label className="flex h-9 items-center gap-2 text-[13px] text-text-muted">
                            {t('Search series')}
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder={t('Code or name')}
                                className="h-9 w-[200px] rounded-md border border-solid border-border bg-white px-3 text-[14px] text-text outline-none focus:border-primary"
                            />
                        </label>
                        <span className="flex-1" />
                        <span className="flex items-center gap-[6px] text-[13px] leading-4 text-text-muted">
                            <LockIcon />
                            {t('GCE high school levels only')}
                        </span>
                    </div>

                    {series.length === 0 && (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            {t(
                                'No series yet for :level. Add the first one, such as S1 · Science 1.',
                                { level: level.name },
                            )}
                        </p>
                    )}

                    {series.length > 0 && (
                        <div className="overflow-x-auto border-y border-solid border-border">
                            <table className="w-full min-w-[720px] border-collapse text-left text-[13px] text-text">
                                <thead className="h-10 bg-surface text-[12px] font-semibold text-text-muted">
                                    <tr>
                                        {[
                                            'Code',
                                            'Name',
                                            'Domain',
                                            'Core',
                                            'Electives',
                                            'Registered',
                                            'Action',
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                scope="col"
                                                className="px-3 py-2 font-semibold"
                                            >
                                                {t(heading)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {shown.map((item, rowIndex) => (
                                        <tr
                                            key={item.id}
                                            className={`h-12 border-t border-solid border-border ${tableRowClass({ index: rowIndex, interactive: true })}`}
                                        >
                                            <td className="px-3 py-2 font-mono font-medium">
                                                {item.code}
                                            </td>
                                            <td className="px-3 py-2 font-medium">
                                                {item.name}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="inline-flex">
                                                    <StreamChip
                                                        stream={item.stream}
                                                    >
                                                        {t(
                                                            STREAMS.find(
                                                                (stream) =>
                                                                    stream.value ===
                                                                    item.stream,
                                                            )?.label ??
                                                                item.stream,
                                                        )}
                                                    </StreamChip>
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 font-mono">
                                                {item.core.length}
                                            </td>
                                            <td className="px-3 py-2 font-mono">
                                                {item.electives}
                                            </td>
                                            <td className="px-3 py-2 font-mono">
                                                {item.students}
                                            </td>
                                            <td className="px-3 py-2">
                                                <Link
                                                    href={edit.url(item.id)}
                                                    aria-label={t(
                                                        'Configure series :code',
                                                        { code: item.code },
                                                    )}
                                                    className="font-medium text-primary hover:underline"
                                                >
                                                    {t('Configure')}
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {shown.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-3 py-8 text-center text-text-muted"
                                            >
                                                {t('No matching series')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {unassigned > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface px-4 py-3">
                            <p className="text-[14px] leading-[18px] text-text">
                                {t(
                                    ':unassigned :level students have no series yet. They are registered in Series Registration.',
                                    { unassigned, level: level.name },
                                )}
                            </p>
                            <Link
                                href={registration.url({
                                    query: { level: level.id },
                                })}
                                className="text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                {t('Open Series Registration')}
                            </Link>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default withAppShell(SeriesByLevel);
