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
    StructureTabs,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface SeriesCard {
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
    series: SeriesCard[];
}

const STREAMS = [
    { value: 'science', label: 'Science', tone: 'text-science', tint: 'bg-science-tint' },
    { value: 'arts', label: 'Arts', tone: 'text-arts', tint: 'bg-arts-tint' },
];

function Card({ item, tone, tint }: { item: SeriesCard; tone: string; tint: string }) {
    const complete = item.core.length > 0;

    return (
        <Link
            href={edit.url(item.id)}
            className={`flex flex-col gap-3 rounded-lg border border-solid bg-white p-4 hover:border-primary ${
                complete ? 'border-border' : 'border-warning'
            }`}
        >
            <span className="flex items-center justify-between">
                <span
                    className={`flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md px-2 font-mono text-[15px] leading-5 ${tint} ${tone}`}
                >
                    {item.code}
                </span>
                {complete ? (
                    <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                        <span className="h-[6px] w-[6px] rounded-full bg-success" />
                        Complete
                    </span>
                ) : (
                    <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-warning-tint px-2 text-[12px] leading-4 font-medium text-[#8A5A12]">
                        <span className="h-[6px] w-[6px] rounded-full bg-warning" />
                        Needs setup
                    </span>
                )}
            </span>
            <span className="flex flex-1 flex-col gap-1">
                <span className="text-[15px] leading-5 font-semibold text-text">
                    {item.name}
                </span>
                <span
                    className={`text-[13px] leading-[18px] ${complete ? 'text-text-muted' : 'text-[#8A5A12]'}`}
                >
                    {complete ? item.core.join(', ') : 'No core subjects set yet'}
                </span>
            </span>
            <span className="flex items-center justify-between border-t border-solid border-border pt-[10px]">
                <span className="font-mono text-[12px] leading-4 text-text">
                    {item.core.length} core · {item.electives} electives
                </span>
                <span className="text-[12px] leading-4 text-text-muted">
                    {item.students} students
                </span>
            </span>
        </Link>
    );
}

function SeriesByLevel({ yearLabel, levels, level, enrolled, registered, series }: SeriesProps) {
    const unassigned = Math.max(0, enrolled - registered);

    return (
        <div className="flex flex-col gap-7">
            <Head title="Series setup" />
            <StructureHeader
                title="Levels and series"
                tag={`Structure${yearLabel ? ` · ${yearLabel}` : ''}`}
                meta={
                    level
                        ? `${level.name} · ${series.length} series · ${registered} of ${enrolled} students registered`
                        : 'no level uses series yet'
                }
                action={
                    level && (
                        <Link
                            href={create.url({ query: { level: level.id } })}
                            className={solidButtonClass}
                        >
                            <PlusIcon />
                            Add series
                        </Link>
                    )
                }
            />
            <StructureTabs active="series" />

            {!level ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    Series are for high school levels in the GCE subsystem.
                    Turn “Uses series” on for a level under{' '}
                    <Link href={levelsIndex.url()} className="font-medium text-primary hover:underline">
                        Levels
                    </Link>{' '}
                    and it appears here.
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[13px] leading-4 font-medium text-text">
                            Level
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {levels.map((option) => {
                                const selected = option.id === level.id;

                                return (
                                    <Link
                                        key={option.id}
                                        href={index.url({ query: { level: option.id } })}
                                        aria-current={selected ? 'page' : undefined}
                                        className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                            selected
                                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                : 'border-border bg-white font-medium text-text hover:bg-surface'
                                        }`}
                                    >
                                        {option.name}
                                    </Link>
                                );
                            })}
                        </div>
                        <span className="flex-1" />
                        <span className="flex items-center gap-[6px] text-[13px] leading-4 text-text-muted">
                            <LockIcon />
                            GCE high school levels only
                        </span>
                    </div>

                    {series.length === 0 && (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            No series yet for {level.name}. Add the first one,
                            such as S1 · Science 1.
                        </p>
                    )}

                    {STREAMS.map((stream) => {
                        const group = series.filter((item) => item.stream === stream.value);

                        if (group.length === 0) {
                            return null;
                        }

                        return (
                            <section key={stream.value} className="flex flex-col gap-3">
                                <p className="flex items-baseline gap-3">
                                    <span
                                        className={`text-[12px] leading-4 font-semibold tracking-[0.06em] uppercase ${stream.tone}`}
                                    >
                                        {stream.label}
                                    </span>
                                    <span className="text-[13px] leading-4 text-text-muted">
                                        {group.length} series
                                    </span>
                                </p>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    {group.map((item) => (
                                        <Card
                                            key={item.id}
                                            item={item}
                                            tone={stream.tone}
                                            tint={stream.tint}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}

                    {unassigned > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface px-4 py-3">
                            <p className="text-[14px] leading-[18px] text-text">
                                {unassigned} {level.name} students have no
                                series yet. They are registered in Series
                                Registration.
                            </p>
                            <Link
                                href="/series"
                                className="text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                Open Series Registration
                            </Link>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default withAppShell(SeriesByLevel);
