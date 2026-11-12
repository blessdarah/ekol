import { WEEKDAYS, sectionLabelClass } from '../ui';
import { t } from '../../../lib/i18n';
import { describeTime, type StaffRecordModel } from './model';
import { Row } from './row';

/** When the member can teach and how many periods. */
export function HoursSection({ record }: { record: StaffRecordModel }) {
    const { member, schoolDays, setChangingHours, they, Their, teachingDays } =
        record;

    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
                <p className={sectionLabelClass}>
                    {t(':their teaching days and hours', {
                        their: Their,
                    })}
                </p>
                <button
                    type="button"
                    onClick={() => setChangingHours(true)}
                    className="text-[13px] leading-4 font-medium text-primary hover:underline"
                >
                    {t('Change')}
                </button>
            </div>
            <dl className="flex flex-col">
                <div className="flex items-center gap-4 border-t border-solid border-border py-[9px]">
                    <dt className="w-[176px] shrink-0 text-[13px] text-text-muted">
                        {t('Teaching days')}
                    </dt>
                    <dd className="flex flex-wrap gap-[6px]">
                        {WEEKDAYS.map((name) => t(name)).map((day, i) => {
                            const bit = 1 << i;

                            if ((schoolDays & bit) === 0) {
                                return null;
                            }

                            return (
                                <span
                                    key={day}
                                    className={`flex h-[26px] w-11 shrink-0 items-center justify-center rounded-sm text-[12px] leading-4 ${
                                        (teachingDays & bit) !== 0
                                            ? 'bg-primary-tint font-semibold text-primary'
                                            : 'border border-solid border-border text-text-muted'
                                    }`}
                                >
                                    {day}
                                </span>
                            );
                        })}
                    </dd>
                </div>
                <Row label={t('Most periods a week')}>
                    {member.max_periods_week ?? t('No limit')} · {they.subject}{' '}
                    {they.subject === 'they' ? t('teach') : t('teaches')}{' '}
                    {member.periods_taught} {t('now')}
                </Row>
                <Row label={t('Most periods a day')}>
                    <span className="font-mono">
                        {member.max_periods_day ?? 6}
                    </span>
                </Row>
                <Row label={t('Cannot teach')} last>
                    {member.unavailable_times.length > 0 ? (
                        <span className="flex flex-col gap-1">
                            {member.unavailable_times.map((time, i) => (
                                <span key={i}>{describeTime(time)}</span>
                            ))}
                        </span>
                    ) : (
                        t('Nothing set')
                    )}
                </Row>
            </dl>
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'If nothing is set, a teacher can teach every day, up to 6 periods a day. The timetable only reads this.',
                )}
            </p>
        </section>
    );
}
