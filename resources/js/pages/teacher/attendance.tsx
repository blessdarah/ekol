import { Head } from '@inertiajs/react';
import { AttendanceHeader } from '../../components/teacher/attendance/attendance-header';
import { LessonPicker } from '../../components/teacher/attendance/lesson-picker';
import {
    type AttendanceProps,
    useAttendance,
} from '../../components/teacher/attendance/model';
import { NoLessons } from '../../components/teacher/attendance/no-lessons';
import { Register } from '../../components/teacher/attendance/register';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Attendance(props: AttendanceProps) {
    const attendance = useAttendance(props);
    const { date, dateLabel, lessons, roll, current } = attendance;

    return (
        <div className="flex flex-col gap-6">
            <Head title={t('Take attendance')} />
            <AttendanceHeader attendance={attendance} />

            {lessons.length === 0 || !current ? (
                <NoLessons attendance={attendance} />
            ) : (
                <>
                    <LessonPicker lessons={lessons} current={current} />

                    <Register
                        key={current.id}
                        lesson={current}
                        roll={roll}
                        date={date}
                        dateLabel={dateLabel}
                    />
                </>
            )}
        </div>
    );
}

export default withAppShell(Attendance);
