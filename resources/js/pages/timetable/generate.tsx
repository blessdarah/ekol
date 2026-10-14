import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    checks,
    generate,
} from '@/actions/App/Http/Controllers/TimetableController';
import { show as review } from '@/actions/App/Http/Controllers/TimetableReviewController';
import { ErrorText, capsLabelClass } from '../../components/structure/ui';
import {
    TickBox,
    TimetableHeader,
    type TimetablePhase,
    amberText,
    plural,
    primaryActionClass,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';
import { numberLocale, t } from '../../lib/i18n';

interface GenerateProps {
    phase: TimetablePhase;
    options: Record<string, boolean>;
    locked: number;
    onGrid: number;
    heavy: number;
    result: {
        placed: number;
        total: number;
        unplaced: number;
        clashes: number;
        free: number | null;
        seconds: number | null;
        at: string;
    } | null;
    issues: {
        type: string;
        count: number;
        title: string;
        detail: string;
        class_id: string | null;
    }[];
}

function Generate({
    phase,
    options: saved,
    locked,
    onGrid,
    heavy,
    result,
    issues,
}: GenerateProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [options, setOptions] = useState(saved);
    const [running, setRunning] = useState(false);
    const blocked = !phase.checks;
    const percent =
        result && result.total > 0 ? (result.placed / result.total) * 100 : 0;
    const toFix = issues.reduce((sum, issue) => sum + issue.count, 0);
    const choices: { key: string; label: string }[] = [
        {
            key: 'keep_placed',
            label: t(
                'Keep the :lesson already placed, and only place what is missing',
                { lesson: plural(onGrid, 'lesson') },
            ),
        },
        { key: 'spread', label: t('Spread each subject across the week') },
        {
            key: 'heavy_early',
            label: t(
                'Keep subjects with coefficient :heavy or more out of the last period',
                { heavy },
            ),
        },
        { key: 'doubles', label: t('Use double periods for practicals') },
        {
            key: 'compact',
            label: t('Keep each teacher’s lessons close together in the day'),
        },
    ];

    function run() {
        router.post(
            generate.url(),
            { options },
            {
                preserveScroll: true,
                onStart: () => setRunning(true),
                onFinish: () => setRunning(false),
            },
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Generate the timetable')} />
            <TimetableHeader
                page="generate"
                phase={phase}
                trail={[{ label: t('Generate') }]}
                title={t('Generate')}
                meta={
                    result
                        ? t(
                              'Draft version :draft · generated:seconds.:untouched',
                              {
                                  draft: phase.draft,
                                  seconds:
                                      result.seconds !== null
                                          ? ` in ${result.seconds < 1 ? 'under a second' : `${result.seconds} seconds`}`
                                          : '',
                                  untouched:
                                      phase.live !== null
                                          ? ` Live version ${phase.live} is untouched.`
                                          : '',
                              },
                          )
                        : t(
                              'Draft version :draft · not generated yet.:untouched',
                              {
                                  draft: phase.draft,
                                  untouched:
                                      phase.live !== null
                                          ? ` Live version ${phase.live} is untouched.`
                                          : '',
                              },
                          )
                }
                action={
                    result ? (
                        <>
                            <button
                                type="button"
                                disabled={running || blocked}
                                onClick={run}
                                className={quietActionClass}
                            >
                                {running
                                    ? t('Generating…')
                                    : t('Generate again')}
                            </button>
                            <Link
                                href={review.url()}
                                className={primaryActionClass}
                            >
                                {t('Review the timetable →')}
                            </Link>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled={running || blocked}
                            onClick={run}
                            className={primaryActionClass}
                        >
                            {running
                                ? t('Generating…')
                                : t('Generate the timetable')}
                        </button>
                    )
                }
            />

            {blocked && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
                    <p className="text-[13px] leading-[19px] text-text">
                        {t('The generator opens when the checks pass.')}{' '}
                        {plural(phase.blocking, 'problem')} {t('still')}
                        {phase.blocking === 1 ? t(' stops') : t(' stop')}{' '}
                        {t('it.')}
                    </p>
                    <Link
                        href={checks.url()}
                        className="text-[13px] leading-4 font-semibold text-primary hover:underline"
                    >
                        {t('Open Check inputs →')}
                    </Link>
                </div>
            )}
            <ErrorText message={errors.generate ?? errors.options} />

            {result && (
                <div className="flex flex-col gap-3 rounded-lg bg-surface p-4">
                    <div className="flex items-baseline gap-2">
                        <span className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text">
                            {new Intl.NumberFormat(numberLocale()).format(
                                result.placed,
                            )}
                        </span>
                        <span className="font-mono text-[13px] leading-4 text-text-muted">
                            {t('of')}{' '}
                            {new Intl.NumberFormat(numberLocale()).format(
                                result.total,
                            )}{' '}
                            {t('lessons placed ·')} {percent.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex h-[6px] overflow-clip rounded-full bg-warning">
                        <span
                            className="h-[6px] bg-success"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <div className="flex flex-wrap gap-x-7 gap-y-1 text-[13px] leading-4 text-text">
                        <span>
                            {t(':unplaced not placed', {
                                unplaced: result.unplaced,
                            })}
                        </span>
                        <span>
                            {plural(result.clashes, 'clash', 'clashes')}
                        </span>
                        {result.free !== null && (
                            <span>
                                {t(
                                    ':free free periods a day per teacher on average',
                                    { free: result.free },
                                )}
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-7 lg:flex-row">
                <section className="flex shrink-0 flex-col gap-3 lg:w-[400px]">
                    <p className={capsLabelClass}>
                        {t('What the generator is told')}
                    </p>
                    <ul className="flex flex-col border-t border-solid border-border">
                        <li className="border-b border-solid border-border py-[10px]">
                            <TickBox
                                checked
                                disabled
                                onChange={() => undefined}
                            >
                                {t('Keep the')} {plural(locked, 'lesson')}{' '}
                                {t('you locked')}
                            </TickBox>
                        </li>
                        {choices.map((choice) => (
                            <li
                                key={choice.key}
                                className="border-b border-solid border-border py-[10px]"
                            >
                                <TickBox
                                    checked={options[choice.key] ?? false}
                                    disabled={
                                        choice.key === 'keep_placed' &&
                                        onGrid === 0
                                    }
                                    onChange={(next) =>
                                        setOptions({
                                            ...options,
                                            [choice.key]: next,
                                        })
                                    }
                                >
                                    {t(choice.label)}
                                </TickBox>
                            </li>
                        ))}
                    </ul>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t('Change an option and press Generate')}
                        {result ? t(' again') : ''}
                        {t(
                            '. Locked lessons stay where they are every time. Nobody is ever placed in two rooms at once.',
                        )}
                    </p>
                </section>

                <section className="flex min-w-0 flex-1 flex-col gap-3">
                    <p className={capsLabelClass}>
                        {t('What is left for you · :to_fix', { to_fix: toFix })}
                    </p>
                    {!result ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            {t(
                                'Nothing has been generated yet. Lessons the generator cannot place will be listed here.',
                            )}
                        </p>
                    ) : issues.length === 0 ? (
                        <p className="flex items-center gap-2 rounded-md bg-success-tint p-4 text-[13px] leading-[19px] text-text">
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                            {t(
                                'Every lesson is placed and nothing clashes. Look it over in Review, then publish.',
                            )}
                        </p>
                    ) : (
                        <>
                            <ul className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                                {issues.map((issue, position) => (
                                    <li
                                        key={`${issue.title}-${position}`}
                                        className="border-b border-solid border-border last:border-b-0"
                                    >
                                        <Link
                                            href={review.url(
                                                issue.class_id
                                                    ? {
                                                          query: {
                                                              view: 'class',
                                                              id: issue.class_id,
                                                          },
                                                      }
                                                    : undefined,
                                            )}
                                            className={`flex min-h-12 items-center gap-3 px-[14px] py-2 hover:bg-surface ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                        >
                                            <span
                                                className={`flex h-[22px] shrink-0 items-center rounded-full px-2 text-[12px] leading-4 font-medium ${
                                                    issue.type === 'clash'
                                                        ? 'bg-danger-tint text-danger'
                                                        : `bg-warning-tint ${amberText}`
                                                }`}
                                            >
                                                {issue.type === 'clash'
                                                    ? t('Clash')
                                                    : t(':issue not placed', {
                                                          issue: issue.count,
                                                      })}
                                            </span>
                                            <span className="flex min-w-0 flex-col">
                                                <span className="text-[14px] leading-[18px] font-medium text-text">
                                                    {t(issue.title)}
                                                </span>
                                                <span className="text-[12px] leading-4 text-text-muted">
                                                    {issue.detail}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {t(
                                    'All :to_fix are fixed in the timetable itself: move a lesson to a free slot, or change its teacher or room.',
                                    { to_fix: toFix },
                                )}
                            </p>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}

export default withAppShell(Generate);
