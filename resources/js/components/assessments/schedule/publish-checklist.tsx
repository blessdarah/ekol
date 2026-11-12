import { Link, router } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/AssessmentController';
import { publish } from '@/actions/App/Http/Controllers/ExamScheduleController';
import { t, tChoice } from '../../../lib/i18n';
import { ErrorText, capsLabelClass } from '../../structure/ui';
import { quietClass } from '../ui';
import { type Schedule } from './model';

/** What is still missing or clashing, and publishing the schedule. */
export function PublishChecklist({ schedule }: { schedule: Schedule }) {
    const { plan, unset, clashes, locked, ready, errors } = schedule;

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
            <p className={capsLabelClass}>
                {plan.has_schedule ? t('Published') : t('Before you publish')}
            </p>
            <ul className="flex flex-col gap-[10px]">
                <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                    <span
                        className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${unset === 0 ? 'bg-success' : 'bg-warning'}`}
                    />
                    {unset === 0
                        ? t('Every subject has a paper')
                        : tChoice(
                              '{1} :count subject has no paper yet|[2,*] :count subjects have no paper yet',
                              unset,
                          )}
                </li>
                {clashes.length === 0 ? (
                    <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                        <span className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                        {t('No room or invigilator is in two places at once')}
                    </li>
                ) : (
                    clashes.map((clash) => (
                        <li
                            key={clash}
                            className="flex items-start gap-2 text-[13px] leading-[18px] text-text"
                        >
                            <span className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                            {clash}
                        </li>
                    ))
                )}
            </ul>
            {!locked && (
                <button
                    type="button"
                    disabled={!ready}
                    onClick={() => router.post(publish.url(plan.id))}
                    className="flex h-10 items-center justify-center rounded-md bg-primary text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                >
                    {plan.has_schedule
                        ? t('Publish again')
                        : t('Publish exam schedule')}
                </button>
            )}
            <ErrorText message={errors.publish} />
            <Link href={index.url()} className={quietClass}>
                {t('← Back to the calendar')}
            </Link>
        </div>
    );
}
