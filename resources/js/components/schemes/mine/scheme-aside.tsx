import { t } from '../../../lib/i18n';
import { type MySchemeModel } from './model';
import { UnplacedPanel } from './unplaced-panel';

/** What is left to place, the checks before submitting, and what follows. */
export function SchemeAside({ mine }: { mine: MySchemeModel }) {
    const {
        opening,
        scheme,
        changing,
        editable,
        approved,
        planning,
        unplaced,
        overfull,
        inFree,
        placed,
    } = mine;

    return (
        <aside className="flex shrink-0 flex-col gap-4 xl:w-[330px]">
            {changing && !opening.free_changes && (
                <p className="rounded-lg bg-warning-tint px-4 py-3 text-[13px] leading-[19px] text-text">
                    {t(
                        'Your scheme is approved. Moving or adding a sub-topic sends it back for approval.',
                    )}
                </p>
            )}
            {editable && planning && <UnplacedPanel mine={mine} />}

            {!approved && (
                <div className="flex flex-col gap-2 rounded-lg border border-solid border-border p-4">
                    <span className="text-[14px] font-semibold text-text">
                        {t('Before you submit')}
                    </span>
                    <ul className="flex flex-col gap-2 text-[13px] leading-[19px] text-text">
                        <li className="flex gap-2">
                            <span
                                className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${unplaced.length === 0 ? 'bg-success' : 'bg-warning'}`}
                            />
                            {t(':placed of :total sub-topics are placed.', {
                                placed,
                                total: scheme.items.length,
                            })}
                        </li>
                        <li className="flex gap-2">
                            <span
                                className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${overfull.length === 0 ? 'bg-success' : 'bg-warning'}`}
                            />
                            {overfull.length === 0
                                ? t(
                                      'No week has more periods than the timetable gives.',
                                  )
                                : t(
                                      'Weeks :weeks have more periods than the timetable gives.',
                                      {
                                          weeks: overfull
                                              .map((week) => week.week)
                                              .join(', '),
                                      },
                                  )}
                        </li>
                        <li className="flex gap-2">
                            <span
                                className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${inFree.length === 0 ? 'bg-success' : 'bg-warning'}`}
                            />
                            {inFree.length === 0
                                ? t(
                                      'Test and exam weeks are free of new topics.',
                                  )
                                : t(
                                      ':count sub-topics are in a test or exam week.',
                                      { count: inFree.length },
                                  )}
                        </li>
                    </ul>
                    <p className="text-[12px] text-text-muted">
                        {t(
                            'You can submit with warnings. The approver sees them too.',
                        )}
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                <span className="text-[14px] font-semibold text-text">
                    {approved ? t('Once approved') : t('After you submit')}
                </span>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {opening.approval === 'none'
                        ? t(
                              'No approval is needed this term: the scheme is approved when you submit it. Then tick sub-topics as you teach them.',
                          )
                        : t(
                              'A head of department or the principal approves it, or sends it back with a note. Once approved, you tick sub-topics as taught, and a change needs approval again.',
                          )}
                </p>
            </div>
        </aside>
    );
}
