import { Link } from '@inertiajs/react';
import { confirm as confirmPage } from '@/actions/App/Http/Controllers/EnrolmentConfirmationController';
import { t } from '../../../lib/i18n';
import { solidButtonClass } from '../../structure/ui';
import { count } from '../ui';
import { type EnrolmentOverview } from './model';

/** The last step: confirming the year once everyone has a class. */
export function ConfirmYear({ overview }: { overview: EnrolmentOverview }) {
    const { enrolment } = overview;

    return (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-solid border-border font-mono text-[12px] leading-4 text-text-muted">
                    4
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-[15px] leading-5 font-semibold text-text">
                        {t('Confirm the new year')}
                    </p>
                    <p className="text-[13px] leading-[18px] text-text-muted">
                        {enrolment.confirmed
                            ? t(':year is confirmed.', {
                                  year: enrolment.year,
                              })
                            : enrolment.ready
                              ? t(
                                    'Every admitted and promoted student has a class. Confirm makes them Enrolled.',
                                )
                              : t(
                                    'Opens when every admitted and promoted student has a class · :unplaced still to place',
                                    { unplaced: count(enrolment.unplaced) },
                                )}
                    </p>
                </div>
            </div>
            <Link
                href={confirmPage.url()}
                className={
                    enrolment.ready && !enrolment.confirmed
                        ? solidButtonClass
                        : 'flex h-9 items-center rounded-md border border-solid border-border bg-surface px-4 text-[13px] leading-4 font-semibold text-text-muted hover:text-text'
                }
            >
                {enrolment.confirmed
                    ? t('Open confirmation')
                    : t('Confirm :year', { year: enrolment.year })}
            </Link>
        </section>
    );
}
