import { t } from '../../lib/i18n';
import { Sparkline, SplitBar, compact } from './charts';
import type { DashboardProps } from './model';
import { Headline, Of } from './parts';

/** The four headline numbers, each shown only to those who may see it. */
export function DashboardHeadlines({ props }: { props: DashboardProps }) {
    const {
        currency = 'XAF',
        fees: money,
        attendance,
        marks,
        schemes: plans,
    } = props;
    const share =
        money && money.due > 0
            ? Math.min(100, Math.round((money.collected / money.due) * 100))
            : 0;

    if (!attendance) {
        return null;
    }

    return (
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
                            .filter((value): value is number => value !== null)}
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
                    value={<Of part={marks.submitted} whole={marks.total} />}
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
    );
}
