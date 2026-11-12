import { t } from '../../../lib/i18n';
import { Check } from './check';
import { type SeriesEditModel } from './model';

/** Whether the series is ready, and any subject without a teacher. */
export function SeriesChecks({ model }: { model: SeriesEditModel }) {
    const { core, inPool, electivesAllowed, unstaffed } = model;

    return (
        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                {t('Checks')}
            </p>
            <ul className="flex flex-col gap-[10px]">
                <Check tone={core.length > 0 ? 'success' : 'warning'}>
                    {core.length > 0
                        ? t('At least one core subject')
                        : t(
                              'No core subject yet. The series shows as “Needs setup”.',
                          )}
                </Check>
                <Check
                    tone={
                        inPool.length > electivesAllowed ? 'success' : 'warning'
                    }
                >
                    {inPool.length > electivesAllowed
                        ? t(
                              'Pool is larger than the :electives_allowed electives allowed',
                              {
                                  electives_allowed: electivesAllowed,
                              },
                          )
                        : t(
                              'Pool of :in_pool gives no real choice among the :electives_allowed electives allowed',
                              {
                                  in_pool: inPool.length,
                                  electives_allowed: electivesAllowed,
                              },
                          )}
                </Check>
                {unstaffed.map((subject) => (
                    <Check key={subject.id} tone="warning">
                        {t(':subject has no teacher. You can still save.', {
                            subject: subject.name,
                        })}
                    </Check>
                ))}
            </ul>
        </div>
    );
}
