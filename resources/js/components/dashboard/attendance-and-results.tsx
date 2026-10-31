import { router } from '@inertiajs/react';
import { useState } from 'react';
import { results as resultsPage } from '@/actions/App/Http/Controllers/AssessmentResultController';
import { t } from '../../lib/i18n';
import { dayMonth } from '../fees/ui';
import { AttendanceChart, ResultsChart } from './charts';
import type { DashboardProps } from './model';
import { Section, Segmented } from './parts';

/** Attendance over time beside results by class. */
export function AttendanceAndResults({ props }: { props: DashboardProps }) {
    const [measure, setMeasure] = useState<'average' | 'rate'>('average');
    const { range = 'term', attendance, results } = props;

    if (!attendance || (attendance.series.length === 0 && !results)) {
        return null;
    }

    return (
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
    );
}
