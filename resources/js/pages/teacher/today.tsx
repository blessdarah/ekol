import { Head } from '@inertiajs/react';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { LessonsCard } from '../../components/teacher/today/lessons-card';
import { MarksCard } from '../../components/teacher/today/marks-card';
import { MarksNote } from '../../components/teacher/today/marks-note';
import {
    type TodayProps,
    useToday,
} from '../../components/teacher/today/model';
import { NextLesson } from '../../components/teacher/today/next-lesson';
import { PendingCards } from '../../components/teacher/today/pending-cards';
import { TodayHeader } from '../../components/teacher/today/today-header';

function Today(props: TodayProps) {
    const today = useToday(props);

    return (
        <div className="flex flex-col gap-6">
            <Head title={t('Today')} />
            <TodayHeader today={today} />

            <NextLesson today={today} />

            <div className="flex flex-col gap-6 xl:flex-row">
                <MarksCard today={today} />
                <LessonsCard today={today} />
            </div>

            <PendingCards />

            <MarksNote />
        </div>
    );
}

export default withAppShell(Today);
