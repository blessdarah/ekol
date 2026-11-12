import { router } from '@inertiajs/react';
import { submit } from '@/actions/App/Http/Controllers/TeacherSchemeController';
import { dayMonth } from '../../fees/ui';
import { outlineButtonClass, solidButtonClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type MySchemeModel } from './model';

/** The scheme's subject and class, its status, and submitting it. */
export function SchemeHeader({ mine }: { mine: MySchemeModel }) {
    const {
        term,
        opening,
        scheme,
        setErrors,
        changing,
        setChanging,
        editable,
        approved,
        style,
    } = mine;

    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-[6px]">
                <p className="font-mono text-[12px] tracking-[0.06em] text-text-muted uppercase">
                    {t('Scheme of work · :term · due :date', {
                        term: t(term.label),
                        date: dayMonth(opening.due_on, false),
                    })}
                </p>
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {scheme.subject} · {scheme.class}
                </h1>
                <p className="text-[13px] text-text-muted">
                    {approved
                        ? t(
                              'Tick each sub-topic once it is taught. :weeks weeks · :periods periods a week.',
                              {
                                  weeks: term.weeks,
                                  periods: scheme.weekly_periods,
                              },
                          )
                        : t(
                              'Place each sub-topic in the week you will teach it. :weeks weeks · :periods periods a week.',
                              {
                                  weeks: term.weeks,
                                  periods: scheme.weekly_periods,
                              },
                          )}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <span
                    className={`flex h-7 items-center rounded-full px-3 text-[12px] font-medium ${style.pill}`}
                >
                    {t(style.label)}
                </span>
                {editable && approved && (
                    <button
                        type="button"
                        onClick={() => setChanging(!changing)}
                        className={outlineButtonClass}
                    >
                        {changing ? t('Back to ticking') : t('Change the plan')}
                    </button>
                )}
                {editable && !approved && (
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                submit.url(scheme.id),
                                {},
                                {
                                    preserveScroll: true,
                                    onError: (failed) => setErrors(failed),
                                },
                            )
                        }
                        className={solidButtonClass}
                    >
                        {opening.approval === 'none'
                            ? t('Submit')
                            : t('Submit for approval')}
                    </button>
                )}
            </div>
        </div>
    );
}
