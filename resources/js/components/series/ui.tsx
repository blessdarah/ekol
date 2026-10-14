import type { ReactNode } from 'react';
import { index } from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';
import { t } from '../../lib/i18n';

export interface SeriesSubject {
    id: string;
    name: string;
    kind: string;
}

export interface SeriesOption {
    id: string;
    code: string;
    name: string;
    stream: string;
    min: number | null;
    max: number | null;
    complete: boolean;
    subjects: SeriesSubject[];
}

export const STREAMS = [
    {
        value: 'science',
        label: 'Science',
        text: 'text-science',
        on: 'border-science bg-science-tint text-science',
    },
    {
        value: 'arts',
        label: 'Arts',
        text: 'text-arts',
        on: 'border-arts bg-arts-tint text-arts',
    },
];

export function coreOf(series: SeriesOption): SeriesSubject[] {
    return series.subjects.filter((subject) => subject.kind === 'core');
}

export function poolOf(series: SeriesOption): SeriesSubject[] {
    return series.subjects.filter((subject) => subject.kind === 'elective');
}

/** "Min 2 · Max 5", leaving out a limit the series does not set. */
export function limits(series: SeriesOption, lower = false): string {
    const parts = [
        series.min !== null ? t('Min :series', { series: series.min }) : null,
        series.max !== null ? t('Max :series', { series: series.max }) : null,
    ].filter(Boolean);
    const text = parts.length > 0 ? parts.join(' · ') : t('No limits set');

    return lower ? text.toLowerCase() : text;
}

/** Why this choice cannot be saved yet, or null when it can. */
export function choiceProblem(
    series: SeriesOption,
    electives: number,
): string | null {
    const total = coreOf(series).length + electives;

    if (series.min !== null && total < series.min) {
        return t(':code needs at least :series subjects. Add :total more.', {
            code: series.code,
            series: series.min,
            total: series.min - total,
        });
    }

    if (series.max !== null && total > series.max) {
        return t(':code allows at most :series subjects. Remove :series_a.', {
            code: series.code,
            series: series.max,
            series_a: total - series.max,
        });
    }

    return null;
}

export function SeriesHeader({
    trail = [],
    title,
    tag,
    meta,
    action,
}: {
    /** Steps after Series Registration; the last one is this page. */
    trail?: Crumb[];
    title: string;
    tag?: string;
    meta?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-[6px]">
                <Breadcrumbs
                    trail={
                        trail.length > 0
                            ? [
                                  {
                                      label: t('Series Registration'),
                                      href: index.url(),
                                  },
                                  ...trail,
                              ]
                            : [{ label: t('Series Registration') }]
                    }
                />
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {title}
                </h1>
                {(tag || meta) && (
                    <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-4 text-text-muted">
                        {tag && (
                            <span className="font-mono uppercase">{tag}</span>
                        )}
                        {meta && (
                            <span>
                                {tag ? '· ' : ''}
                                {meta}
                            </span>
                        )}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}

/** Series buttons, science first, with a rule between the streams. */
export function SeriesChips({
    series,
    value,
    disabledId,
    size = 'large',
    labelled = false,
    onChange,
}: {
    series: SeriesOption[];
    value: string;
    /** A series that cannot be picked, such as the one the student is in. */
    disabledId?: string;
    size?: 'large' | 'small';
    labelled?: boolean;
    onChange: (id: string) => void;
}) {
    const box =
        size === 'large'
            ? 'h-10 min-w-[52px] text-[14px]'
            : 'h-[30px] min-w-10 text-[12px]';
    const groups = STREAMS.map((stream) => ({
        ...stream,
        items: series.filter((option) => option.stream === stream.value),
    })).filter((group) => group.items.length > 0);

    return (
        <div
            role="radiogroup"
            aria-label={t('Series')}
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
            {groups.map((group, position) => (
                <div key={group.value} className="flex items-center gap-[6px]">
                    {position > 0 && (
                        <span className="mr-[10px] h-5 w-px shrink-0 bg-border" />
                    )}
                    {labelled && (
                        <span
                            className={`mr-1 text-[13px] leading-4 font-medium ${group.text}`}
                        >
                            {t(group.label)}
                        </span>
                    )}
                    {group.items.map((option) => {
                        const selected = option.id === value;
                        const blocked =
                            !option.complete || option.id === disabledId;

                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={blocked}
                                title={
                                    !option.complete
                                        ? t(
                                              ':option has no core subjects yet',
                                              { option: option.name },
                                          )
                                        : option.name
                                }
                                onClick={() => onChange(option.id)}
                                className={`flex shrink-0 items-center justify-center rounded-md border border-solid px-2 font-mono leading-4 disabled:cursor-not-allowed disabled:opacity-40 ${box} ${
                                    selected
                                        ? `${group.on} ${size === 'large' ? 'border-2' : ''}`
                                        : 'border-border bg-white text-text enabled:hover:bg-surface'
                                }`}
                            >
                                {option.code}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
