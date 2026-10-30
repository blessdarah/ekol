import { Link } from '@inertiajs/react';
import { index as fees } from '@/actions/App/Http/Controllers/FeeController';
import { t } from '../../lib/i18n';
import { dayMonth } from '../fees/ui';
import { FeeChart, compact } from './charts';
import { type DashboardProps, TONES, attentionLine } from './model';
import { Section } from './parts';

/** Fee collection against the instalments, beside what needs the person today. */
export function FeesAndAttention({ props }: { props: DashboardProps }) {
    const {
        currency = 'XAF',
        range = 'term',
        fees: money,
        attention = [],
    } = props;

    if (!money && attention.length === 0) {
        return null;
    }

    return (
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
                                          to: dayMonth(point.ends_on, false),
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
                                const line = attentionLine(item, currency);
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
    );
}
