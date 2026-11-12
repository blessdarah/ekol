import { t } from '../../../lib/i18n';
import { type AttendanceModel, monoCaps } from './model';

/** The date, the lesson being marked, and the page title. */
export function AttendanceHeader({
    attendance,
}: {
    attendance: AttendanceModel;
}) {
    const { dateLabel, weekLabel, current } = attendance;

    return (
        <div className="flex flex-col gap-[6px]">
            <p className={`${monoCaps} text-text-muted`}>
                {dateLabel}
                {weekLabel ? ` · ${weekLabel}` : ''}
                {current ? ` · ${current.period} · ${current.time}` : ''}
            </p>
            <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                {t('Take attendance')}
            </h1>
            <p className="text-[14px] leading-5 text-text-muted">
                {current
                    ? t(
                          ':class · :subject:room · one register per lesson, not per class',
                          {
                              class: current.class,
                              subject: current.subject,
                              room: current.room
                                  ? t(' · Room :room', { room: current.room })
                                  : '',
                          },
                      )
                    : t('One register per lesson, not per class')}
            </p>
        </div>
    );
}
