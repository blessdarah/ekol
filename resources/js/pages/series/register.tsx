import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    index,
    one,
    register,
} from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import Breadcrumbs from '../../components/shell/breadcrumbs';
import {
    SeriesChips,
    choiceProblem,
    coreOf,
    limits,
    poolOf,
    type SeriesOption,
} from '../../components/series/ui';
import {
    ErrorText,
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface RegisterProps {
    yearLabel: string | null;
    hasTerm: boolean;
    level: { id: string; name: string };
    counts: { total: number; unassigned: number };
    tab: 'unassigned' | 'registered';
    q: string;
    students: { id: string; name: string; matricule: string }[];
    student: {
        id: string;
        name: string;
        matricule: string;
        class: string | null;
        series_id: string | null;
        electives: string[];
    } | null;
    nextId: string | null;
    series: SeriesOption[];
    teachers: Record<string, string>;
}

function RegisterOne({
    hasTerm,
    level,
    counts,
    tab,
    q,
    students,
    student,
    nextId,
    series,
    teachers,
}: RegisterProps) {
    const [seriesId, setSeriesId] = useState(student?.series_id ?? '');
    const [electives, setElectives] = useState<string[]>(
        student?.electives ?? [],
    );
    const [search, setSearch] = useState(q);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chosen = series.find((option) => option.id === seriesId);
    const core = chosen ? coreOf(chosen) : [];
    const pool = chosen ? poolOf(chosen) : [];
    const total = core.length + electives.length;
    const problem = chosen ? choiceProblem(chosen, electives.length) : null;
    const room =
        chosen?.max !== null && chosen?.max !== undefined
            ? chosen.max - total
            : null;

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    function visit(patch: { tab?: string; q?: string; student?: string }) {
        const query: Record<string, string> = {
            level: level.id,
            tab: patch.tab ?? tab,
        };
        const text = patch.q ?? search;

        if (text) {
            query.q = text;
        }
        if (patch.student) {
            query.student = patch.student;
        }

        router.get(one.url({ query }), {}, { preserveScroll: true });
    }

    function onSearch(value: string) {
        setSearch(value);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(
            () =>
                router.get(
                    one.url({
                        query: {
                            level: level.id,
                            tab,
                            ...(value.trim() ? { q: value.trim() } : {}),
                            ...(student ? { student: student.id } : {}),
                        },
                    }),
                    {},
                    {
                        preserveState: true,
                        preserveScroll: true,
                        replace: true,
                    },
                ),
            300,
        );
    }

    function chooseSeries(id: string) {
        const next = series.find((option) => option.id === id);
        const allowed = next ? poolOf(next).map((subject) => subject.id) : [];

        setSeriesId(id);
        setElectives(electives.filter((subject) => allowed.includes(subject)));
        setErrors({});
    }

    function toggle(id: string) {
        setElectives(
            electives.includes(id)
                ? electives.filter((subject) => subject !== id)
                : [...electives, id],
        );
    }

    function submit() {
        if (!student) {
            return;
        }

        setSaving(true);
        router.post(
            register.url(),
            {
                student_id: student.id,
                series_id: seriesId,
                electives,
                next_id: tab === 'unassigned' ? nextId : null,
            },
            {
                // The next student must start from a clean form.
                preserveState: 'errors',
                onError: (failed) => setErrors(failed),
                onFinish: () => setSaving(false),
            },
        );
    }

    return (
        <div className="flex flex-col lg:min-h-[calc(100vh-56px)] lg:flex-row">
            <Head title={student ? student.name : t('Register one by one')} />

            <aside className="flex shrink-0 flex-col border-solid border-border lg:-my-7 lg:-ml-10 lg:w-[300px] lg:border-r">
                <div className="flex flex-col gap-[14px] border-b border-solid border-border px-5 pt-7 pb-4">
                    <div className="flex items-baseline justify-between">
                        <h2 className="font-display text-[20px] leading-6 font-bold tracking-[-0.01em] text-text">
                            {level.name}
                        </h2>
                        <span className="text-[13px] leading-4 text-text-muted">
                            {t(':total students', { total: counts.total })}
                        </span>
                    </div>
                    <div className="flex rounded-md bg-surface p-[3px]">
                        {[
                            {
                                value: 'unassigned',
                                label: t('Unassigned · :unassigned', {
                                    unassigned: counts.unassigned,
                                }),
                            },
                            { value: 'registered', label: t('Registered') },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={tab === option.value}
                                onClick={() => visit({ tab: option.value })}
                                className={`flex h-7 flex-1 items-center justify-center rounded-[6px] text-[13px] leading-4 ${
                                    tab === option.value
                                        ? 'bg-white font-semibold text-text shadow-[0_1px_2px_rgba(16,25,21,0.08)]'
                                        : 'font-medium text-text-muted hover:text-text'
                                }`}
                            >
                                {t(option.label)}
                            </button>
                        ))}
                    </div>
                    <label className="flex h-[34px] shrink-0 items-center gap-2 rounded-md border border-solid border-border px-[10px] focus-within:border-primary">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            className="shrink-0"
                        >
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                                fill="none"
                                stroke="#56625C"
                                strokeWidth="2"
                            />
                            <path
                                d="M20 20l-3.5-3.5"
                                fill="none"
                                stroke="#56625C"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                        <input
                            type="search"
                            aria-label={t('Search students')}
                            placeholder={t('Search by name or matricule')}
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted"
                        />
                    </label>
                </div>
                <ul className="flex max-h-[60vh] flex-col gap-[2px] overflow-y-auto p-2 lg:max-h-none lg:flex-1">
                    {students.length === 0 && (
                        <li className="px-3 py-4 text-[13px] leading-[19px] text-text-muted">
                            {tab === 'unassigned'
                                ? t(
                                      'Nobody in :level is waiting for a series.',
                                      { level: level.name },
                                  )
                                : t('Nobody is registered yet.')}
                        </li>
                    )}
                    {students.map((item) => {
                        const selected = item.id === student?.id;

                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    aria-current={selected ? 'true' : undefined}
                                    onClick={() => visit({ student: item.id })}
                                    className={`flex w-full items-center gap-[10px] rounded-md px-3 py-[10px] text-left ${selected ? 'bg-primary-tint' : 'hover:bg-surface'}`}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span
                                            className={`truncate text-[14px] leading-[18px] text-text ${selected ? 'font-semibold' : 'font-medium'}`}
                                        >
                                            {item.name}
                                        </span>
                                        <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                            {item.matricule}
                                        </span>
                                    </span>
                                    {selected && (
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            className="shrink-0"
                                        >
                                            <path
                                                d="M9 6l6 6-6 6"
                                                fill="none"
                                                stroke="#0E4D3A"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-7 pt-7 lg:pt-0 lg:pl-10">
                <div className="flex flex-col gap-[6px]">
                    <Breadcrumbs
                        trail={[
                            {
                                label: t('Series Registration'),
                                href: index.url({ query: { level: level.id } }),
                            },
                            { label: t('Register one by one') },
                            { label: level.name },
                        ]}
                    />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {student ? student.name : t('Everyone is registered')}
                    </h1>
                    {student && (
                        <p className="font-mono text-[13px] leading-4 text-text-muted">
                            {[student.matricule, student.class]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    )}
                </div>

                {!student ? (
                    <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-4">
                        <p className="text-[13px] leading-[19px] text-text">
                            {t(
                                'No :level student is waiting for a series. Open the Registered list to change someone’s electives.',
                                { level: level.name },
                            )}
                        </p>
                        <Link
                            href={index.url({ query: { level: level.id } })}
                            className={outlineButtonClass}
                        >
                            {t('Back to overview')}
                        </Link>
                    </div>
                ) : (
                    <>
                        <section className="flex flex-col gap-3">
                            <p className={capsLabelClass}>
                                {t('1 · Choose a series')}
                            </p>
                            {series.length === 0 ? (
                                <p className="text-[13px] leading-[19px] text-warning">
                                    {t(
                                        ':level has no series yet. Add them under Series setup.',
                                        { level: level.name },
                                    )}
                                </p>
                            ) : (
                                <SeriesChips
                                    series={series}
                                    value={seriesId}
                                    labelled
                                    onChange={chooseSeries}
                                />
                            )}
                            <ErrorText message={errors.series_id} />
                        </section>

                        {chosen && (
                            <section className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-end justify-between gap-2">
                                    <p className={capsLabelClass}>
                                        {t('2 · Subjects for :code', {
                                            code: chosen.code,
                                        })}
                                    </p>
                                    <div className="flex items-center gap-[10px]">
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {limits(chosen)}
                                        </span>
                                        {chosen.max !== null && (
                                            <span
                                                aria-hidden="true"
                                                className="flex gap-[3px]"
                                            >
                                                {Array.from(
                                                    { length: chosen.max },
                                                    (_, position) => (
                                                        <span
                                                            key={position}
                                                            className={`h-[6px] w-[18px] shrink-0 rounded-[2px] ${position < total ? 'bg-primary' : 'bg-border'}`}
                                                        />
                                                    ),
                                                )}
                                            </span>
                                        )}
                                        <span className="font-mono text-[14px] leading-[18px] text-text">
                                            {total}
                                            {chosen.max !== null
                                                ? `/${chosen.max}`
                                                : ''}
                                        </span>
                                    </div>
                                </div>
                                <ul className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                                    {core.map((subject) => (
                                        <li
                                            key={subject.id}
                                            className="flex min-h-[52px] shrink-0 items-center gap-[14px] border-b border-solid border-border bg-surface px-4 last:border-b-0"
                                        >
                                            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm bg-text-muted">
                                                <svg
                                                    width="11"
                                                    height="11"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <rect
                                                        x="5"
                                                        y="11"
                                                        width="14"
                                                        height="10"
                                                        rx="2"
                                                        fill="none"
                                                        stroke="#FFFFFF"
                                                        strokeWidth="3"
                                                    />
                                                    <path
                                                        d="M8 11V7a4 4 0 018 0v4"
                                                        fill="none"
                                                        stroke="#FFFFFF"
                                                        strokeWidth="3"
                                                    />
                                                </svg>
                                            </span>
                                            <span className="min-w-0 flex-1 text-[14px] leading-[18px] font-medium text-text">
                                                {subject.name}
                                            </span>
                                            <span className="flex w-20 shrink-0">
                                                <span className="flex h-[22px] items-center rounded-sm border border-solid border-text px-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text">
                                                    {t('CORE')}
                                                </span>
                                            </span>
                                            <Teacher
                                                name={teachers[subject.id]}
                                            />
                                        </li>
                                    ))}
                                    {pool.map((subject) => {
                                        const on = electives.includes(
                                            subject.id,
                                        );

                                        return (
                                            <li
                                                key={subject.id}
                                                className="border-b border-solid border-border last:border-b-0"
                                            >
                                                <label className="flex min-h-[52px] cursor-pointer items-center gap-[14px] px-4 hover:bg-row-alt">
                                                    <input
                                                        type="checkbox"
                                                        checked={on}
                                                        onChange={() =>
                                                            toggle(subject.id)
                                                        }
                                                        className="h-[18px] w-[18px] shrink-0 accent-primary"
                                                    />
                                                    <span
                                                        className={`min-w-0 flex-1 text-[14px] leading-[18px] text-text ${on ? 'font-medium' : ''}`}
                                                    >
                                                        {subject.name}
                                                    </span>
                                                    <span className="flex w-20 shrink-0">
                                                        <span className="flex h-[22px] items-center rounded-sm border border-dashed border-text-muted px-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted">
                                                            {t('ELECTIVE')}
                                                        </span>
                                                    </span>
                                                    <Teacher
                                                        name={
                                                            teachers[subject.id]
                                                        }
                                                    />
                                                </label>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <ErrorText message={errors.electives} />
                            </section>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <p
                                className={`text-[13px] leading-4 ${problem ? 'text-[#8A5A12]' : 'text-text-muted'}`}
                            >
                                {!chosen
                                    ? t('Choose a series to see its subjects.')
                                    : (problem ??
                                      (room === null
                                          ? t(
                                                'Core subjects are locked. Tick the electives this student takes.',
                                            )
                                          : room > 0
                                            ? t(
                                                  'You can add :room more :electives.',
                                                  {
                                                      room,
                                                      electives:
                                                          room === 1
                                                              ? 'elective'
                                                              : 'electives',
                                                  },
                                              )
                                            : t(
                                                  'That is the most subjects this series allows.',
                                              )))}
                            </p>
                            <div className="flex gap-2">
                                {tab === 'unassigned' && nextId && (
                                    <Link
                                        href={one.url({
                                            query: {
                                                level: level.id,
                                                student: nextId,
                                            },
                                        })}
                                        className={outlineButtonClass}
                                    >
                                        {t('Skip')}
                                    </Link>
                                )}
                                <button
                                    type="button"
                                    disabled={
                                        !chosen ||
                                        !!problem ||
                                        saving ||
                                        !hasTerm
                                    }
                                    onClick={submit}
                                    className={solidButtonClass}
                                >
                                    {student.series_id
                                        ? t('Save subjects')
                                        : nextId
                                          ? t('Register & next student')
                                          : t('Register student')}
                                    {!student.series_id && nextId && (
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                d="M5 12h14M13 6l6 6-6 6"
                                                fill="none"
                                                stroke="#FFFFFF"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        {!hasTerm && (
                            <p className="text-[13px] leading-[19px] text-warning">
                                {t(
                                    'No term is active, so nothing can be saved. Make a term active in School Setup.',
                                )}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function Teacher({ name }: { name?: string }) {
    return (
        <span
            className={`w-40 shrink-0 truncate text-[13px] leading-4 ${name ? 'text-text-muted' : 'text-warning'}`}
        >
            {name ?? t('No teacher assigned')}
        </span>
    );
}

export default withAppShell(RegisterOne);
