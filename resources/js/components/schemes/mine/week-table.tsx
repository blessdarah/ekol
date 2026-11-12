import { router } from '@inertiajs/react';
import {
    remove,
    tick,
} from '@/actions/App/Http/Controllers/TeacherSchemeController';
import { itemLabel, weekDates } from '../ui';
import { capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type MySchemeModel } from './model';
import { WeekPicker } from './week-picker';

/** The term week by week, with the sub-topics placed in each. */
export function WeekTable({ mine }: { mine: MySchemeModel }) {
    const { term, scheme, open, setOpen, editable, planning, periodsIn, move } =
        mine;

    return (
        <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-solid border-border">
            <div className="flex min-w-[640px] flex-col">
                <div
                    className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                >
                    <span className="w-10 shrink-0">{t('Week')}</span>
                    <span className="w-[100px] shrink-0">{t('Dates')}</span>
                    <span className="flex-1">{t('Topic and sub-topics')}</span>
                    <span className="w-[60px] shrink-0 text-right">
                        {t('Periods')}
                    </span>
                </div>
                {scheme.weeks.map((week) => {
                    const rows = scheme.items.filter(
                        (item) => item.week === week.week,
                    );
                    const used = periodsIn(week.week);
                    const over =
                        scheme.weekly_periods > 0 &&
                        used > scheme.weekly_periods;
                    const current = term.week === week.week;

                    return (
                        <div
                            key={week.week}
                            className={`flex items-start gap-4 border-b border-solid border-border px-4 py-3 last:border-b-0 ${over ? 'bg-warning-tint' : week.free ? 'bg-surface' : current ? 'bg-primary-tint/40' : ''}`}
                        >
                            <span className="w-10 shrink-0 font-mono text-[12px] leading-6 text-text-muted">
                                W{week.week}
                            </span>
                            <span className="w-[100px] shrink-0 text-[13px] leading-6 text-text-muted">
                                {weekDates(week)}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                {week.free && rows.length === 0 && (
                                    <span className="text-[13px] leading-6 text-text-muted">
                                        {t(':name · kept free of new topics', {
                                            name: week.free,
                                        })}
                                    </span>
                                )}
                                {[
                                    ...new Set(rows.map((item) => item.topic)),
                                ].map((topic) => (
                                    <div
                                        key={topic}
                                        className="flex flex-col gap-1"
                                    >
                                        <span className="text-[14px] leading-5 font-semibold text-text">
                                            {topic}
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {rows
                                                .filter(
                                                    (item) =>
                                                        item.topic === topic,
                                                )
                                                .map((item) => (
                                                    <span
                                                        key={item.id}
                                                        className="flex flex-col gap-1"
                                                    >
                                                        {!planning ? (
                                                            <label
                                                                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[12px] ${item.taught_on ? 'bg-success-tint text-success' : 'border border-solid border-border bg-white text-text'}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        item.taught_on !==
                                                                        null
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        router.patch(
                                                                            tick.url(
                                                                                {
                                                                                    scheme: scheme.id,
                                                                                    item: item.id,
                                                                                },
                                                                            ),
                                                                            {
                                                                                taught: e
                                                                                    .target
                                                                                    .checked,
                                                                            },
                                                                            {
                                                                                preserveScroll: true,
                                                                                preserveState: true,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="h-3 w-3 accent-primary"
                                                                />
                                                                {item.name ??
                                                                    t(
                                                                        'Whole topic',
                                                                    )}
                                                            </label>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    !editable
                                                                }
                                                                onClick={() =>
                                                                    setOpen(
                                                                        open ===
                                                                            item.id
                                                                            ? null
                                                                            : item.id,
                                                                    )
                                                                }
                                                                className={`rounded-md px-2 py-1 text-left text-[12px] ${item.added ? 'bg-science-tint text-science' : 'bg-primary-tint text-primary'} ${open === item.id ? 'ring-1 ring-primary' : ''}`}
                                                            >
                                                                {item.name ??
                                                                    t(
                                                                        'Whole topic',
                                                                    )}
                                                                {item.carried &&
                                                                    ` · ${t('from last term')}`}
                                                            </button>
                                                        )}
                                                        {open === item.id && (
                                                            <span className="flex flex-wrap items-center gap-2">
                                                                <WeekPicker
                                                                    weeks={
                                                                        scheme.weeks
                                                                    }
                                                                    value={
                                                                        item.week
                                                                    }
                                                                    label={t(
                                                                        'Move :label',
                                                                        {
                                                                            label: itemLabel(
                                                                                item,
                                                                            ),
                                                                        },
                                                                    )}
                                                                    onPick={(
                                                                        next,
                                                                    ) =>
                                                                        move(
                                                                            item,
                                                                            next,
                                                                        )
                                                                    }
                                                                />
                                                                {item.added && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            router.delete(
                                                                                remove.url(
                                                                                    {
                                                                                        scheme: scheme.id,
                                                                                        item: item.id,
                                                                                    },
                                                                                ),
                                                                                {
                                                                                    preserveScroll: true,
                                                                                },
                                                                            )
                                                                        }
                                                                        className="text-[12px] font-medium text-danger hover:underline"
                                                                    >
                                                                        {t(
                                                                            'Remove',
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </span>
                                                        )}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                                {over && (
                                    <span className="text-[12px] text-warning-text">
                                        {t(
                                            ':count periods more than the week has. Move a sub-topic to another week.',
                                            {
                                                count:
                                                    used -
                                                    scheme.weekly_periods,
                                            },
                                        )}
                                    </span>
                                )}
                            </div>
                            <span
                                className={`w-[60px] shrink-0 text-right font-mono text-[13px] leading-6 ${over ? 'text-warning-text' : 'text-text'}`}
                            >
                                {week.free && rows.length === 0
                                    ? '—'
                                    : scheme.weekly_periods > 0
                                      ? `${used} / ${scheme.weekly_periods}`
                                      : used}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
