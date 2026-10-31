import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { changeStore } from '@/actions/App/Http/Controllers/SeriesChangeController';
import { index as students } from '@/actions/App/Http/Controllers/StudentRosterController';
import { show } from '@/actions/App/Http/Controllers/StudentController';
import {
    SeriesChips,
    coreOf,
    limits,
    poolOf,
    type SeriesOption,
    type SeriesSubject,
} from '../../components/series/ui';
import Breadcrumbs from '../../components/shell/breadcrumbs';
import {
    ErrorText,
    StreamChip,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface ChangeProps {
    yearLabel: string | null;
    student: {
        id: string;
        name: string;
        matricule: string;
        class: string | null;
    };
    current: {
        id: string;
        code: string;
        stream: string;
        taken: SeriesSubject[];
    };
    series: SeriesOption[];
    reasons: string[];
}

interface Outcome {
    id: string;
    name: string;
    change: string;
    result: 'Kept' | 'Dropped' | 'Added';
}

/** What happens to each subject when the student moves to `target`. */
function outcomes(taken: SeriesSubject[], target: SeriesOption): Outcome[] {
    const core = coreOf(target);
    const pool = poolOf(target);
    const rows: Outcome[] = taken.map((subject) => {
        const before = subject.kind.toUpperCase();

        if (core.some((other) => other.id === subject.id)) {
            return {
                id: subject.id,
                name: subject.name,
                change: `${before} → CORE`,
                result: 'Kept',
            };
        }

        if (pool.some((other) => other.id === subject.id)) {
            return {
                id: subject.id,
                name: subject.name,
                change:
                    before === 'ELECTIVE' ? 'ELECTIVE' : `${before} → ELECTIVE`,
                result: 'Kept',
            };
        }

        return {
            id: subject.id,
            name: subject.name,
            change: t(':before → none', { before }),
            result: 'Dropped',
        };
    });

    for (const subject of core) {
        if (!taken.some((other) => other.id === subject.id)) {
            rows.push({
                id: subject.id,
                name: subject.name,
                change: 'new → CORE',
                result: 'Added',
            });
        }
    }

    const order = { Kept: 0, Added: 1, Dropped: 2 };

    return rows.sort((a, b) => order[a.result] - order[b.result]);
}

function ChangeSeries({ student, current, series, reasons }: ChangeProps) {
    const form = useForm({
        series_id: '',
        reason: reasons[0] ?? '',
        note: '',
        parent_agreed: false,
    });
    const { data, setData, errors, processing } = form;
    const target = series.find((option) => option.id === data.series_id);
    const rows = target ? outcomes(current.taken, target) : [];
    const after = rows.filter((row) => row.result !== 'Dropped').length;
    const dropped = rows.filter((row) => row.result === 'Dropped');
    const belowMin = !!target && target.min !== null && after < target.min;

    function submit(event: FormEvent) {
        event.preventDefault();
        form.transform((values) => ({ ...values, note: values.note || null }));
        form.post(changeStore.url(student.id));
    }

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-6 lg:min-h-[calc(100vh-56px)]"
        >
            <Head
                title={t('Change series · :student', { student: student.name })}
            />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-[6px]">
                    <Breadcrumbs
                        trail={[
                            { label: t('Students'), href: students.url() },
                            { label: student.name, href: show.url(student.id) },
                            { label: t('Change series') },
                        ]}
                    />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {t('Change series')}
                    </h1>
                    <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-4 text-text-muted">
                        <span className="font-mono uppercase">
                            {[student.matricule, student.class]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                        <span>· {student.name}</span>
                    </p>
                </div>
                <Link
                    href={show.url(student.id)}
                    className={outlineButtonClass}
                >
                    {t('← Back to the student')}
                </Link>
            </div>

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-[34px] items-center gap-2 rounded-md border border-solid border-border bg-surface px-[14px] text-[13px] leading-4 text-text-muted">
                            {t('Now')}
                            <StreamChip stream={current.stream}>
                                {current.code}
                            </StreamChip>
                        </span>
                        <span
                            aria-hidden="true"
                            className="text-[16px] leading-5 text-text-muted"
                        >
                            →
                        </span>
                        <span className="text-[13px] leading-4 font-medium text-text">
                            {t('Move to')}
                        </span>
                        <SeriesChips
                            series={series}
                            value={data.series_id}
                            disabledId={current.id}
                            size="small"
                            onChange={(id) => setData('series_id', id)}
                        />
                    </div>
                    <ErrorText message={errors.series_id} />

                    <section className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                            <p className={capsLabelClass}>
                                {t('What changes in the subjects')}
                            </p>
                            {target && (
                                <span className="font-mono text-[12px] leading-4 text-text-muted">
                                    {target.code} · {limits(target, true)} ·{' '}
                                    {after}
                                    {target.max !== null
                                        ? ` / ${target.max}`
                                        : ''}
                                </span>
                            )}
                        </div>
                        {!target ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                {t(
                                    'Choose the series to move to. You will see which subjects are kept, added and dropped before anything changes.',
                                )}
                            </p>
                        ) : (
                            <ul className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                                {rows.map((row, position) => {
                                    const gone = row.result === 'Dropped';

                                    return (
                                        <li
                                            key={row.id}
                                            className={`flex min-h-[44px] shrink-0 items-center gap-3 border-b border-solid border-border px-4 last:border-b-0 ${
                                                gone
                                                    ? 'bg-danger-tint'
                                                    : position % 2 === 1
                                                      ? 'bg-row-alt'
                                                      : ''
                                            }`}
                                        >
                                            <span className="min-w-0 flex-1 text-[14px] leading-[18px] font-medium text-text">
                                                {row.name}
                                            </span>
                                            <span className="w-[120px] shrink-0 text-[11px] leading-[14px] font-semibold text-text-muted">
                                                {row.change}
                                            </span>
                                            <span className="flex w-[90px] shrink-0 items-center gap-[6px]">
                                                <span
                                                    className={`h-[6px] w-[6px] shrink-0 rounded-full ${gone ? 'bg-danger' : 'bg-success'}`}
                                                />
                                                <span
                                                    className={`text-[13px] leading-4 ${gone ? 'font-medium text-danger' : 'text-text'}`}
                                                >
                                                    {row.result}
                                                </span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {belowMin && target && (
                            <p className="text-[13px] leading-[19px] text-warning-text">
                                {t(
                                    'That leaves :after subjects, below the minimum of :target. After changing, add electives from Register one by one.',
                                    { after, target: target.min },
                                )}
                            </p>
                        )}
                    </section>

                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label
                                className={`flex flex-col gap-[6px] sm:w-[240px] ${fieldLabelClass}`}
                            >
                                {t('Reason')}
                                <select
                                    value={data.reason}
                                    onChange={(e) =>
                                        setData('reason', e.target.value)
                                    }
                                    className={`${fieldInputClass} text-[14px]`}
                                >
                                    {reasons.map((reason) => (
                                        <option key={reason}>{reason}</option>
                                    ))}
                                </select>
                                <ErrorText message={errors.reason} />
                            </label>
                            <label
                                className={`flex flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Note')}
                                <input
                                    type="text"
                                    maxLength={255}
                                    placeholder={t(
                                        'Wants to focus on humanities. Parent agreed on 3 Oct.',
                                    )}
                                    value={data.note}
                                    onChange={(e) =>
                                        setData('note', e.target.value)
                                    }
                                    className={`${fieldInputClass} text-[14px]`}
                                />
                                <ErrorText message={errors.note} />
                            </label>
                        </div>
                        <label className="flex cursor-pointer items-center gap-[10px] text-[13px] leading-[18px] text-text">
                            <input
                                type="checkbox"
                                checked={data.parent_agreed}
                                onChange={(e) =>
                                    setData('parent_agreed', e.target.checked)
                                }
                                className="h-[18px] w-[18px] shrink-0 accent-primary"
                            />
                            {t('A parent or guardian agreed to this change')}
                        </label>
                        <ErrorText message={errors.parent_agreed} />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Link
                            href={show.url(student.id)}
                            className={outlineButtonClass}
                        >
                            {t('Cancel')}
                        </Link>
                        <button
                            type="submit"
                            disabled={
                                !target || !data.parent_agreed || processing
                            }
                            className={solidButtonClass}
                        >
                            {t('Change series')}
                            {target
                                ? t(' to :code', { code: target.code })
                                : ''}
                        </button>
                    </div>
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[330px] lg:border-l lg:pl-7">
                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>
                            {t('What happens to marks')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text">
                            {dropped.length > 0
                                ? t(
                                      ':row: marks already entered stay on the record. ',
                                      {
                                          row: dropped
                                              .map((row) => row.name)
                                              .join(', '),
                                      },
                                  )
                                : ''}
                            {t(
                                'Results already published keep a dropped subject. Results not yet published leave it out of the average.',
                            )}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            {t('Who is told')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'Teachers of the dropped and added subjects see the change in their class lists. The timetable and marks sheets follow the new subjects.',
                            )}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-solid border-warning bg-warning-tint p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-warning-text">
                            {t('Do it early')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text">
                            {t(
                                'Changes after marks are open leave gaps in the subjects the student joins late.',
                            )}
                        </p>
                    </div>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Every change is kept in the student’s log, with the reason and who made it.',
                        )}
                    </p>
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(ChangeSeries);
