import { t } from '../../../lib/i18n';
import { type AttendanceModel } from './model';

/** Why there is no register to mark today. */
export function NoLessons({ attendance }: { attendance: AttendanceModel }) {
    const { hasTimetable } = attendance;

    return (
        <div className="flex flex-col gap-2 rounded-lg bg-surface p-5">
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                {hasTimetable
                    ? t('You have no lessons today')
                    : t('No timetable is published yet')}
            </p>
            <p className="max-w-[600px] text-[13px] leading-[19px] text-text">
                {hasTimetable
                    ? t(
                          'A register appears here for each lesson on your timetable, on the day it is taught.',
                      )
                    : t(
                          'Registers follow the published timetable. They appear here once the school publishes it.',
                      )}
            </p>
        </div>
    );
}
