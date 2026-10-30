import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { index as applications } from '@/actions/App/Http/Controllers/ApplicationController';
import {
    clearClass,
    confirm,
    place,
    placeAll,
    placement,
    reEnrolment,
    storeClass,
} from '@/actions/App/Http/Controllers/EnrolmentController';
import {
    CheckLine,
    EnrolmentHeader,
    type EnrolmentProgress,
    FillBar,
    amberText,
    count,
    linkClass,
    listed,
} from '../../components/enrolment/ui';
import {
    ErrorText,
    capsLabelClass,
    outlineButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

type Kind = 'promoted' | 'repeating' | 'new';

interface PlacementProps {
    enrolment: EnrolmentProgress;
    levels: { id: string; name: string; over: boolean; waiting: number }[];
    level: {
        id: string;
        name: string;
        classes: number;
        seats: number;
        expected: number;
        placed: number;
    } | null;
    waiting: {
        id: string;
        name: string | null;
        kind: Kind;
        from: string | null;
    }[];
    classes: {
        id: string;
        name: string;
        capacity: number;
        placed: number;
        promoted: number;
        repeating: number;
        new: number;
    }[];
}

const KINDS: { key: Kind; label: string }[] = [
    { key: 'promoted', label: 'Promoted' },
    { key: 'repeating', label: 'Repeating' },
    { key: 'new', label: 'New' },
];

function Placement({
    enrolment,
    levels,
    level,
    waiting,
    classes,
}: PlacementProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [picked, setPicked] = useState<string[]>([]);
    const [kind, setKind] = useState<Kind | 'all'>('all');
    const [target, setTarget] = useState('');

    const selected = picked.filter((id) =>
        waiting.some((row) => row.id === id),
    );
    const shown = waiting.filter((row) => kind === 'all' || row.kind === kind);
    const withRoom = classes.filter(
        (option) => option.placed < option.capacity,
    );
    const targetId = classes.some((option) => option.id === target)
        ? target
        : (withRoom[0]?.id ?? classes[0]?.id ?? '');
    const targetClass = classes.find((option) => option.id === targetId);
    const allShown =
        shown.length > 0 && shown.every((row) => selected.includes(row.id));
    const freeSeats = classes.reduce(
        (sum, option) => sum + Math.max(0, option.capacity - option.placed),
        0,
    );

    function toggle(id: string) {
        setPicked(
            selected.includes(id)
                ? selected.filter((item) => item !== id)
                : [...selected, id],
        );
    }

    function toggleAll() {
        const ids = shown.map((row) => row.id);

        setPicked(
            allShown
                ? selected.filter((id) => !ids.includes(id))
                : [...new Set([...selected, ...ids])],
        );
    }

    function placeSelected() {
        router.post(
            place.url(),
            { class_id: targetId, enrolment_ids: selected },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setPicked([]),
            },
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Class placement')} />
            <EnrolmentHeader
                progress={enrolment}
                trail={[{ label: t('Class placement') }]}
                title={t('Class placement')}
                meta={t(
                    'give every promoted, repeating and admitted student a class',
                )}
                action={
                    level &&
                    waiting.length > 0 &&
                    classes.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    placeAll.url(),
                                    { level_id: level.id },
                                    { preserveScroll: true },
                                )
                            }
                            className={outlineButtonClass}
                        >
                            {t('Place')}{' '}
                            {count(Math.min(waiting.length, freeSeats))}{' '}
                            {level.name}{' '}
                            {Math.min(waiting.length, freeSeats) === 1
                                ? t('student')
                                : t('students')}{' '}
                            {t('automatically')}
                        </button>
                    )
                }
            />

            {!level ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'Nobody is waiting for a class yet. Students appear here once they are promoted or repeating under',
                    )}{' '}
                    <Link
                        href={reEnrolment.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Promotion')}
                    </Link>
                    {t(', or admitted under')}{' '}
                    <Link
                        href={applications.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Admissions')}
                    </Link>
                    .
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {levels.map((option) => {
                            const active = option.id === level.id;

                            return (
                                <Link
                                    key={option.id}
                                    href={placement.url({
                                        query: { level: option.id },
                                    })}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                        active
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-border font-medium text-text hover:bg-surface'
                                    }`}
                                >
                                    {option.over && (
                                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-danger" />
                                    )}
                                    {option.name}
                                    {!option.over && option.waiting > 0 && (
                                        <span className="font-mono text-[11px] text-text-muted">
                                            {count(option.waiting)}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>

                    {(level.expected > level.seats || classes.length === 0) && (
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
                            <p className="min-w-0 flex-1 text-[13px] leading-[19px] text-text">
                                {classes.length === 0
                                    ? t(
                                          ':level has no classes in :year yet. Add one to start placing.',
                                          {
                                              level: level.name,
                                              year: enrolment.year,
                                          },
                                      )
                                    : t(
                                          ':level has :expected students for :seats seats. Add a class or raise the class size, or some students will have no seat.',
                                          {
                                              level: level.name,
                                              expected: count(level.expected),
                                              seats: count(level.seats),
                                          },
                                      )}
                            </p>
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        storeClass.url(level.id),
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                                className="flex h-8 shrink-0 items-center rounded-md border border-solid border-border bg-white px-[14px] text-[13px] leading-4 font-medium text-text hover:bg-surface"
                            >
                                {t('Add a class to :level', {
                                    level: level.name,
                                })}
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col gap-6 lg:flex-row">
                        <div className="flex shrink-0 flex-col gap-3 lg:w-[400px]">
                            <div className="flex items-baseline justify-between">
                                <p className={capsLabelClass}>
                                    {t('Waiting for a class · :waiting', {
                                        waiting: count(waiting.length),
                                    })}
                                </p>
                                <p className="text-[13px] leading-4 text-text-muted">
                                    {t(':selected selected', {
                                        selected: selected.length,
                                    })}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-[6px]">
                                {[
                                    { key: 'all' as const, label: t('All') },
                                    ...KINDS,
                                ].map((option) => {
                                    const active = kind === option.key;
                                    const total =
                                        option.key === 'all'
                                            ? null
                                            : waiting.filter(
                                                  (row) =>
                                                      row.kind === option.key,
                                              ).length;

                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setKind(option.key)}
                                            className={`flex h-[26px] items-center rounded-full border border-solid px-[10px] text-[12px] leading-4 ${
                                                active
                                                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                    : 'border-border text-text hover:bg-surface'
                                            }`}
                                        >
                                            {t(option.label)}
                                            {total !== null &&
                                                ` · ${count(total)}`}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex max-h-[440px] flex-col overflow-y-auto rounded-lg border border-solid border-border">
                                {shown.length === 0 ? (
                                    <p className="px-3 py-4 text-[13px] leading-[19px] text-text-muted">
                                        {waiting.length === 0
                                            ? t(
                                                  'Every :level student has a class.',
                                                  { level: level.name },
                                              )
                                            : t(
                                                  'Nobody of this kind is waiting.',
                                              )}
                                    </p>
                                ) : (
                                    <>
                                        <label className="flex h-9 shrink-0 cursor-pointer items-center gap-[10px] border-b border-solid border-border bg-surface px-3 text-[12px] leading-4 text-text-muted">
                                            <input
                                                type="checkbox"
                                                checked={allShown}
                                                onChange={toggleAll}
                                                className="h-[18px] w-[18px] shrink-0 accent-primary"
                                            />
                                            {t('Select all')}{' '}
                                            {count(shown.length)}
                                        </label>
                                        {shown.map((row) => {
                                            const on = selected.includes(
                                                row.id,
                                            );

                                            return (
                                                <label
                                                    key={row.id}
                                                    className={`flex h-11 shrink-0 cursor-pointer items-center gap-[10px] border-b border-solid border-border px-3 last:border-b-0 ${on ? 'bg-primary-tint' : 'hover:bg-surface'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={on}
                                                        onChange={() =>
                                                            toggle(row.id)
                                                        }
                                                        className="h-[18px] w-[18px] shrink-0 accent-primary"
                                                    />
                                                    <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium text-text">
                                                        {row.name}
                                                    </span>
                                                    {row.kind === 'promoted' ? (
                                                        <span className="shrink-0 text-[12px] leading-4 text-text-muted">
                                                            {t('From :from', {
                                                                from: row.from,
                                                            })}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={`flex h-5 shrink-0 items-center rounded-sm px-[6px] text-[11px] leading-[14px] font-medium ${
                                                                row.kind ===
                                                                'repeating'
                                                                    ? `bg-warning-tint ${amberText}`
                                                                    : 'bg-science-tint text-science'
                                                            }`}
                                                        >
                                                            {row.kind ===
                                                            'repeating'
                                                                ? t(
                                                                      'Repeating :level',
                                                                      {
                                                                          level: level.name,
                                                                      },
                                                                  )
                                                                : t(
                                                                      'New student',
                                                                  )}
                                                        </span>
                                                    )}
                                                </label>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    aria-label={t('Class to place in')}
                                    value={targetId}
                                    onChange={(e) => setTarget(e.target.value)}
                                    disabled={classes.length === 0}
                                    className="h-9 min-w-0 flex-1 rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary disabled:opacity-50"
                                >
                                    {classes.length === 0 && (
                                        <option value="">
                                            {t('No classes yet')}
                                        </option>
                                    )}
                                    {classes.map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.name} · {option.placed} /{' '}
                                            {option.capacity}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    disabled={
                                        selected.length === 0 || !targetClass
                                    }
                                    onClick={placeSelected}
                                    className="flex h-9 shrink-0 items-center rounded-md border border-solid border-primary bg-white px-4 text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint disabled:opacity-50"
                                >
                                    {t('Place')}{' '}
                                    {selected.length > 0
                                        ? count(selected.length)
                                        : ''}{' '}
                                    {t('in class')}
                                </button>
                            </div>
                            <ErrorText
                                message={
                                    errors.class_id ??
                                    errors.enrolment_ids ??
                                    errors.level_id ??
                                    errors.class
                                }
                            />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <p className={capsLabelClass}>
                                {t(
                                    ':level classes · :placed of :expected placed',
                                    {
                                        level: level.name,
                                        placed: count(level.placed),
                                        expected: count(level.expected),
                                    },
                                )}
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {classes.map((option) => {
                                    const receiving =
                                        option.id === targetId &&
                                        selected.length > 0;
                                    const parts = [
                                        option.promoted > 0
                                            ? t(':promoted promoted', {
                                                  promoted: option.promoted,
                                              })
                                            : null,
                                        option.repeating > 0
                                            ? t(':repeating repeating', {
                                                  repeating: option.repeating,
                                              })
                                            : null,
                                        option.new > 0
                                            ? t(':new new', { new: option.new })
                                            : null,
                                    ].filter(Boolean);

                                    return (
                                        <div
                                            key={option.id}
                                            className={`flex flex-col gap-[10px] rounded-lg border border-solid p-[14px] ${
                                                receiving
                                                    ? 'border-primary bg-primary-tint'
                                                    : 'border-border'
                                            }`}
                                        >
                                            <div className="flex items-baseline justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setTarget(option.id)
                                                    }
                                                    className="font-display text-[18px] leading-6 font-bold text-text hover:underline"
                                                >
                                                    {option.name}
                                                </button>
                                                <span className="font-mono text-[13px] leading-4 text-text">
                                                    {option.placed} /{' '}
                                                    {option.capacity}
                                                </span>
                                            </div>
                                            <FillBar
                                                value={option.placed}
                                                max={option.capacity}
                                                track={
                                                    receiving
                                                        ? 'bg-white'
                                                        : 'bg-border'
                                                }
                                            />
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-[12px] leading-4 text-text-muted">
                                                    {receiving
                                                        ? t(
                                                              'Receiving the :selected selected',
                                                              {
                                                                  selected:
                                                                      count(
                                                                          selected.length,
                                                                      ),
                                                              },
                                                          )
                                                        : parts.length > 0
                                                          ? parts.join(' · ')
                                                          : t('Empty')}
                                                </span>
                                                {option.placed > 0 &&
                                                    !enrolment.confirmed && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                router.post(
                                                                    clearClass.url(),
                                                                    {
                                                                        class_id:
                                                                            option.id,
                                                                    },
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                            className="shrink-0 text-[12px] leading-4 font-medium text-primary hover:underline"
                                                        >
                                                            {t(
                                                                'Send back to waiting',
                                                            )}
                                                        </button>
                                                    )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                                        {enrolment.confirmed
                                            ? t('Enrolment is confirmed')
                                            : t(
                                                  'Before enrolment can be confirmed',
                                              )}
                                    </p>
                                    {enrolment.ready || enrolment.confirmed ? (
                                        <Link
                                            href={confirm.url()}
                                            className="flex h-8 items-center rounded-md bg-primary px-[14px] text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover"
                                        >
                                            {enrolment.confirmed
                                                ? t('Open confirmation')
                                                : t('Confirm enrolment')}
                                        </Link>
                                    ) : (
                                        <span
                                            aria-disabled="true"
                                            className="flex h-8 items-center rounded-md border border-solid border-border bg-white px-[14px] text-[13px] leading-4 font-semibold text-text opacity-50"
                                        >
                                            {t('Confirm enrolment')}
                                        </span>
                                    )}
                                </div>
                                <ul className="flex flex-col gap-[10px]">
                                    <CheckLine done={enrolment.undecided === 0}>
                                        {enrolment.undecided === 0 ? (
                                            t(
                                                'Every continuing student is decided',
                                            )
                                        ) : (
                                            <>
                                                {count(enrolment.undecided)}{' '}
                                                {t('continuing')}{' '}
                                                {enrolment.undecided === 1
                                                    ? t('student is')
                                                    : t('students are')}{' '}
                                                {t('not decided →')}{' '}
                                                <Link
                                                    href={reEnrolment.url()}
                                                    className={linkClass}
                                                >
                                                    {t('Promotion')}
                                                </Link>
                                            </>
                                        )}
                                    </CheckLine>
                                    <CheckLine done={enrolment.to_review === 0}>
                                        {enrolment.to_review === 0 ? (
                                            t('Every application has an answer')
                                        ) : (
                                            <>
                                                {count(enrolment.to_review)}{' '}
                                                {enrolment.to_review === 1
                                                    ? t('application is')
                                                    : t(
                                                          'applications are',
                                                      )}{' '}
                                                {t('still to review →')}{' '}
                                                <Link
                                                    href={applications.url({
                                                        query: {
                                                            stage: 'to_review',
                                                        },
                                                    })}
                                                    className={linkClass}
                                                >
                                                    {t('Admissions')}
                                                </Link>
                                            </>
                                        )}
                                    </CheckLine>
                                    <CheckLine
                                        done={
                                            enrolment.over_levels.length ===
                                                0 &&
                                            enrolment.unplaced === 0 &&
                                            enrolment.expected > 0
                                        }
                                    >
                                        {enrolment.over_levels.length > 0
                                            ? t(
                                                  ':over_levels :have more students than seats → Add a class',
                                                  {
                                                      over_levels: listed(
                                                          enrolment.over_levels,
                                                      ),
                                                      have:
                                                          enrolment.over_levels
                                                              .length === 1
                                                              ? 'has'
                                                              : 'have',
                                                  },
                                              )
                                            : enrolment.unplaced > 0
                                              ? t(
                                                    ':unplaced :are still waiting for a class',
                                                    {
                                                        unplaced: count(
                                                            enrolment.unplaced,
                                                        ),
                                                        are:
                                                            enrolment.unplaced ===
                                                            1
                                                                ? 'student is'
                                                                : 'students are',
                                                    },
                                                )
                                              : enrolment.expected > 0
                                                ? t('Every student has a class')
                                                : t(
                                                      'Nobody is headed for next year yet',
                                                  )}
                                    </CheckLine>
                                    <CheckLine done={enrolment.has_fee_plan}>
                                        {enrolment.has_fee_plan
                                            ? t('The :year fee plan is set', {
                                                  year: enrolment.year,
                                              })
                                            : t(
                                                  'No :year fee plan yet, so confirming bills nothing',
                                                  { year: enrolment.year },
                                              )}
                                    </CheckLine>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(Placement);
