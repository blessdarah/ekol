import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { index as applications } from '@/actions/App/Http/Controllers/ApplicationController';
import {
    progress,
    results as resultsPage,
} from '@/actions/App/Http/Controllers/AssessmentController';
import { show as dashboard } from '@/actions/App/Http/Controllers/DashboardController';
import { index as fees } from '@/actions/App/Http/Controllers/FeeController';
import { index as schemes } from '@/actions/App/Http/Controllers/SchemeController';
import {
    AttendanceChart,
    type AttendancePoint,
    type ClassResult,
    FeeChart,
    type FeePoint,
    type LevelCount,
    LevelsChart,
    ResultsChart,
    Sparkline,
    SplitBar,
    compact,
} from '../components/dashboard/charts';
import { dayMonth } from '../components/fees/ui';
import { withAppShell } from '../layouts/app-layout';
import { t } from '../lib/i18n';

interface Attention {
    key: 'schemes' | 'marks' | 'fees' | 'registers' | 'applications';
    tone: 'science' | 'warning' | 'danger' | 'muted';
    count: number;
    detail: unknown;
}

interface DashboardProps {
    date?: string;
    greeting?: string;
    name?: string;
    schoolName?: string;
    currency?: string;
    range?: 'term' | 'year';
    term?: {
        label: string;
        week: number | null;
        weeks: number;
        ends_on: string;
    } | null;
    yearLabel?: string | null;
    counts?: { students: number; classes: number; staff: number };
    fees?: {
        due: number;
        collected: number;
        overdue: number;
        overdue_students: number;
        series: FeePoint[];
        today: number | false;
    } | null;
    attendance?: {
        today: { rate: number | null; present: number; marked: number };
        series: AttendancePoint[];
        lowest: { class: string; rate: number } | null;
        unmarked: string[];
    };
    marks?: {
        plan: string;
        submitted: number;
        total: number;
        missing: number;
        teachers: number;
        closes_on: string | null;
        days_left: number | null;
    } | null;
    schemes?: {
        all: number;
        on_track: number;
        behind: number;
        to_approve: number;
        not_submitted: number;
    } | null;
    results?: {
        plan_id: string;
        plan: string;
        published_on: string | null;
        pass_mark: number;
        classes: ClassResult[];
    } | null;
    levels?: LevelCount[];
    admissions?: {
        year: string;
        applied: number;
        reviewed: number;
        admitted: number;
        placed: number;
    } | null;
    attention?: Attention[];
}

const capsClass =
    'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

const TONES: Record<Attention['tone'], string> = {
    science: 'bg-science',
    warning: 'bg-warning',
    danger: 'bg-danger',
    muted: 'bg-text-disabled',
};

function Segmented<T extends string>({
    options,
    value,
    onChange,
    small = false,
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    small?: boolean;
}) {
    return (
        <div
            className={`flex rounded-[9px] bg-surface p-[3px] ${small ? 'text-[12px]' : 'text-[13px]'} leading-4`}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                    className={`flex items-center rounded-[7px] ${small ? 'h-[26px] px-[10px]' : 'h-[30px] px-[14px]'} ${
                        option.value === value
                            ? 'bg-white font-semibold text-text shadow-[0_1px_2px_color-mix(in_srgb,var(--color-text)_12%,transparent)]'
                            : 'text-text-muted hover:text-text'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function Section({
    title,
    sub,
    action,
    children,
}: {
    title: string;
    sub?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="font-display text-[20px] leading-6 font-bold text-text">
                        {title}
                    </h2>
                    {sub && (
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            {sub}
                        </p>
                    )}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function Headline({
    label,
    value,
    sub,
    children,
}: {
    label: string;
    value: React.ReactNode;
    sub: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-[6px] border-solid border-border py-6 sm:px-6 lg:first:pl-0 lg:last:pr-0 sm:[&:not(:first-child)]:border-l">
            <span className={capsClass}>{label}</span>
            <span className="font-display text-[34px] leading-[38px] font-extrabold tracking-[-0.02em] text-text">
                {value}
            </span>
            <span className="text-[13px] leading-[18px] text-text-muted">
                {sub}
            </span>
            {children}
        </div>
    );
}

function Of({ part, whole }: { part: number; whole: number }) {
    return (
        <>
            {part}
            <span className="font-light text-text-muted"> / {whole}</span>
        </>
    );
}

function attentionLine(item: Attention, currency: string) {
    const detail = item.detail as Record<string, unknown>;

    switch (item.key) {
        case 'schemes':
            return {
                title: t(':count schemes to approve', { count: item.count }),
                sub: (item.detail as string[]).join(', '),
                href: schemes.url({ query: { state: 'to_approve' } }),
            };
        case 'marks':
            return {
                title: t(':count mark sheets missing', { count: item.count }),
                sub: t(':plan closes :date · :teachers teachers', {
                    plan: String(detail.plan),
                    date: dayMonth((detail.closes_on as string) ?? null, false),
                    teachers: Number(detail.teachers),
                }),
                href: progress.url(),
            };
        case 'fees':
            return {
                title: t(':count students overdue', { count: item.count }),
                sub: `${compact(Number(detail.amount))} ${currency}`,
                href: fees.url({ query: { state: 'overdue' } }),
            };
        case 'registers':
            return {
                title: t(':count registers not taken', { count: item.count }),
                sub: (detail.classes as string[]).slice(0, 4).join(', '),
                href: null,
            };
        default:
            return {
                title: t(':count applications to review', {
                    count: item.count,
                }),
                sub:
                    detail.oldest !== null
                        ? t('for :year · oldest waiting :days days', {
                              year: String(detail.year),
                              days: Number(detail.oldest),
                          })
                        : t('for :year', { year: String(detail.year) }),
                href: applications.url({
                    query: { stage: 'to_review' },
                }),
            };
    }
}

function Dashboard(props: DashboardProps) {
    const [measure, setMeasure] = useState<'average' | 'rate'>('average');

    if (!props.counts || !props.attendance) {
        return (
            <>
                <Head title={t('Dashboard')} />
                <div className="rounded-xl border border-solid border-border bg-white p-8">
                    <h1 className="font-display text-[28px] leading-[1.2] font-bold text-text">
                        {t('Dashboard')}
                    </h1>
                </div>
            </>
        );
    }

    const {
        date,
        greeting,
        name,
        schoolName,
        currency = 'XAF',
        range = 'term',
        term,
        counts,
        fees: money,
        attendance,
        marks,
        schemes: plans,
        results,
        levels = [],
        admissions,
        attention = [],
    } = props;
    const share =
        money && money.due > 0
            ? Math.min(100, Math.round((money.collected / money.due) * 100))
            : 0;
    const funnel = admissions
        ? [
              { label: t('Applied'), count: admissions.applied, note: null },
              {
                  label: t('Reviewed'),
                  count: admissions.reviewed,
                  note: admissions.applied,
              },
              {
                  label: t('Admitted'),
                  count: admissions.admitted,
                  note: admissions.reviewed,
              },
              {
                  label: t('Placed in a class'),
                  count: admissions.placed,
                  note: admissions.admitted,
              },
          ]
        : [];

    function switchRange(next: 'term' | 'year') {
        router.get(
            dashboard.url({ query: next === 'year' ? { range: 'year' } : {} }),
            {},
            {
                only: ['range', 'fees', 'attendance'],
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        );
    }

    return (
        <div className="flex flex-col">
            <Head title={t('Dashboard')} />
            <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-b border-solid border-border pb-7">
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-[13px] leading-4 text-text-muted">
                        {date}
                    </p>
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[32px] sm:leading-9">
                        {t(':greeting, :name', {
                            greeting: t(greeting ?? 'Good morning'),
                            name: name ?? '',
                        })}
                    </h1>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5 text-text-muted">
                        <span className="font-semibold text-text">
                            {schoolName}
                        </span>
                        {[
                            { count: counts.students, label: t('students') },
                            { count: counts.classes, label: t('classes') },
                            { count: counts.staff, label: t('staff') },
                        ].map((fact) => (
                            <span key={fact.label}>
                                <span
                                    className="text-text-disabled"
                                    aria-hidden
                                >
                                    ·{' '}
                                </span>
                                <span className="font-mono text-text">
                                    {fact.count}
                                </span>{' '}
                                {fact.label}
                            </span>
                        ))}
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                    {term && (
                        <div className="flex flex-col gap-2 sm:items-end">
                            <p className="flex items-baseline gap-2 text-[13px] leading-4">
                                <span className="font-mono tracking-[0.04em] text-text-muted uppercase">
                                    {t(term.label)}
                                </span>
                                {term.week && (
                                    <span className="font-semibold text-text">
                                        {t('Week :week of :weeks', {
                                            week: term.week,
                                            weeks: term.weeks,
                                        })}
                                    </span>
                                )}
                            </p>
                            {term.week && (
                                <span
                                    className="flex items-center gap-[3px]"
                                    aria-hidden
                                >
                                    {Array.from(
                                        { length: term.weeks },
                                        (_, position) => (
                                            <span
                                                key={position}
                                                className={`w-[14px] rounded-[3px] ${position < (term.week ?? 0) ? 'bg-primary' : 'bg-border'} ${position + 1 === term.week ? 'h-[10px]' : 'h-[6px]'}`}
                                            />
                                        ),
                                    )}
                                </span>
                            )}
                            <p className="text-[12px] leading-4 text-text-muted">
                                {term.week && term.weeks - term.week > 0
                                    ? t(':count weeks to go · ends :date', {
                                          count: term.weeks - term.week,
                                          date: dayMonth(term.ends_on, false),
                                      })
                                    : t('ends :date', {
                                          date: dayMonth(term.ends_on, false),
                                      })}
                            </p>
                        </div>
                    )}
                    {(money || attendance.series.length > 0) && (
                        <Segmented
                            small
                            options={[
                                { value: 'term', label: t('This term') },
                                { value: 'year', label: t('This year') },
                            ]}
                            value={range}
                            onChange={switchRange}
                        />
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 border-b border-solid border-border sm:grid-cols-2 lg:grid-cols-4">
                {money && (
                    <Headline
                        label={t('Fees collected')}
                        value={`${share}%`}
                        sub={
                            <>
                                <span className="font-mono text-text">
                                    {compact(money.collected)}
                                </span>{' '}
                                {t('of :due :currency', {
                                    due: compact(money.due),
                                    currency,
                                })}
                            </>
                        }
                    >
                        <Sparkline
                            values={money.series
                                .map((point) => point.collected)
                                .filter(
                                    (value): value is number => value !== null,
                                )}
                        />
                    </Headline>
                )}
                <Headline
                    label={t('Present today')}
                    value={
                        attendance.today.rate === null
                            ? '—'
                            : `${attendance.today.rate}%`
                    }
                    sub={
                        attendance.today.marked > 0 ? (
                            <>
                                <span className="font-mono text-text">
                                    {attendance.today.present}
                                </span>{' '}
                                {t('of :marked marked', {
                                    marked: attendance.today.marked,
                                })}
                                {attendance.unmarked.length > 0 &&
                                    ` · ${t(':count registers not taken', { count: attendance.unmarked.length })}`}
                            </>
                        ) : (
                            t('No register taken yet today')
                        )
                    }
                >
                    <Sparkline
                        values={attendance.series.map((point) => point.rate)}
                    />
                </Headline>
                {marks && (
                    <Headline
                        label={t(':plan marks', { plan: marks.plan })}
                        value={
                            <Of part={marks.submitted} whole={marks.total} />
                        }
                        sub={
                            <>
                                {t('sheets in')}
                                {marks.days_left !== null && (
                                    <>
                                        {' · '}
                                        <span
                                            className={
                                                marks.days_left <= 3
                                                    ? 'font-semibold text-warning-text'
                                                    : ''
                                            }
                                        >
                                            {marks.days_left < 0
                                                ? t('window ended')
                                                : marks.days_left === 0
                                                  ? t('close today')
                                                  : t('close in :days days', {
                                                        days: marks.days_left,
                                                    })}
                                        </span>
                                    </>
                                )}
                            </>
                        }
                    >
                        <SplitBar
                            parts={[
                                { count: marks.submitted, tone: 'bg-success' },
                                { count: marks.missing, tone: 'bg-warning' },
                            ]}
                        />
                    </Headline>
                )}
                {plans && (
                    <Headline
                        label={t('Schemes on track')}
                        value={<Of part={plans.on_track} whole={plans.all} />}
                        sub={t(':behind behind · :waiting waiting for you', {
                            behind: plans.behind,
                            waiting: plans.to_approve,
                        })}
                    >
                        <SplitBar
                            parts={[
                                { count: plans.on_track, tone: 'bg-success' },
                                { count: plans.to_approve, tone: 'bg-science' },
                                { count: plans.behind, tone: 'bg-warning' },
                                {
                                    count: plans.not_submitted,
                                    tone: 'bg-danger',
                                },
                            ]}
                        />
                    </Headline>
                )}
            </div>

            {(money || attention.length > 0) && (
                <div className="flex flex-col gap-12 border-b border-solid border-border py-9 xl:flex-row">
                    {money && (
                        <div className="min-w-0 xl:w-[65%] xl:shrink-0">
                            <Section
                                title={t('Fee collection')}
                                sub={t(
                                    'Collected so far, against what the instalments make due',
                                )}
                                action={
                                    <div className="flex gap-4 text-[13px] leading-4 text-text">
                                        <span className="flex items-center gap-2">
                                            <span className="h-[2px] w-4 rounded-full bg-primary" />
                                            {t('Collected')}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 border-t-2 border-dashed border-text-muted" />
                                            {t('Due by instalments')}
                                        </span>
                                    </div>
                                }
                            >
                                <FeeChart
                                    series={money.series}
                                    today={money.today}
                                    rangeLabel={(point) =>
                                        range === 'year'
                                            ? point.label
                                            : t(':week · :from – :to', {
                                                  week: point.label,
                                                  from: dayMonth(
                                                      point.starts_on,
                                                      false,
                                                  ),
                                                  to: dayMonth(
                                                      point.ends_on,
                                                      false,
                                                  ),
                                              })
                                    }
                                />
                                {money.overdue > 0 && (
                                    <p className="text-[12px] leading-4 text-text-muted">
                                        {t(':amount :currency is overdue ·', {
                                            amount: compact(money.overdue),
                                            currency,
                                        })}{' '}
                                        <Link
                                            href={fees.url({
                                                query: { state: 'overdue' },
                                            })}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {t('See who owes →')}
                                        </Link>
                                    </p>
                                )}
                            </Section>
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <Section title={t('Needs you today')}>
                            {attention.length === 0 ? (
                                <p className="border-t border-solid border-border pt-4 text-[13px] text-text-muted">
                                    {t('Nothing is waiting for you.')}
                                </p>
                            ) : (
                                <ul className="flex flex-col border-b border-solid border-border">
                                    {attention.map((item) => {
                                        const line = attentionLine(
                                            item,
                                            currency,
                                        );
                                        const body = (
                                            <>
                                                <span
                                                    className={`h-2 w-2 shrink-0 rounded-full ${TONES[item.tone]}`}
                                                />
                                                <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                                    <span className="text-[14px] leading-5 font-semibold text-text">
                                                        {line.title}
                                                    </span>
                                                    {line.sub && (
                                                        <span className="truncate text-[12px] leading-4 text-text-muted">
                                                            {line.sub}
                                                        </span>
                                                    )}
                                                </span>
                                                {line.href && (
                                                    <span className="text-[16px] text-text-muted">
                                                        ›
                                                    </span>
                                                )}
                                            </>
                                        );

                                        return (
                                            <li
                                                key={item.key}
                                                className="border-t border-solid border-border"
                                            >
                                                {line.href ? (
                                                    <Link
                                                        href={line.href}
                                                        className="flex items-center gap-3 py-3 hover:bg-surface"
                                                    >
                                                        {body}
                                                    </Link>
                                                ) : (
                                                    <span className="flex items-center gap-3 py-3">
                                                        {body}
                                                    </span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Section>
                    </div>
                </div>
            )}

            {(attendance.series.length > 0 || results) && (
                <div className="grid grid-cols-1 gap-12 border-b border-solid border-border py-9 lg:grid-cols-2">
                    <Section
                        title={t('Attendance')}
                        sub={
                            range === 'year'
                                ? t('Students present, week by week this year')
                                : t('Students present, last 20 school days')
                        }
                    >
                        {attendance.series.length === 0 ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] text-text-muted">
                                {t('No register has been taken yet.')}
                            </p>
                        ) : (
                            <AttendanceChart series={attendance.series} />
                        )}
                        {attendance.lowest && (
                            <p className="text-[12px] leading-4 text-text-muted">
                                {t('Lowest this month: :class at :rate%', {
                                    class: attendance.lowest.class,
                                    rate: attendance.lowest.rate,
                                })}
                            </p>
                        )}
                    </Section>
                    {results && (
                        <Section
                            title={t('Results by class')}
                            sub={t(':measure · :plan, published :date', {
                                measure:
                                    measure === 'average'
                                        ? t('Class average out of 20')
                                        : t('Share of students who passed'),
                                plan: results.plan,
                                date: dayMonth(results.published_on, false),
                            })}
                            action={
                                <Segmented
                                    small
                                    options={[
                                        {
                                            value: 'average',
                                            label: t('Average'),
                                        },
                                        {
                                            value: 'rate',
                                            label: t('Pass rate'),
                                        },
                                    ]}
                                    value={measure}
                                    onChange={setMeasure}
                                />
                            }
                        >
                            {results.classes.length === 0 ? (
                                <p className="rounded-md bg-surface p-4 text-[13px] text-text-muted">
                                    {t('No class has results yet.')}
                                </p>
                            ) : (
                                <ResultsChart
                                    classes={results.classes}
                                    passMark={results.pass_mark}
                                    measure={measure}
                                    onOpen={(row) =>
                                        router.visit(
                                            resultsPage.url({
                                                query: {
                                                    plan: results.plan_id,
                                                    class: row.id,
                                                },
                                            }),
                                        )
                                    }
                                />
                            )}
                        </Section>
                    )}
                </div>
            )}

            {(levels.length > 0 || admissions) && (
                <div className="grid grid-cols-1 gap-12 pt-9 lg:grid-cols-2">
                    {levels.length > 0 && (
                        <Section
                            title={t('Students by level')}
                            sub={t(':count enrolled · :year', {
                                count: counts.students,
                                year: props.yearLabel ?? '',
                            })}
                            action={
                                <div className="flex gap-[14px] text-[12px] leading-4 text-text">
                                    <span className="flex items-center gap-[6px]">
                                        <span className="h-[10px] w-[10px] rounded-[3px] bg-arts" />
                                        {t('Girls :count', {
                                            count: levels.reduce(
                                                (sum, level) =>
                                                    sum + level.girls,
                                                0,
                                            ),
                                        })}
                                    </span>
                                    <span className="flex items-center gap-[6px]">
                                        <span className="h-[10px] w-[10px] rounded-[3px] bg-science" />
                                        {t('Boys :count', {
                                            count: levels.reduce(
                                                (sum, level) =>
                                                    sum + level.boys,
                                                0,
                                            ),
                                        })}
                                    </span>
                                </div>
                            }
                        >
                            <LevelsChart levels={levels} />
                        </Section>
                    )}
                    {admissions && (
                        <Section
                            title={t('Admissions for :year', {
                                year: admissions.year,
                            })}
                            sub={t('From application to a place in a class')}
                        >
                            <div className="flex flex-col gap-[14px]">
                                {funnel.map((step, position) => (
                                    <div
                                        key={step.label}
                                        className="flex flex-col gap-[6px]"
                                    >
                                        <span className="flex justify-between text-[13px] text-text">
                                            <span>
                                                {step.label}
                                                {step.note !== null &&
                                                    step.note > 0 && (
                                                        <span className="text-text-muted">
                                                            {' · '}
                                                            {Math.round(
                                                                (step.count /
                                                                    step.note) *
                                                                    100,
                                                            )}
                                                            %
                                                        </span>
                                                    )}
                                            </span>
                                            <span className="font-mono text-[12px]">
                                                {step.count}
                                            </span>
                                        </span>
                                        <span className="flex h-3 rounded-full bg-surface">
                                            <span
                                                className="h-3 rounded-full bg-primary"
                                                style={{
                                                    width: `${admissions.applied > 0 ? (step.count / admissions.applied) * 100 : 0}%`,
                                                    opacity:
                                                        1 - position * 0.17,
                                                }}
                                            />
                                        </span>
                                    </div>
                                ))}
                                <Link
                                    href={applications.url()}
                                    className="text-[12px] font-medium text-primary hover:underline"
                                >
                                    {t('Open admissions →')}
                                </Link>
                            </div>
                        </Section>
                    )}
                </div>
            )}
        </div>
    );
}

export default withAppShell(Dashboard);
