import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    progress,
    publish,
    results,
} from '@/actions/App/Http/Controllers/AssessmentController';
import { reports } from '@/actions/App/Http/Controllers/TermResultController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    Empty,
    PlanPicker,
    type PlanSummary,
    amberText,
    day,
    quietClass,
    score,
} from '../../components/assessments/ui';
import { ErrorText, capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface ResultsProps {
    tabs: AssessmentTabs;
    plans: PlanSummary[];
    plan: PlanSummary | null;
    classes: { id: string; name: string }[];
    class: string | null;
    passMark: number;
    stats: {
        average: number | null;
        highest: number | null;
        lowest: number | null;
        passed: number | null;
    };
    missing: number;
    rows: {
        id: string;
        name: string;
        matricule: string;
        class: string;
        average: number | null;
        entered: number;
        expected: number;
        missing: string[];
        complete: boolean;
        rank: number | null;
    }[];
}

function Results({
    tabs,
    plans,
    plan,
    classes,
    class: current,
    passMark,
    stats,
    missing,
    rows,
}: ResultsProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;

    if (!plan) {
        return (
            <div className="flex flex-col gap-5">
                <Head title={t('Results')} />
                <AssessmentHeader
                    active="results"
                    tabs={tabs}
                    trail={[{ label: t('Results') }]}
                    title={t('Results')}
                />
                <Empty title={t('No results yet')}>
                    {t('Results appear once an assessment has its marks open.')}
                </Empty>
            </div>
        );
    }

    const all = current === 'all';
    const figures = [
        {
            label: all ? t('School average') : t('Class average'),
            value: score(stats.average),
        },
        { label: t('Highest'), value: score(stats.highest) },
        { label: t('Lowest'), value: score(stats.lowest) },
        {
            label: t('At :pass_mark or more', { pass_mark: passMark }),
            value: stats.passed === null ? '—' : `${stats.passed}%`,
        },
    ];
    const status =
        plan.state === 'published'
            ? t(':plan · results published :published_on', {
                  plan: plan.name,
                  published_on: day(plan.published_on),
              })
            : plan.state === 'marks_closed'
              ? t(':plan · marks closed :closed_on · not published', {
                    plan: plan.name,
                    closed_on: day(plan.closed_on),
                })
              : t(':plan · marks still open · results so far', {
                    plan: plan.name,
                });

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Results')} />
            <AssessmentHeader
                active="results"
                tabs={tabs}
                trail={[{ label: t('Results') }]}
                title={t('Results')}
                meta={
                    <span
                        className={`flex h-[22px] items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${
                            plan.state === 'published'
                                ? 'bg-success-tint text-success'
                                : 'border border-solid border-border bg-surface text-text'
                        }`}
                    >
                        {plan.state === 'published' && (
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                        )}
                        {status}
                    </span>
                }
            />

            <PlanPicker
                plans={plans}
                current={plan.id}
                href={(id) => results.url({ query: { plan: id } })}
            />

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                        {[
                            ...classes,
                            { id: 'all', name: t('All classes') },
                        ].map((option) => (
                            <Link
                                key={option.id}
                                href={results.url({
                                    query: { plan: plan.id, class: option.id },
                                })}
                                preserveScroll
                                aria-current={
                                    option.id === current ? 'true' : undefined
                                }
                                className={`flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
                                    option.id === current
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {option.name}
                            </Link>
                        ))}
                    </div>

                    <div className="flex flex-wrap border-y border-solid border-border">
                        {figures.map((figure, position) => (
                            <div
                                key={figure.label}
                                className={`flex min-w-[130px] flex-1 flex-col gap-[2px] py-[10px] ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                            >
                                <span className={capsLabelClass}>
                                    {t(figure.label)}
                                </span>
                                <span className="font-display text-[24px] leading-7 font-extrabold text-text">
                                    {figure.value}
                                </span>
                            </div>
                        ))}
                    </div>

                    {rows.length === 0 ? (
                        <Empty title={t('No students in this class')}>
                            {t(
                                'Results list the students enrolled in the class this year.',
                            )}
                        </Empty>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[560px] flex-col">
                                <div
                                    className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}
                                >
                                    <span className="w-10 shrink-0">
                                        {t('Rank')}
                                    </span>
                                    <span className="flex-1">
                                        {t('Student')}
                                    </span>
                                    {all && (
                                        <span className="w-[110px] shrink-0">
                                            {t('Class')}
                                        </span>
                                    )}
                                    <span className="w-[76px] shrink-0 text-right">
                                        {t('Marks in')}
                                    </span>
                                    <span className="w-[76px] shrink-0 text-right">
                                        {t('Average')}
                                    </span>
                                </div>
                                {rows.map((row, position) => (
                                    <div
                                        key={row.id}
                                        className={`flex min-h-10 items-center gap-4 border-b border-solid border-border px-[14px] py-[6px] last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                    >
                                        <span className="w-10 shrink-0 font-mono text-[13px] leading-4 text-text">
                                            {row.rank ?? '—'}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-[14px] leading-[18px] font-medium text-text">
                                                {row.name}
                                            </span>
                                            {row.missing.length > 0 && (
                                                <span
                                                    className={`truncate text-[12px] leading-4 ${amberText}`}
                                                >
                                                    {row.missing.join(', ')}{' '}
                                                    {t('missing')}
                                                </span>
                                            )}
                                        </span>
                                        {all && (
                                            <span className="w-[110px] shrink-0 truncate text-[13px] leading-4 text-text-muted">
                                                {row.class}
                                            </span>
                                        )}
                                        <span
                                            className={`w-[76px] shrink-0 text-right font-mono text-[13px] leading-4 ${row.missing.length > 0 ? amberText : 'text-text'}`}
                                        >
                                            {row.entered} / {row.expected}
                                        </span>
                                        <span
                                            className={`w-[76px] shrink-0 text-right font-mono text-[14px] leading-[18px] ${
                                                row.average !== null &&
                                                row.average < passMark
                                                    ? 'text-danger'
                                                    : row.complete
                                                      ? 'text-text'
                                                      : 'text-text-muted'
                                            }`}
                                        >
                                            {score(row.average)}
                                            {!row.complete &&
                                                row.average !== null &&
                                                '*'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-[12px] leading-[17px] text-text-muted">
                        {t(
                            '* Average of the marks entered so far. A student with a missing mark is not ranked until it is in. Equal averages share a rank. A subject marked ABS is left out of that student’s average.',
                        )}
                    </p>
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[300px] lg:border-l lg:pl-7">
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>
                            {plan.state === 'published'
                                ? t('Published')
                                : t('Publish :plan', { plan: plan.name })}
                        </p>
                        <ul className="flex flex-col gap-[10px]">
                            <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                                <span
                                    className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${plan.state === 'marks_open' ? 'bg-warning' : 'bg-success'}`}
                                />
                                {plan.state === 'marks_open'
                                    ? t('The marks window is still open')
                                    : t('The marks window is closed')}
                            </li>
                            <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                                <span
                                    className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${missing > 0 ? 'bg-warning' : 'bg-success'}`}
                                />
                                {missing > 0
                                    ? t(
                                          ':missing :are still missing :class. They show as dashes and are left out of averages.',
                                          {
                                              missing,
                                              are:
                                                  missing === 1
                                                      ? 'mark is'
                                                      : 'marks are',
                                              class: all
                                                  ? 'across the school'
                                                  : 'in this class',
                                          },
                                      )
                                    : t('No mark is missing :class', {
                                          class: all
                                              ? 'in the school'
                                              : 'in this class',
                                      })}
                            </li>
                        </ul>
                        {plan.state === 'published' ? (
                            <Link
                                href={reports.url({ query: { plan: plan.id } })}
                                className="flex h-10 items-center justify-center rounded-md bg-primary text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover"
                            >
                                {t('Open report cards →')}
                            </Link>
                        ) : (
                            <>
                                <p className="text-[13px] leading-[19px] text-text-muted">
                                    {t(
                                        'Publishing locks the marks for every class. A later change needs a correction approved by the principal.',
                                    )}
                                </p>
                                <button
                                    type="button"
                                    disabled={plan.state !== 'marks_closed'}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                t(
                                                    'Publish :plan for every class? Marks are locked afterwards.',
                                                    { plan: plan.name },
                                                ),
                                            )
                                        ) {
                                            router.post(publish.url(plan.id));
                                        }
                                    }}
                                    className="flex h-10 items-center justify-center rounded-md bg-primary text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                                >
                                    {t('Publish results, all classes')}
                                </button>
                            </>
                        )}
                        <ErrorText message={errors.publish} />
                        <Link
                            href={progress.url({ query: { plan: plan.id } })}
                            className={quietClass}
                        >
                            {t('← Back to marks progress')}
                        </Link>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">
                            {t('What comes next')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'Once published, report cards can be opened for every class on the Report cards tab.',
                            )}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Results);
