import { Head } from '@inertiajs/react';
import { AfterPublishing } from '../../components/assessments/schedule/after-publishing';
import { LevelChips } from '../../components/assessments/schedule/level-chips';
import {
    type OpenLevel,
    type OpenPlan,
    type ScheduleProps,
    useSchedule,
} from '../../components/assessments/schedule/model';
import { NoExam } from '../../components/assessments/schedule/no-exam';
import { PaperForm } from '../../components/assessments/schedule/paper-form';
import { PaperTable } from '../../components/assessments/schedule/paper-table';
import { PublishChecklist } from '../../components/assessments/schedule/publish-checklist';
import { ScheduleHeader } from '../../components/assessments/schedule/schedule-header';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

/** The papers of a scheduled exam, level by level. */
function ScheduleEditor(
    props: ScheduleProps & { plan: OpenPlan; level: OpenLevel },
) {
    const schedule = useSchedule(props);
    const { plan, level, rooms, staff, current, locked, setEditing } = schedule;

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Exam schedule')} />
            <ScheduleHeader schedule={schedule} />

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <LevelChips schedule={schedule} />
                    <PaperTable schedule={schedule} />
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[320px] lg:border-l lg:pl-7">
                    {current && !locked && (
                        <PaperForm
                            key={`${level.id}-${current.subject_id}`}
                            plan={plan}
                            levelId={level.id}
                            row={current}
                            rooms={rooms}
                            staff={staff}
                            onClose={() => setEditing(null)}
                        />
                    )}
                    <PublishChecklist schedule={schedule} />
                    <AfterPublishing schedule={schedule} />
                </aside>
            </div>
        </div>
    );
}

function Schedule(props: ScheduleProps) {
    const { tabs, plan, level } = props;

    if (!plan || !level) {
        return <NoExam tabs={tabs} />;
    }

    return <ScheduleEditor {...props} plan={plan} level={level} />;
}

export default withAppShell(Schedule);
