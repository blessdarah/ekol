import { useEffect, useState } from 'react';
import { updateSchoolday } from '@/actions/App/Http/Controllers/SetupController';
import { t } from '../../lib/i18n';
import {
    type PeriodProp,
    type SchoolProp,
    type SetupProps,
    useAutosave,
    WEEKDAYS,
    Zone,
    linkClass,
    ZoneError,
} from './shared';

export function toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
}

export function addMinutes(time: string, minutes: number): string {
    const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59);

    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The length a break gets when it is added. */
export const BREAK_MINUTES = 20;

export const stepButtonClass =
    'flex h-8 w-[34px] items-center justify-center text-[16px] leading-5 text-text enabled:hover:bg-surface disabled:text-text-muted disabled:opacity-40';

export function Stepper({
    value,
    label,
    fewer,
    more,
    onFewer,
    onMore,
    canFewer,
    canMore,
}: {
    value: string;
    label: string;
    fewer: string;
    more: string;
    onFewer: () => void;
    onMore: () => void;
    canFewer: boolean;
    canMore: boolean;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className="flex h-[34px] items-center rounded-md border border-solid border-border bg-white"
        >
            <button
                type="button"
                aria-label={fewer}
                disabled={!canFewer}
                onClick={onFewer}
                className={`${stepButtonClass} border-r border-solid border-border`}
            >
                −
            </button>
            <span className="min-w-[44px] px-2 text-center font-mono text-[14px] leading-[18px] text-text">
                {value}
            </span>
            <button
                type="button"
                aria-label={more}
                disabled={!canMore}
                onClick={onMore}
                className={`${stepButtonClass} border-l border-solid border-border`}
            >
                +
            </button>
        </div>
    );
}

/**
 * A length in minutes, typed freely and sent once it is a sensible
 * number, so a half-typed value never reaches the server.
 */
export function MinutesInput({
    value,
    label,
    onCommit,
}: {
    value: number;
    label: string;
    onCommit: (minutes: number) => void;
}) {
    const [draft, setDraft] = useState(String(value));

    useEffect(() => setDraft(String(value)), [value]);

    function commit() {
        const minutes = Number(draft);

        if (Number.isInteger(minutes) && minutes >= 5 && minutes <= 240) {
            if (minutes !== value) {
                onCommit(minutes);
            }
        } else {
            setDraft(String(value));
        }
    }

    return (
        <span className="flex items-center gap-1 font-mono text-[12px] leading-4 text-text-muted">
            <input
                type="text"
                inputMode="numeric"
                aria-label={label}
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
                onBlur={commit}
                onKeyDown={(e) => e.key === 'Enter' && commit()}
                className="w-[34px] rounded-sm bg-transparent text-right outline-none hover:bg-primary-tint focus:bg-primary-tint"
            />
            {t('min')}
        </span>
    );
}

export interface SchooldayData {
    school_days: number;
    day_starts_at: string;
    period_minutes: number;
    periods: PeriodProp[];
}

/**
 * Each period's times, one after another from the start of the day,
 * the way the server works them out when it saves.
 */
export function timed(data: SchooldayData) {
    let cursor = data.day_starts_at;

    return data.periods
        .filter((row) => !row._delete)
        .map((row) => {
            const minutes = row.custom_minutes ?? data.period_minutes;
            const starts = cursor;
            cursor = addMinutes(cursor, minutes);

            return { row, starts, ends: cursor, minutes };
        });
}

export function SchooldayZone({
    school,
    periods,
}: {
    school: SchoolProp;
    periods: PeriodProp[];
}) {
    const fromProps = (props: SetupProps): SchooldayData => ({
        school_days: props.school.school_days,
        day_starts_at: props.school.day_starts_at,
        period_minutes: props.school.period_minutes,
        periods: props.periods,
    });
    const { data, save, error } = useAutosave(
        updateSchoolday.url(),
        fromProps({ school, periods } as SetupProps),
        fromProps,
        (next) => ({
            ...next,
            periods: next.periods.map(
                ({ starts_at: _starts, ends_at: _ends, ...row }) => row,
            ),
        }),
    );
    const rows = timed(data);
    const lessons = rows.filter(({ row }) => !row.is_break);
    const days = WEEKDAYS.filter(
        (_, index) => (data.school_days & (1 << index)) !== 0,
    ).length;

    function setPeriod(target: PeriodProp, patch: Partial<PeriodProp>) {
        save({
            ...data,
            periods: data.periods.map((row) =>
                row === target ? { ...row, ...patch } : row,
            ),
        });
    }

    function removePeriod(target: PeriodProp) {
        save({
            ...data,
            periods: target.id
                ? data.periods.map((row) =>
                      row === target ? { ...row, _delete: true } : row,
                  )
                : data.periods.filter((row) => row !== target),
        });
    }

    function movePeriod(target: PeriodProp, step: -1 | 1) {
        const order = data.periods.filter((row) => !row._delete);
        const from = order.indexOf(target);
        const to = from + step;

        if (to < 0 || to >= order.length) {
            return;
        }

        [order[from], order[to]] = [order[to], order[from]];
        save({
            ...data,
            periods: [...order, ...data.periods.filter((row) => row._delete)],
        });
    }

    function addPeriod(isBreak: boolean) {
        save({
            ...data,
            periods: [
                ...data.periods,
                {
                    label: isBreak ? 'BREAK' : `P${lessons.length + 1}`,
                    is_break: isBreak,
                    custom_minutes: isBreak ? BREAK_MINUTES : null,
                },
            ],
        });
    }

    function removeLastLesson() {
        const last = lessons[lessons.length - 1];

        if (last) {
            removePeriod(last.row);
        }
    }

    return (
        <Zone
            title={t('School day')}
            desc={t(
                'The days and periods every timetable and exam schedule is built on. A change applies to the next timetable version you generate.',
            )}
        >
            <div className="flex flex-wrap items-center gap-[14px]">
                <span className="text-[13px] leading-4 font-medium text-text">
                    {t('School days')}
                </span>
                <div className="flex flex-wrap gap-[6px]">
                    {WEEKDAYS.map((name) => t(name)).map((day, index) => {
                        const bit = 1 << index;
                        const on = (data.school_days & bit) !== 0;

                        return (
                            <button
                                key={day}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                    save({
                                        ...data,
                                        school_days: data.school_days ^ bit,
                                    })
                                }
                                className={`flex h-[30px] w-[52px] shrink-0 items-center justify-center rounded-md border border-solid text-[13px] leading-4 ${
                                    on
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border text-text-muted'
                                }`}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex flex-col gap-4 rounded-lg border border-solid border-border bg-surface p-4 xl:flex-row xl:items-center">
                <div className="flex flex-wrap items-end gap-6">
                    <label className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                        {t('Day starts at')}
                        <input
                            type="time"
                            value={data.day_starts_at}
                            onChange={(e) =>
                                e.target.value &&
                                save({ ...data, day_starts_at: e.target.value })
                            }
                            className="h-[34px] w-[96px] rounded-md border border-solid border-border bg-white px-3 font-mono text-[14px] text-text outline-none focus:border-primary [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                    </label>
                    <div className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                        {t('Default period length')}
                        <Stepper
                            value={t(':count min', {
                                count: data.period_minutes,
                            })}
                            label={t('Default period length')}
                            fewer={t('Shorter periods')}
                            more={t('Longer periods')}
                            canFewer={data.period_minutes > 10}
                            canMore={data.period_minutes < 180}
                            onFewer={() =>
                                save({
                                    ...data,
                                    period_minutes: Math.max(
                                        10,
                                        data.period_minutes - 5,
                                    ),
                                })
                            }
                            onMore={() =>
                                save({
                                    ...data,
                                    period_minutes: Math.min(
                                        180,
                                        data.period_minutes + 5,
                                    ),
                                })
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                        {t('Periods a day')}
                        <Stepper
                            value={String(lessons.length)}
                            label={t('Periods a day')}
                            fewer={t('Fewer periods')}
                            more={t('More periods')}
                            canFewer={lessons.length > 0}
                            canMore={lessons.length < 14}
                            onFewer={removeLastLesson}
                            onMore={() => addPeriod(false)}
                        />
                    </div>
                </div>
                <p className="text-[12px] leading-[17px] text-text-muted xl:max-w-[400px]">
                    {t(
                        'Every period starts at this length and the times below are worked out for you. To make one period longer or shorter, change its length in the table.',
                    )}
                </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                <div className="flex min-w-[560px] flex-col">
                    <div className="flex h-8 shrink-0 items-center gap-[14px] border-b border-solid border-border bg-surface px-[14px] text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                        <span className="w-[70px] shrink-0">{t('Period')}</span>
                        <span className="w-[70px] shrink-0">{t('Starts')}</span>
                        <span className="w-[70px] shrink-0">{t('Ends')}</span>
                        <span className="flex-1">{t('Length')}</span>
                    </div>
                    {rows.length === 0 && (
                        <p className="px-[14px] py-3 text-[13px] leading-[19px] text-text-muted">
                            {t('No periods yet. Add the first one below.')}
                        </p>
                    )}
                    {rows.map(({ row, starts, ends, minutes }, index) => {
                        const custom =
                            !row.is_break && row.custom_minutes !== null;
                        const tone = row.is_break
                            ? 'text-text-muted'
                            : 'text-text';

                        return (
                            <div
                                key={row.id ?? `new-${index}`}
                                className={`group flex shrink-0 items-center gap-[14px] border-b border-solid border-border px-[14px] last:border-b-0 ${
                                    row.is_break
                                        ? 'h-8 bg-surface'
                                        : `h-[38px] ${index % 2 === 1 ? 'bg-row-alt' : ''}`
                                }`}
                            >
                                <input
                                    type="text"
                                    aria-label={t('Period name')}
                                    value={row.label}
                                    onChange={(e) =>
                                        setPeriod(row, {
                                            label: e.target.value,
                                        })
                                    }
                                    className={`w-[70px] shrink-0 rounded-sm bg-transparent outline-none hover:bg-primary-tint focus:bg-primary-tint ${
                                        row.is_break
                                            ? 'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase'
                                            : 'text-[14px] leading-[18px] font-medium text-text'
                                    }`}
                                />
                                <span
                                    className={`w-[70px] shrink-0 font-mono text-[13px] leading-4 ${tone}`}
                                >
                                    {starts}
                                </span>
                                <span
                                    className={`w-[70px] shrink-0 font-mono text-[13px] leading-4 ${tone}`}
                                >
                                    {ends}
                                </span>
                                <span className="flex flex-1 items-center gap-2">
                                    <MinutesInput
                                        value={minutes}
                                        label={t(':label length in minutes', {
                                            label: row.label,
                                        })}
                                        onCommit={(next) =>
                                            setPeriod(row, {
                                                custom_minutes:
                                                    row.is_break ||
                                                    next !== data.period_minutes
                                                        ? next
                                                        : null,
                                            })
                                        }
                                    />
                                    {custom && (
                                        <span className="flex h-5 items-center rounded-full bg-warning-tint px-2 text-[11px] leading-4 font-medium text-warning-text">
                                            {t('Custom')}
                                        </span>
                                    )}
                                </span>
                                <span className="flex shrink-0 items-center gap-3">
                                    <span className="flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                                        <button
                                            type="button"
                                            aria-label={t(
                                                'Move :label earlier',
                                                {
                                                    label: row.label,
                                                },
                                            )}
                                            disabled={index === 0}
                                            onClick={() => movePeriod(row, -1)}
                                            className="px-1 text-[13px] text-text-muted hover:text-text disabled:opacity-30"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={t('Move :label later', {
                                                label: row.label,
                                            })}
                                            disabled={index === rows.length - 1}
                                            onClick={() => movePeriod(row, 1)}
                                            className="px-1 text-[13px] text-text-muted hover:text-text disabled:opacity-30"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removePeriod(row)}
                                            className="text-[12px] leading-4 font-medium text-danger hover:underline"
                                        >
                                            {t('Remove')}
                                        </button>
                                    </span>
                                    {custom && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPeriod(row, {
                                                    custom_minutes: null,
                                                })
                                            }
                                            className="text-[13px] leading-4 font-medium text-text hover:underline"
                                        >
                                            {t('Reset to :count min', {
                                                count: data.period_minutes,
                                            })}
                                        </button>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="max-w-[640px] text-[13px] leading-[19px] text-text-muted">
                    {t(
                        ':count lesson slots a week for each class. Changing the default length resets every period that isn’t marked Custom.',
                        { count: lessons.length * days },
                    )}
                </p>
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => addPeriod(false)}
                        className={linkClass}
                    >
                        {t('Add a period')}
                    </button>
                    <button
                        type="button"
                        onClick={() => addPeriod(true)}
                        className={linkClass}
                    >
                        {t('Add a break')}
                    </button>
                </div>
            </div>
            <ZoneError message={error} />
        </Zone>
    );
}
