import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { show as schoolSetup } from '@/actions/App/Http/Controllers/SetupController';
import { index as changes } from '@/actions/App/Http/Controllers/TimetableChangeController';
import {
    checks,
    generator,
    publishing,
    setup,
} from '@/actions/App/Http/Controllers/TimetableController';
import { show as review } from '@/actions/App/Http/Controllers/TimetableReviewController';
import Breadcrumbs from '../../components/shell/breadcrumbs';
import { capsLabelClass } from '../../components/structure/ui';
import { shortDate } from '../../components/students/ui';
import {
    CheckMark,
    NoTerm,
    type StepKey,
    TimetableHeader,
    type TimetablePhase,
    linkClass,
    plural,
    primaryActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';
import { numberLocale, t } from '../../lib/i18n';

interface OverviewProps {
    phase: TimetablePhase | null;
    summary?: {
        lessons: number;
        classes: number;
        teachers: number;
        rooms: number;
    };
    setupLine?: string;
    warnings?: number;
    firstProblem?: string | null;
    live?: { number: number; published: string | null } | null;
}

function Stage({
    state,
    title,
    children,
    action,
}: {
    state: 'done' | 'current' | 'waiting';
    title: string;
    children: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div
            className={`flex items-center gap-[14px] rounded-lg border px-4 py-[14px] ${
                state === 'current'
                    ? 'border-solid border-primary bg-primary-tint'
                    : state === 'done'
                      ? 'border-solid border-border'
                      : 'border-dashed border-border'
            }`}
        >
            {state === 'done' ? (
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-success">
                    <CheckMark size={13} />
                </span>
            ) : state === 'current' ? (
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-primary">
                    <span className="size-2 rounded-full bg-white" />
                </span>
            ) : (
                <span className="h-[26px] w-[26px] shrink-0 rounded-full border border-solid border-border bg-white" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <p
                    className={`text-[15px] leading-5 ${state === 'waiting' ? 'font-medium text-text-muted' : 'font-semibold text-text'}`}
                >
                    {title}
                </p>
                <p
                    className={`text-[13px] leading-[18px] ${state === 'current' ? 'text-text' : 'text-text-muted'}`}
                >
                    {children}
                </p>
            </div>
            {action}
        </div>
    );
}

function Overview({
    phase,
    summary,
    setupLine,
    warnings = 0,
    firstProblem,
    live,
}: OverviewProps) {
    if (!phase || !summary) {
        return (
            <div className="flex flex-col gap-5">
                <Head title={t('Timetable')} />
                <div className="flex flex-col gap-[6px]">
                    <Breadcrumbs trail={[{ label: t('Timetable') }]} />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {t('Timetable')}
                    </h1>
                </div>
                <NoTerm setupHref={schoolSetup.url()} />
            </div>
        );
    }

    const order: StepKey[] = [
        'setup',
        'checks',
        'generate',
        'review',
        'publish',
    ];
    const done: Record<StepKey, boolean> = {
        setup: phase.setup,
        checks: phase.checks,
        generate: phase.generated,
        review: phase.reviewed,
        publish: false,
    };
    const state = (key: StepKey) =>
        done[key]
            ? 'done'
            : phase.current === key
              ? 'current'
              : order.indexOf(key) < order.indexOf(phase.current)
                ? 'done'
                : 'waiting';
    const go = (label: string, href: string, strong = false) => (
        <Link
            href={href}
            className={`shrink-0 text-[13px] leading-4 text-primary hover:underline ${strong ? 'font-semibold' : 'font-medium'}`}
        >
            {label}
        </Link>
    );
    const next: Record<StepKey, { label: string; href: string }> = {
        setup: { label: t('Finish setup →'), href: setup.url() },
        checks: {
            label: t('Fix :problem →', {
                problem: plural(phase.blocking, 'problem'),
            }),
            href: checks.url(),
        },
        generate: { label: t('Generate →'), href: generator.url() },
        review: {
            label: t('Fix :thing →', {
                thing: plural(phase.to_fix ?? 0, 'thing'),
            }),
            href: review.url(),
        },
        publish: {
            label: t('Publish version :draft →', { draft: phase.draft }),
            href: publishing.url(),
        },
    };
    const stats = [
        { label: t('Lessons a week'), value: summary.lessons },
        { label: t('Classes'), value: summary.classes },
        { label: t('Teachers'), value: summary.teachers },
        { label: t('Rooms'), value: summary.rooms },
    ];

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Timetable')} />
            <TimetableHeader
                page="overview"
                phase={phase}
                title={t('Timetable')}
                meta={
                    <>
                        <span className="font-mono uppercase">
                            {phase.term}
                        </span>
                        {' · '}
                        {phase.live !== null
                            ? t('live: version :live:live_since', {
                                  live: phase.live,
                                  live_since: phase.live_since
                                      ? ` since ${shortDate(phase.live_since)}`
                                      : '',
                              })
                            : t('nothing published yet')}
                        {' · '}
                        {t('draft: version')} {phase.draft}
                    </>
                }
                action={
                    <Link
                        href={next[phase.current].href}
                        className={primaryActionClass}
                    >
                        {t(next[phase.current].label)}
                    </Link>
                }
            />

            <div className="flex flex-wrap border-y border-solid border-border">
                {stats.map((stat, position) => (
                    <div
                        key={stat.label}
                        className={`flex min-w-[140px] flex-1 flex-col gap-[2px] py-[10px] ${
                            position === 0
                                ? 'pr-4'
                                : 'border-l border-solid border-border px-4'
                        }`}
                    >
                        <span className={capsLabelClass}>{t(stat.label)}</span>
                        <span className="font-display text-[24px] leading-7 font-extrabold text-text">
                            {new Intl.NumberFormat(numberLocale()).format(
                                stat.value,
                            )}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
                    <p className={capsLabelClass}>
                        {phase.has_draft ? t('Building') : t('Next:')}{' '}
                        {t('draft version')} {phase.draft}
                    </p>
                    <Stage
                        state={state('setup')}
                        title={t('1 · Setup')}
                        action={go(t('Edit setup'), setup.url())}
                    >
                        {setupLine}
                    </Stage>
                    <Stage
                        state={state('checks')}
                        title={t('2 · Check inputs')}
                        action={
                            phase.setup &&
                            (phase.blocking > 0
                                ? go(
                                      t('Fix :problem →', {
                                          problem: plural(
                                              phase.blocking,
                                              'problem',
                                          ),
                                      }),
                                      checks.url(),
                                      true,
                                  )
                                : go(t('Open checks'), checks.url()))
                        }
                    >
                        {phase.blocking > 0
                            ? t(':stop the generator: :to_lower_case:more. ', {
                                  stop: plural(
                                      phase.blocking,
                                      'problem stops',
                                      'problems stop',
                                  ),
                                  to_lower_case: firstProblem?.toLowerCase(),
                                  more: phase.blocking > 1 ? ', and more' : '',
                              })
                            : t('Nothing stops the generator. ')}
                        {warnings > 0
                            ? t(':warning can wait.', {
                                  warning: plural(warnings, 'warning'),
                              })
                            : t('No warnings.')}
                    </Stage>
                    <Stage
                        state={state('generate')}
                        title={t('3 · Generate')}
                        action={
                            phase.checks &&
                            go(
                                phase.generated
                                    ? t('Generate again')
                                    : t('Generate →'),
                                generator.url(),
                                !phase.generated,
                            )
                        }
                    >
                        {t('Places every lesson, keeping the ones you locked.')}
                        {phase.checks ? '' : t(' Opens when the checks pass.')}
                    </Stage>
                    <Stage
                        state={state('review')}
                        title={t('4 · Review the timetable')}
                        action={
                            phase.to_fix !== null &&
                            go(
                                phase.to_fix > 0
                                    ? t('Fix :thing →', {
                                          thing: plural(phase.to_fix, 'thing'),
                                      })
                                    : t('Open the timetable'),
                                review.url(),
                                phase.to_fix > 0,
                            )
                        }
                    >
                        {t(
                            'By class, teacher or room. Move lessons, clear clashes, place what is left over.',
                        )}
                    </Stage>
                    <Stage
                        state={state('publish')}
                        title={t('5 · Publish')}
                        action={
                            phase.reviewed &&
                            go(
                                t('Publish version :draft →', {
                                    draft: phase.draft,
                                }),
                                publishing.url(),
                                true,
                            )
                        }
                    >
                        {phase.live !== null
                            ? t(
                                  'Version :draft replaces version :live for the school.',
                                  { draft: phase.draft, live: phase.live },
                              )
                            : t(
                                  'Version :draft becomes the school’s timetable.',
                                  { draft: phase.draft },
                              )}
                    </Stage>
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[320px] lg:border-l lg:pl-7">
                    {live ? (
                        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                            <div className="flex items-center justify-between">
                                <p className={capsLabelClass}>
                                    {t('Live now')}
                                </p>
                                <span className="flex h-[22px] items-center rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                                    {t('Version :number', {
                                        number: live.number,
                                    })}
                                </span>
                            </div>
                            <p className="text-[13px] leading-[19px] text-text">
                                {t(
                                    'Published :published. This is the school’s timetable, not the draft.',
                                    { published: shortDate(live.published) },
                                )}
                            </p>
                            <Link
                                href={review.url({
                                    query: { version: 'live' },
                                })}
                                className={linkClass}
                            >
                                {t('View the live timetable →')}
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                            <p className={capsLabelClass}>
                                {t('Nothing live yet')}
                            </p>
                            <p className="text-[13px] leading-[19px] text-text">
                                {t(
                                    'Version :draft is the first timetable for :term. Nobody sees it until it is published.',
                                    { draft: phase.draft, term: phase.term },
                                )}
                            </p>
                        </div>
                    )}
                    <div className="flex flex-col gap-[10px] rounded-lg border border-dashed border-border bg-white p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">
                            {t('Small changes after publishing')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'A teacher is away, or a room is not available? Use Changes. It does not need a new version.',
                            )}
                        </p>
                        <Link href={changes.url()} className={linkClass}>
                            {t('Open Changes →')}
                        </Link>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Overview);
