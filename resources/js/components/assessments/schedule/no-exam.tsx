import { Head, Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/AssessmentController';
import { t } from '../../../lib/i18n';
import { AssessmentHeader, type AssessmentTabs, Empty } from '../ui';

/** Shown until an exam is scheduled on the calendar. */
export function NoExam({ tabs }: { tabs: AssessmentTabs }) {
    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Exam schedule')} />
            <AssessmentHeader
                active="schedule"
                tabs={tabs}
                trail={[{ label: t('Exam schedule') }]}
                title={t('Exam schedule')}
            />
            <Empty title={t('No exam is scheduled yet')}>
                {t(
                    'An exam gets its timetable here once it is scheduled on the calendar.',
                )}{' '}
                <Link
                    href={index.url()}
                    className="font-medium text-primary hover:underline"
                >
                    {t('Open the calendar →')}
                </Link>
            </Empty>
        </div>
    );
}
