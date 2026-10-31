import { Link } from '@inertiajs/react';
import { index as applications } from '@/actions/App/Http/Controllers/ApplicationRosterController';
import { t } from '../../lib/i18n';
import { LevelsChart } from './charts';
import type { DashboardProps } from './model';
import { Section } from './parts';

/** Students by level beside next year's admissions. */
export function LevelsAndAdmissions({ props }: { props: DashboardProps }) {
    const { counts, levels = [], admissions } = props;
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

    if (levels.length === 0 && !admissions) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 gap-12 pt-9 lg:grid-cols-2">
            {levels.length > 0 && (
                <Section
                    title={t('Students by level')}
                    sub={t(':count enrolled · :year', {
                        count: counts?.students ?? 0,
                        year: props.yearLabel ?? '',
                    })}
                    action={
                        <div className="flex gap-[14px] text-[12px] leading-4 text-text">
                            <span className="flex items-center gap-[6px]">
                                <span className="h-[10px] w-[10px] rounded-[3px] bg-arts" />
                                {t('Girls :count', {
                                    count: levels.reduce(
                                        (sum, level) => sum + level.girls,
                                        0,
                                    ),
                                })}
                            </span>
                            <span className="flex items-center gap-[6px]">
                                <span className="h-[10px] w-[10px] rounded-[3px] bg-science" />
                                {t('Boys :count', {
                                    count: levels.reduce(
                                        (sum, level) => sum + level.boys,
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
                                            opacity: 1 - position * 0.17,
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
    );
}
