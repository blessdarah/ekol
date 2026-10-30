import { tableRowClass } from '../../components/table/ui';
import { Head, Link, router } from '@inertiajs/react';
import { Fragment } from 'react';
import {
    create,
    edit,
    progress,
    results,
    usual,
} from '@/actions/App/Http/Controllers/AssessmentController';
import { show as schedule } from '@/actions/App/Http/Controllers/ExamScheduleController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    Empty,
    KindChip,
    type PlanState,
    type PlanSummary,
    STATE_LABELS,
    amberText,
    linkClass,
    primaryClass,
    range,
} from '../../components/assessments/ui';
import { PlusIcon, capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface CalendarProps {
    yearLabel: string | null;
    tabs: AssessmentTabs;
    counts: Record<PlanState, number>;
    terms: {
        id: string;
        label: string;
        current: boolean;
        plans: PlanSummary[];
    }[];
}

const ORDER: PlanState[] = [
    'draft',
    'scheduled',
    'marks_open',
    'marks_closed',
    'published',
];

function Status({ plan }: { plan: PlanSummary }) {
    if (plan.state === 'marks_open') {
        const left = plan.days_left ?? 0;

        return (
            <span
                className={`flex h-6 items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${left < 0 ? `bg-warning-tint ${amberText}` : 'bg-primary-tint text-primary'}`}
            >
                <span
                    className={`h-[6px] w-[6px] shrink-0 rounded-full ${left < 0 ? 'bg-warning' : 'bg-primary'}`}
                />
                {left < 0
                    ? t('Marks open · window ended')
                    : t('Marks open · :left', {
                          left:
                              left === 0
                                  ? 'closes today'
                                  : `${left} ${left === 1 ? 'day' : 'days'} left`,
                      })}
            </span>
        );
    }

    if (
        plan.state === 'scheduled' &&
        plan.kind === 'exam' &&
        !plan.has_schedule
    ) {
        return (
            <span
                className={`flex h-6 items-center gap-[6px] rounded-full bg-warning-tint px-[10px] text-[12px] leading-4 font-medium ${amberText}`}
            >
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                {t('Scheduled · no timetable')}
            </span>
        );
    }

    if (plan.state === 'published') {
        return (
            <span className="flex h-6 items-center gap-[6px] rounded-full bg-success-tint px-[10px] text-[12px] leading-4 font-medium text-success">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                {t('Published')}
            </span>
        );
    }

    return (
        <span
            className={`flex h-6 items-center rounded-full border border-border px-[10px] text-[12px] leading-4 font-medium ${plan.state === 'draft' ? 'border-dashed text-text-muted' : 'border-solid text-text'}`}
        >
            {t(STATE_LABELS[plan.state])}
        </span>
    );
}

function action(plan: PlanSummary): { label: string; href: string } {
    if (plan.state === 'draft') {
        return { label: t('Set up →'), href: edit.url(plan.id) };
    }
    if (plan.state === 'scheduled') {
        return plan.kind === 'exam' && !plan.has_schedule
            ? {
                  label: t('Set exam schedule →'),
                  href: schedule.url({ query: { plan: plan.id } }),
              }
            : { label: t('Edit'), href: edit.url(plan.id) };
    }
    if (plan.state === 'marks_open') {
        return {
            label: t('Track marks →'),
            href: progress.url({ query: { plan: plan.id } }),
        };
    }

    return {
        label:
            plan.state === 'published' ? t('Results') : t('Review results →'),
        href: results.url({ query: { plan: plan.id } }),
    };
}

function Calendar({ yearLabel, tabs, counts, terms }: CalendarProps) {
    const current = terms.find((term) => term.current);

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Sequences & Exams')} />
            <AssessmentHeader
                active="calendar"
                tabs={tabs}
                title={t('Sequences & Exams')}
                meta={
                    <>
                        <span className="font-mono uppercase">
                            {yearLabel ?? t('No year')}
                            {current ? ` · ${current.label}` : ''}
                        </span>
                        <span>
                            {t('· every assessment is marked out of 20')}
                        </span>
                    </>
                }
                action={
                    yearLabel && (
                        <Link href={create.url()} className={primaryClass}>
                            <PlusIcon />
                            {t('Add an assessment')}
                        </Link>
                    )
                }
            />

            {!yearLabel || terms.length === 0 ? (
                <Empty title={t('No terms to plan in yet')}>
                    {t(
                        'Assessments belong to a term of the current academic year. Make a year active and add its terms in School Setup first.',
                    )}
                </Empty>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-2">
                        <span className={`mr-2 ${capsLabelClass}`}>
                            {t('Every assessment moves through')}
                        </span>
                        {ORDER.map((state, position) => (
                            <Fragment key={state}>
                                {position > 0 && (
                                    <span className="text-[13px] text-text-muted">
                                        →
                                    </span>
                                )}
                                <span
                                    className={`flex h-7 items-center rounded-full border px-3 text-[12px] leading-4 font-medium ${
                                        state === 'marks_open' &&
                                        counts[state] > 0
                                            ? 'border-solid border-primary bg-primary-tint text-primary'
                                            : state === 'draft'
                                              ? 'border-dashed border-border text-text'
                                              : 'border-solid border-border text-text'
                                    }`}
                                >
                                    {t(STATE_LABELS[state])} ·{' '}
                                    {counts[state] ?? 0}
                                </span>
                            </Fragment>
                        ))}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-solid border-border">
                        <div className="flex min-w-[820px] flex-col">
                            <div
                                className={`flex h-[34px] items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                            >
                                <span className="flex-1">
                                    {t('Assessment')}
                                </span>
                                <span className="w-[110px] shrink-0">
                                    {t('Held')}
                                </span>
                                <span className="w-[150px] shrink-0">
                                    {t('Marks window')}
                                </span>
                                <span className="w-[230px] shrink-0">
                                    {t('Status')}
                                </span>
                                <span className="w-[150px] shrink-0" />
                            </div>
                            {terms.map((term) => (
                                <Fragment key={term.id}>
                                    <div
                                        className={`flex h-[30px] items-center border-b border-solid border-border px-4 ${capsLabelClass} ${term.current ? 'text-primary' : ''}`}
                                    >
                                        {t(term.label)}
                                        {term.current ? t(' · now') : ''}
                                    </div>
                                    {term.plans.length === 0 ? (
                                        <div className="flex min-h-[46px] items-center justify-between gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0">
                                            <span className="text-[13px] leading-4 text-text-muted">
                                                {t('No assessments planned.')}
                                            </span>
                                            <span className="flex gap-5">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.post(
                                                            usual.url(term.id),
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                    className={linkClass}
                                                >
                                                    {t('Add the usual three')}
                                                </button>
                                                <Link
                                                    href={create.url({
                                                        query: {
                                                            term: term.id,
                                                        },
                                                    })}
                                                    className={linkClass}
                                                >
                                                    {t('Add one →')}
                                                </Link>
                                            </span>
                                        </div>
                                    ) : (
                                        term.plans.map((plan, position) => {
                                            const next = action(plan);

                                            return (
                                                <div
                                                    key={plan.id}
                                                    className={`flex min-h-[54px] items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0 ${tableRowClass({ index: position })}`}
                                                >
                                                    <span className="flex min-w-0 flex-1 items-center gap-[10px]">
                                                        <span
                                                            className={`truncate text-[15px] leading-5 font-medium ${plan.state === 'draft' ? 'text-text-muted' : 'text-text'}`}
                                                        >
                                                            {plan.name}
                                                        </span>
                                                        <KindChip
                                                            kind={plan.kind}
                                                        />
                                                    </span>
                                                    <span className="w-[110px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                                        {range(
                                                            plan.held_from,
                                                            plan.held_until,
                                                        )}
                                                    </span>
                                                    <span className="w-[150px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                                        {range(
                                                            plan.window_starts_on,
                                                            plan.window_ends_on,
                                                        )}
                                                    </span>
                                                    <span className="flex w-[230px] shrink-0">
                                                        <Status plan={plan} />
                                                    </span>
                                                    <Link
                                                        href={next.href}
                                                        className={`w-[150px] shrink-0 text-right ${linkClass}`}
                                                    >
                                                        {t(next.label)}
                                                    </Link>
                                                </div>
                                            );
                                        })
                                    )}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                    <p className="max-w-[900px] text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Marks are out of 20. Teachers enter marks in the marks window only. The term average counts each assessment in the term equally, with one coefficient per subject.',
                        )}
                    </p>
                </>
            )}
        </div>
    );
}

export default withAppShell(Calendar);
