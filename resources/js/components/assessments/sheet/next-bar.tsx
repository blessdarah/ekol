import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { primaryClass, quietClass } from '../ui';
import type { NextStep } from './model';

/**
 * Shown once the sheet is submitted: how far the class (or the teacher)
 * has got, a way back, and the next sheet still to fill.
 */
export function NextBar({
    next,
    subject,
    className_,
    plan,
    backHref,
    sheetHref,
}: {
    next: NextStep;
    subject: string | null;
    className_: string | null;
    plan: string;
    backHref: string;
    sheetHref: (id: string) => string;
}) {
    const fromProgress = next.mode === 'class';
    const done = next.sheet === null;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-success-tint px-5 py-4">
            <div className="flex min-w-0 items-center gap-[14px]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success">
                    <svg width="15" height="15" viewBox="0 0 24 24">
                        <path
                            d="M5 12.5l4.5 4.5L19 7.5"
                            fill="none"
                            stroke="var(--color-bg)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
                <span className="flex min-w-0 flex-col gap-[2px]">
                    <span className="text-[15px] leading-5 font-semibold text-text">
                        {fromProgress
                            ? t(':subject is in for :class', {
                                  subject: subject ?? '',
                                  class: className_ ?? '',
                              })
                            : t(':subject · :class is submitted', {
                                  subject: subject ?? '',
                                  class: className_ ?? '',
                              })}
                    </span>
                    <span className="text-[13px] leading-[18px] text-text-muted">
                        {done
                            ? fromProgress
                                ? t('Every sheet for :class is in.', {
                                      class: className_ ?? '',
                                  })
                                : t('All your :plan sheets are in.', { plan })
                            : fromProgress
                              ? t(
                                    ':submitted of :total sheets submitted · still missing: :missing',
                                    {
                                        submitted: next.submitted,
                                        total: next.total,
                                        missing: next.missing.join(', '),
                                    },
                                )
                              : t(
                                    ':submitted of your :total sheets for :plan are in · still to do: :missing',
                                    {
                                        submitted: next.submitted,
                                        total: next.total,
                                        plan,
                                        missing: next.missing.join(', '),
                                    },
                                )}
                    </span>
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-[10px]">
                <Link href={backHref} className={quietClass}>
                    {fromProgress
                        ? t('Back to Marks progress')
                        : t('Back to My marks')}
                </Link>
                {next.sheet && (
                    <Link
                        href={sheetHref(next.sheet.id)}
                        className={primaryClass}
                    >
                        {fromProgress
                            ? t('Next missing: :subject · :class →', {
                                  subject: next.sheet.subject ?? '',
                                  class: next.sheet.class ?? '',
                              })
                            : t('Next: :subject · :class →', {
                                  subject: next.sheet.subject ?? '',
                                  class: next.sheet.class ?? '',
                              })}
                    </Link>
                )}
            </div>
        </div>
    );
}
