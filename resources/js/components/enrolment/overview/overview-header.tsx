import { t } from '../../../lib/i18n';
import { fullDate } from '../../students/ui';
import { EnrolmentHeader } from '../ui';
import { type EnrolmentOverview } from './model';

/** The year being prepared, whether it is confirmed, and when it starts. */
export function OverviewHeader({ overview }: { overview: EnrolmentOverview }) {
    const { enrolment, startsOn } = overview;

    return (
        <EnrolmentHeader
            progress={enrolment}
            title={t('Prepare :year', { year: enrolment.year })}
            status={
                enrolment.confirmed ? (
                    <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-surface px-2 text-[12px] leading-4 font-medium text-text">
                        {t('Confirmed')}
                    </span>
                ) : (
                    <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                        {t('Open')}
                    </span>
                )
            }
            meta={
                startsOn
                    ? t('for the year starting :starts_on', {
                          starts_on: fullDate(startsOn),
                      })
                    : undefined
            }
        />
    );
}
