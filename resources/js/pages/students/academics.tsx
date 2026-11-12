import { Head } from '@inertiajs/react';
import { AcademicsAside } from '../../components/students/academics/academics-aside';
import { AcademicsHeader } from '../../components/students/academics/academics-header';
import { AcademicsStats } from '../../components/students/academics/academics-stats';
import { MarksNote } from '../../components/students/academics/marks-note';
import { MarksTable } from '../../components/students/academics/marks-table';
import {
    type AcademicsProps,
    useStudentAcademics,
} from '../../components/students/academics/model';
import { TermSwitch } from '../../components/students/academics/term-switch';
import { StudentSteps, StudentTabs } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Academics(props: AcademicsProps) {
    const academics = useStudentAcademics(props);
    const { neighbours, student, terms, term, columns } = academics;

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head
                title={t(':student · Academics', { student: student.name })}
            />
            <AcademicsHeader academics={academics} />
            <StudentTabs studentId={student.id} active="academics" />

            {terms.length > 1 && <TermSwitch academics={academics} />}

            {!student.class ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        ':student is not in a class this year, so there are no marks to show.',
                        { student: student.name },
                    )}
                </p>
            ) : columns.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t('No assessment is scheduled for')}{' '}
                    {term?.label ?? t('this term')}{' '}
                    {t(
                        'yet. Marks appear here once one is, and teachers start entering them.',
                    )}
                </p>
            ) : (
                <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                        <AcademicsStats academics={academics} />

                        <MarksTable academics={academics} />

                        <MarksNote academics={academics} />
                    </div>

                    <AcademicsAside academics={academics} />
                </div>
            )}
            <StudentSteps active="academics" neighbours={neighbours} />
        </div>
    );
}

export default withAppShell(Academics);
