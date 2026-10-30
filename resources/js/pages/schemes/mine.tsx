import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { index as schemesIndex } from '@/actions/App/Http/Controllers/SchemeController';
import {
    add,
    place,
    remove,
    show,
    submit,
    tick,
} from '@/actions/App/Http/Controllers/TeacherSchemeController';
import { dayMonth } from '../../components/fees/ui';
import {
    STATUSES,
    STATUS_DOTS,
    itemLabel,
    weekDates,
    type Item,
    type Week,
} from '../../components/schemes/ui';
import {
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface MineProps {
    term: { label: string; week: number | null; weeks: number } | null;
    opening: {
        due_on: string;
        approval: string;
        closed: boolean;
        free_changes: boolean;
    } | null;
    schemes: {
        id: string;
        subject: string | null;
        class: string | null;
        status: string;
    }[];
    scheme: {
        id: string;
        subject: string | null;
        class: string | null;
        status: string;
        weekly_periods: number;
        weeks: Week[];
        items: Item[];
        last_note: {
            action: string;
            by: string | null;
            on: string;
            note: string;
        } | null;
    } | null;
    toApprove: number;
}

const smallSelect =
    'h-7 rounded-md border border-solid border-border bg-white px-1 text-[12px] text-text outline-none focus:border-primary';

function WeekPicker({
    weeks,
    value,
    label,
    onPick,
}: {
    weeks: Week[];
    value: number | null;
    label: string;
    onPick: (week: number | null) => void;
}) {
    return (
        <select
            aria-label={label}
            value={value ?? ''}
            onChange={(e) =>
                onPick(e.target.value === '' ? null : Number(e.target.value))
            }
            className={smallSelect}
        >
            <option value="">
                {value === null
                    ? t('Place in week…')
                    : t('Take out of the plan')}
            </option>
            {weeks.map((week) => (
                <option key={week.week} value={week.week}>
                    {t('Week :week', { week: week.week })} · {weekDates(week)}
                    {week.free ? ` · ${week.free}` : ''}
                </option>
            ))}
        </select>
    );
}

function MyScheme({ term, opening, schemes, scheme, toApprove }: MineProps) {
    const [open, setOpen] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({
        topic: '',
        name: '',
        periods: 1,
        week: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [changing, setChanging] = useState(false);

    if (!term || !opening || !scheme) {
        return (
            <div className="flex flex-col gap-4">
                <Head title={t('Scheme of Work')} />
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {t('Scheme of Work')}
                </h1>
                <p className="rounded-md bg-surface p-4 text-[14px] text-text">
                    {!term
                        ? t('No term is running at the moment.')
                        : !opening
                          ? t(
                                'The school has not opened schemes for :term yet. You will find them here once it has.',
                                { term: t(term.label) },
                            )
                          : t(
                                'You have no class and subject to plan for this term.',
                            )}
                </p>
                {toApprove > 0 && (
                    <Link
                        href={schemesIndex.url({
                            query: { state: 'to_approve' },
                        })}
                        className={`${solidButtonClass} self-start`}
                    >
                        {t('Review :count schemes waiting for you →', {
                            count: toApprove,
                        })}
                    </Link>
                )}
            </div>
        );
    }

    const editable =
        !opening.closed &&
        ['not_started', 'draft', 'changes_requested', 'approved'].includes(
            scheme.status,
        );
    const approved = scheme.status === 'approved';
    const planning = !approved || changing;
    const unplaced = scheme.items.filter((item) => item.week === null);
    const topics = [...new Set(unplaced.map((item) => item.topic))];
    const freeWeeks = new Set(
        scheme.weeks.filter((week) => week.free).map((week) => week.week),
    );
    const periodsIn = (week: number) =>
        scheme.items
            .filter((item) => item.week === week)
            .reduce((sum, item) => sum + item.periods, 0);
    const overfull = scheme.weeks.filter(
        (week) =>
            scheme.weekly_periods > 0 &&
            periodsIn(week.week) > scheme.weekly_periods,
    );
    const inFree = scheme.items.filter(
        (item) => item.week !== null && freeWeeks.has(item.week),
    );
    const placed = scheme.items.length - unplaced.length;
    const style = STATUSES[scheme.status] ?? STATUSES.draft;

    function move(item: Item, week: number | null) {
        setOpen(null);
        router.patch(
            place.url({ scheme: scheme!.id, item: item.id }),
            { week },
            { preserveScroll: true, preserveState: true },
        );
    }

    function addOwn() {
        router.post(
            add.url(scheme!.id),
            { ...draft, week: draft.week === '' ? null : Number(draft.week) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setAdding(false);
                    setDraft({ topic: '', name: '', periods: 1, week: '' });
                    setErrors({});
                },
                onError: (failed) => setErrors(failed),
            },
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Scheme of Work')} />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <p className="font-mono text-[12px] tracking-[0.06em] text-text-muted uppercase">
                        {t('Scheme of work · :term · due :date', {
                            term: t(term.label),
                            date: dayMonth(opening.due_on, false),
                        })}
                    </p>
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {scheme.subject} · {scheme.class}
                    </h1>
                    <p className="text-[13px] text-text-muted">
                        {approved
                            ? t(
                                  'Tick each sub-topic once it is taught. :weeks weeks · :periods periods a week.',
                                  {
                                      weeks: term.weeks,
                                      periods: scheme.weekly_periods,
                                  },
                              )
                            : t(
                                  'Place each sub-topic in the week you will teach it. :weeks weeks · :periods periods a week.',
                                  {
                                      weeks: term.weeks,
                                      periods: scheme.weekly_periods,
                                  },
                              )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`flex h-7 items-center rounded-full px-3 text-[12px] font-medium ${style.pill}`}
                    >
                        {t(style.label)}
                    </span>
                    {editable && approved && (
                        <button
                            type="button"
                            onClick={() => setChanging(!changing)}
                            className={outlineButtonClass}
                        >
                            {changing
                                ? t('Back to ticking')
                                : t('Change the plan')}
                        </button>
                    )}
                    {editable && !approved && (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    submit.url(scheme.id),
                                    {},
                                    {
                                        preserveScroll: true,
                                        onError: (failed) => setErrors(failed),
                                    },
                                )
                            }
                            className={solidButtonClass}
                        >
                            {opening.approval === 'none'
                                ? t('Submit')
                                : t('Submit for approval')}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className={capsLabelClass}>
                    {t('My schemes · :count', { count: schemes.length })}
                </span>
                {schemes.map((option) => (
                    <Link
                        key={option.id}
                        href={show.url({ query: { scheme: option.id } })}
                        preserveScroll
                        className={`flex h-8 items-center gap-2 rounded-full border border-solid px-3 text-[13px] ${
                            option.id === scheme.id
                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                : 'border-border text-text hover:bg-surface'
                        }`}
                    >
                        <span
                            className={`h-[6px] w-[6px] rounded-full ${STATUS_DOTS[option.status] ?? 'bg-text-muted'}`}
                        />
                        {option.subject} · {option.class}
                    </Link>
                ))}
            </div>

            {toApprove > 0 && (
                <Link
                    href={schemesIndex.url({ query: { state: 'to_approve' } })}
                    className="flex items-center justify-between rounded-lg border border-solid border-science bg-science-tint px-4 py-3 text-[14px] text-text hover:underline"
                >
                    {t(
                        ':count schemes in your department are waiting for your approval.',
                        { count: toApprove },
                    )}
                    <span aria-hidden>→</span>
                </Link>
            )}

            {scheme.last_note && (
                <div
                    className={`rounded-lg px-4 py-3 text-[14px] ${scheme.last_note.action === 'changes_requested' ? 'bg-warning-tint' : 'bg-surface'}`}
                >
                    <p className="text-[12px] text-text-muted">
                        {scheme.last_note.action === 'changes_requested'
                            ? t('Changes asked for')
                            : t('Note')}
                        {scheme.last_note.by && ` · ${scheme.last_note.by}`} ·{' '}
                        {dayMonth(scheme.last_note.on, false)}
                    </p>
                    <p className="text-text">“{scheme.last_note.note}”</p>
                </div>
            )}

            {(errors.scheme || errors.item || errors.week) && (
                <p className="text-[13px] text-danger">
                    {errors.scheme ?? errors.item ?? errors.week}
                </p>
            )}

            <div className="flex flex-col gap-6 xl:flex-row">
                <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[640px] flex-col">
                        <div
                            className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                        >
                            <span className="w-10 shrink-0">{t('Week')}</span>
                            <span className="w-[100px] shrink-0">
                                {t('Dates')}
                            </span>
                            <span className="flex-1">
                                {t('Topic and sub-topics')}
                            </span>
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
                                                {t(
                                                    ':name · kept free of new topics',
                                                    { name: week.free },
                                                )}
                                            </span>
                                        )}
                                        {[
                                            ...new Set(
                                                rows.map((item) => item.topic),
                                            ),
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
                                                                item.topic ===
                                                                topic,
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
                                                                {open ===
                                                                    item.id && (
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
                                            <span className="text-[12px] text-[#8A5A12]">
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
                                        className={`w-[60px] shrink-0 text-right font-mono text-[13px] leading-6 ${over ? 'text-[#8A5A12]' : 'text-text'}`}
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

                <aside className="flex shrink-0 flex-col gap-4 xl:w-[330px]">
                    {changing && !opening.free_changes && (
                        <p className="rounded-lg bg-warning-tint px-4 py-3 text-[13px] leading-[19px] text-text">
                            {t(
                                'Your scheme is approved. Moving or adding a sub-topic sends it back for approval.',
                            )}
                        </p>
                    )}
                    {editable && planning && (
                        <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                            <div className="flex items-center justify-between">
                                <span className={capsLabelClass}>
                                    {t('Not placed yet')}
                                </span>
                                <span className="font-mono text-[12px] text-[#8A5A12]">
                                    {t(':count left', {
                                        count: unplaced.length,
                                    })}
                                </span>
                            </div>
                            {unplaced.length === 0 && (
                                <p className="text-[13px] text-text-muted">
                                    {t('Everything is placed in a week.')}
                                </p>
                            )}
                            {topics.map((topic) => (
                                <div
                                    key={topic}
                                    className="flex flex-col gap-2"
                                >
                                    <span className="text-[14px] font-semibold text-text">
                                        {topic}
                                    </span>
                                    {unplaced
                                        .filter((item) => item.topic === topic)
                                        .map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between gap-2 rounded-md border border-solid border-border bg-white px-3 py-2"
                                            >
                                                <span className="min-w-0 flex-1 text-[13px] text-text">
                                                    {item.name ??
                                                        t('Whole topic')}
                                                    <span className="ml-2 font-mono text-[11px] text-text-muted">
                                                        {t(':count periods', {
                                                            count: item.periods,
                                                        })}
                                                    </span>
                                                </span>
                                                <WeekPicker
                                                    weeks={scheme.weeks}
                                                    value={null}
                                                    label={t('Place :label', {
                                                        label: itemLabel(item),
                                                    })}
                                                    onPick={(next) =>
                                                        move(item, next)
                                                    }
                                                />
                                            </div>
                                        ))}
                                </div>
                            ))}
                            {adding ? (
                                <div className="flex flex-col gap-2 border-t border-solid border-border pt-3">
                                    <input
                                        placeholder={t('Topic')}
                                        value={draft.topic}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                topic: e.target.value,
                                            })
                                        }
                                        className="h-8 rounded-md border border-solid border-border bg-white px-2 text-[13px] outline-none focus:border-primary"
                                    />
                                    <input
                                        placeholder={t('Sub-topic (optional)')}
                                        value={draft.name}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                name: e.target.value,
                                            })
                                        }
                                        className="h-8 rounded-md border border-solid border-border bg-white px-2 text-[13px] outline-none focus:border-primary"
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            aria-label={t('Periods')}
                                            inputMode="numeric"
                                            value={draft.periods}
                                            onChange={(e) =>
                                                setDraft({
                                                    ...draft,
                                                    periods:
                                                        Number(
                                                            e.target.value.replace(
                                                                /\D/g,
                                                                '',
                                                            ),
                                                        ) || 1,
                                                })
                                            }
                                            className="h-8 w-[56px] rounded-md border border-solid border-border bg-white px-2 font-mono text-[13px] outline-none focus:border-primary"
                                        />
                                        <span className="text-[12px] text-text-muted">
                                            {t('periods')}
                                        </span>
                                        <select
                                            value={draft.week}
                                            onChange={(e) =>
                                                setDraft({
                                                    ...draft,
                                                    week: e.target.value,
                                                })
                                            }
                                            className={smallSelect}
                                        >
                                            <option value="">
                                                {t('No week yet')}
                                            </option>
                                            {scheme.weeks.map((week) => (
                                                <option
                                                    key={week.week}
                                                    value={week.week}
                                                >
                                                    {t('Week :week', {
                                                        week: week.week,
                                                    })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {(errors.topic || errors.periods) && (
                                        <p className="text-[12px] text-danger">
                                            {errors.topic ?? errors.periods}
                                        </p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={addOwn}
                                            className={solidButtonClass}
                                        >
                                            {t('Add')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAdding(false)}
                                            className={outlineButtonClass}
                                        >
                                            {t('Cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAdding(true)}
                                    className="self-start text-[13px] font-medium text-primary hover:underline"
                                >
                                    {t('+ Add a sub-topic of your own')}
                                </button>
                            )}
                        </div>
                    )}

                    {!approved && (
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border p-4">
                            <span className="text-[14px] font-semibold text-text">
                                {t('Before you submit')}
                            </span>
                            <ul className="flex flex-col gap-2 text-[13px] leading-[19px] text-text">
                                <li className="flex gap-2">
                                    <span
                                        className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${unplaced.length === 0 ? 'bg-success' : 'bg-warning'}`}
                                    />
                                    {t(
                                        ':placed of :total sub-topics are placed.',
                                        { placed, total: scheme.items.length },
                                    )}
                                </li>
                                <li className="flex gap-2">
                                    <span
                                        className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${overfull.length === 0 ? 'bg-success' : 'bg-warning'}`}
                                    />
                                    {overfull.length === 0
                                        ? t(
                                              'No week has more periods than the timetable gives.',
                                          )
                                        : t(
                                              'Weeks :weeks have more periods than the timetable gives.',
                                              {
                                                  weeks: overfull
                                                      .map((week) => week.week)
                                                      .join(', '),
                                              },
                                          )}
                                </li>
                                <li className="flex gap-2">
                                    <span
                                        className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${inFree.length === 0 ? 'bg-success' : 'bg-warning'}`}
                                    />
                                    {inFree.length === 0
                                        ? t(
                                              'Test and exam weeks are free of new topics.',
                                          )
                                        : t(
                                              ':count sub-topics are in a test or exam week.',
                                              { count: inFree.length },
                                          )}
                                </li>
                            </ul>
                            <p className="text-[12px] text-text-muted">
                                {t(
                                    'You can submit with warnings. The approver sees them too.',
                                )}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                        <span className="text-[14px] font-semibold text-text">
                            {approved
                                ? t('Once approved')
                                : t('After you submit')}
                        </span>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {opening.approval === 'none'
                                ? t(
                                      'No approval is needed this term: the scheme is approved when you submit it. Then tick sub-topics as you teach them.',
                                  )
                                : t(
                                      'A head of department or the principal approves it, or sends it back with a note. Once approved, you tick sub-topics as taught, and a change needs approval again.',
                                  )}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(MyScheme);
