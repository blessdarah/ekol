import { router } from '@inertiajs/react';
import { close } from '@/actions/App/Http/Controllers/AssessmentProgressController';
import { linkClass, primaryClass, quietClass } from '../ui';
import { t } from '../../../lib/i18n';
import { type MarksProgressModel } from './model';
export function CloseMarks({
    plan,
    stats,
    setClosing,
    setExtending,
    left,
}: Pick<
    MarksProgressModel,
    'plan' | 'stats' | 'setClosing' | 'setExtending' | 'left'
>) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('Close marks entry')}
            className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4"
        >
            <div className="flex w-full max-w-[520px] flex-col gap-4 rounded-lg bg-white p-6">
                <div className="flex flex-col gap-2">
                    <h2 className="font-display text-[22px] leading-7 font-bold tracking-[-0.01em] text-text">
                        {t('Close marks entry for :plan?', {
                            plan: plan.name,
                        })}
                    </h2>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {stats.submitted} {t('of')} {stats.total}{' '}
                        {t('mark sheets are in.')}
                        {left > 0
                            ? t(
                                  ' :left :are still not submitted, from :teachers :teachers_a.',
                                  {
                                      left,
                                      are: left === 1 ? 'is' : 'are',
                                      teachers: stats.teachers,
                                      teachers_a:
                                          stats.teachers === 1
                                              ? 'teacher'
                                              : 'teachers',
                                  },
                              )
                            : t(' Every sheet is submitted.')}
                    </p>
                </div>
                <ul className="flex flex-col border-y border-solid border-border">
                    {[
                        {
                            tone: 'bg-warning',
                            text: t(
                                'Teachers can no longer enter or change :plan marks.',
                                { plan: plan.name },
                            ),
                        },
                        {
                            tone: 'bg-warning',
                            text: t(
                                'Empty marks stay empty. A student with a missing mark is not ranked until it is in.',
                            ),
                        },
                        {
                            tone: 'bg-success',
                            text: t(
                                'Results open for review. Nothing is published yet.',
                            ),
                        },
                        {
                            tone: 'bg-success',
                            text: t(
                                'You can give teachers more time by reopening marks entry, until results are published.',
                            ),
                        },
                    ].map((line) => (
                        <li
                            key={line.text}
                            className="flex items-start gap-[10px] border-b border-solid border-border py-[10px] text-[14px] leading-5 text-text last:border-b-0"
                        >
                            <span
                                className={`mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full ${line.tone}`}
                            />
                            {t(line.text)}
                        </li>
                    ))}
                </ul>
                <p className="text-[13px] leading-[18px] text-text-muted">
                    {t('Teachers are not told automatically.')}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            setClosing(false);
                            setExtending(true);
                        }}
                        className={linkClass}
                    >
                        {t('Extend the window instead')}
                    </button>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setClosing(false)}
                            className={quietClass}
                        >
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.post(close.url(plan.id))}
                            className={primaryClass}
                        >
                            {t('Close marks entry →')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
