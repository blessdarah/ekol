import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import {
    close,
    closing,
    report,
    show,
} from '@/actions/App/Http/Controllers/SchemeController';
import { dayMonth } from '../../components/fees/ui';
import {
    SchemesHeader,
    StepBar,
    type Steps,
} from '../../components/schemes/ui';
import {
    StructureTabs,
    capsLabelClass,
    outlineButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface CloseProps {
    steps: Steps;
    closed: boolean;
    canClose: boolean;
    lastWeekStarts: string | null;
    nextTerm: string | null;
    totals: {
        taught_percent: number;
        fully: number;
        schemes: number;
        below: number;
        carry: number;
    };
    filters: { show: string };
    rows: {
        id: string;
        subject: string | null;
        class: string | null;
        teacher: string | null;
        taught: number;
        total: number;
        coverage: number;
        carries: string[];
    }[];
}

function CloseTerm({
    steps,
    closed,
    canClose,
    lastWeekStarts,
    nextTerm,
    totals,
    filters,
    rows,
}: CloseProps) {
    const [openNext, setOpenNext] = useState(nextTerm !== null);
    const term = t(steps.term?.label ?? '');
    const stats = [
        {
            label: t('Topics taught'),
            value: `${totals.taught_percent}%`,
            tone: 'text-text',
        },
        {
            label: t('Fully covered'),
            value: t(':count of :total', {
                count: totals.fully,
                total: totals.schemes,
            }),
            tone: 'text-text',
        },
        {
            label: t('Below 80%'),
            value: String(totals.below),
            tone: totals.below > 0 ? 'text-[#8A5A12]' : 'text-text',
        },
        {
            label: t('To carry over'),
            value: String(totals.carry),
            tone: 'text-text',
        },
    ];

    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Close :term', { term })} />
            <SchemesHeader
                trail={[{ label: t('Close the term') }]}
                tag={t('Schemes:term_label', {
                    term_label: steps.term ? ` · ${t(steps.term.label)}` : '',
                })}
                title={t('Close :term', { term })}
                sub={t(
                    'How much of each plan was taught. Sub-topics not taught move to the start of the next term’s schemes.',
                )}
            />
            <StructureTabs active="schemes" />
            <StepBar steps={steps} active="close" />

            <div className="flex flex-wrap border-y border-solid border-border">
                {stats.map((stat, position) => (
                    <div
                        key={stat.label}
                        className={`flex min-w-[150px] flex-1 flex-col gap-1 py-3 ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                    >
                        <span className={capsLabelClass}>{stat.label}</span>
                        <span
                            className={`font-display text-[24px] leading-7 font-bold ${stat.tone}`}
                        >
                            {stat.value}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex gap-2">
                        {[
                            { key: 'all', label: t('All') },
                            {
                                key: 'below',
                                label: t('Below 80% · :count', {
                                    count: totals.below,
                                }),
                            },
                        ].map((tab) => (
                            <Link
                                key={tab.key}
                                href={closing.url({ query: { show: tab.key } })}
                                preserveScroll
                                className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] ${
                                    filters.show === tab.key
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {tab.label}
                            </Link>
                        ))}
                    </div>
                    {rows.length === 0 ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] text-text">
                            {t('Every scheme is at 80% or more.')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[680px] flex-col">
                                <div
                                    className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                                >
                                    <span className="flex-1">
                                        {t('Subject · class')}
                                    </span>
                                    <span className="w-[110px] shrink-0">
                                        {t('Teacher')}
                                    </span>
                                    <span className="w-[180px] shrink-0">
                                        {t('Taught')}
                                    </span>
                                    <span className="w-[180px] shrink-0">
                                        {t('Moves to the next term')}
                                    </span>
                                </div>
                                {rows.map((row) => (
                                    <Link
                                        key={row.id}
                                        href={show.url(row.id)}
                                        className="flex min-h-[46px] items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0 hover:bg-surface"
                                    >
                                        <span className="min-w-0 flex-1 text-[14px] text-text">
                                            {row.subject} · {row.class}
                                        </span>
                                        <span className="w-[110px] shrink-0 truncate text-[13px] text-text">
                                            {row.teacher ?? '—'}
                                        </span>
                                        <span className="flex w-[180px] shrink-0 items-center gap-2">
                                            <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-border">
                                                <span
                                                    className={`block h-full rounded-full ${row.coverage >= 80 ? 'bg-success' : row.coverage >= 50 ? 'bg-warning' : 'bg-danger'}`}
                                                    style={{
                                                        width: `${row.coverage}%`,
                                                    }}
                                                />
                                            </span>
                                            <span className="font-mono text-[12px] text-text">
                                                {t(':taught of :total', {
                                                    taught: row.taught,
                                                    total: row.total,
                                                })}
                                            </span>
                                        </span>
                                        <span className="w-[180px] shrink-0 truncate text-[13px] text-text">
                                            {row.carries.length === 0
                                                ? '—'
                                                : row.carries
                                                      .slice(0, 2)
                                                      .join(', ') +
                                                  (row.carries.length > 2
                                                      ? `, +${row.carries.length - 2}`
                                                      : '')}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <aside className="flex shrink-0 flex-col gap-3 xl:w-[310px] xl:border-l xl:border-solid xl:border-border xl:pl-6">
                    <span className={capsLabelClass}>
                        {closed
                            ? t(':term is closed', { term })
                            : t('When you close :term', { term })}
                    </span>
                    {!closed && (
                        <ul className="flex flex-col gap-2 text-[13px] leading-[19px] text-text">
                            <li className="flex gap-2">
                                <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-success" />
                                {t(
                                    ':term schemes are locked and kept in each class’s record',
                                    { term },
                                )}
                            </li>
                            <li className="flex gap-2">
                                <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-success" />
                                {t(
                                    ':count sub-topics not taught are added to the start of the next term’s schemes',
                                    { count: totals.carry },
                                )}
                            </li>
                            <li className="flex gap-2">
                                <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-warning" />
                                {t(
                                    'Anything not ticked as taught counts as not taught',
                                )}
                            </li>
                        </ul>
                    )}
                    {!closed && (
                        <Form
                            action={close.url()}
                            method="post"
                            className="flex flex-col gap-3"
                        >
                            {({ errors, processing }) => (
                                <>
                                    {nextTerm && (
                                        <label className="flex items-center gap-2 text-[13px] text-text">
                                            <input
                                                type="hidden"
                                                name="open_next"
                                                value={openNext ? '1' : '0'}
                                            />
                                            <input
                                                type="checkbox"
                                                checked={openNext}
                                                onChange={(e) =>
                                                    setOpenNext(
                                                        e.target.checked,
                                                    )
                                                }
                                                className="h-4 w-4 accent-primary"
                                            />
                                            {t(
                                                'Open :term schemes straight after',
                                                { term: t(nextTerm) },
                                            )}
                                        </label>
                                    )}
                                    {!nextTerm && (
                                        <input
                                            type="hidden"
                                            name="open_next"
                                            value="0"
                                        />
                                    )}
                                    {errors.open_next && (
                                        <p className="text-[13px] text-danger">
                                            {errors.open_next}
                                        </p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={processing || !canClose}
                                        className="flex h-11 items-center justify-center rounded-md bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                                    >
                                        {t('Close :term schemes', { term })}
                                    </button>
                                </>
                            )}
                        </Form>
                    )}
                    <a href={report.url()} className={outlineButtonClass}>
                        {t('Download coverage report')}
                    </a>
                    <p className="text-[12px] leading-[17px] text-text-muted">
                        {t(
                            'The report lists coverage by subject and class for the inspectorate and the staff meeting.',
                        )}{' '}
                        {!closed &&
                            !canClose &&
                            lastWeekStarts &&
                            t(
                                'The term can close from its last week, starting :date.',
                                { date: dayMonth(lastWeekStarts, false) },
                            )}
                    </p>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(CloseTerm);
