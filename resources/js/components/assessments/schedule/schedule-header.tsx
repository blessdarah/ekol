import { show } from '@/actions/App/Http/Controllers/ExamScheduleController';
import { t } from '../../../lib/i18n';
import { AssessmentHeader, PlanPicker, day, range } from '../ui';
import { type Schedule } from './model';

/** The exam's title and dates, the exam picker, and what to do here. */
export function ScheduleHeader({ schedule }: { schedule: Schedule }) {
    const { tabs, plans, plan } = schedule;

    return (
        <>
            <AssessmentHeader
                active="schedule"
                tabs={tabs}
                trail={[{ label: t('Exam schedule') }]}
                title={t('Exam schedule')}
                meta={
                    <>
                        <span className="font-mono uppercase">
                            {plan.name} ·{' '}
                            {range(plan.held_from, plan.held_until)}
                        </span>
                        <span>{t('· one paper per subject and level')}</span>
                    </>
                }
            />

            {plans.length > 1 && (
                <PlanPicker
                    plans={plans}
                    current={plan.id}
                    href={(id) => show.url({ query: { plan: id } })}
                    label={t('Exam')}
                />
            )}

            <p className="rounded-lg bg-surface p-4 text-[13px] leading-[19px] text-text-muted">
                {plan.has_schedule
                    ? t(
                          'This schedule is published. Marks open on :window_starts_on and you follow them in Marks progress.',
                          { window_starts_on: day(plan.window_starts_on) },
                      )
                    : t(
                          'Give every subject its paper, then publish. Marks then open on :window_starts_on and you follow them in Marks progress.',
                          { window_starts_on: day(plan.window_starts_on) },
                      )}
            </p>
        </>
    );
}
