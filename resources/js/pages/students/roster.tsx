import { Head } from '@inertiajs/react';
import {
    type RosterProps,
    useStudentRoster,
} from '../../components/students/roster/model';
import { NoStudents } from '../../components/students/roster/no-students';
import { RosterExport } from '../../components/students/roster/roster-export';
import { RosterHeader } from '../../components/students/roster/roster-header';
import { RosterToolbar } from '../../components/students/roster/roster-toolbar';
import { StudentTable } from '../../components/students/roster/student-table';
import { TableFooter } from '../../components/table/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function StudentRoster(props: RosterProps) {
    const roster = useStudentRoster(props);
    const { counts, students, table, exporting } = roster;

    return (
        <div className="flex flex-col gap-6">
            <Head title={t('Students')} />
            <RosterHeader roster={roster} />

            {counts.total === 0 ? (
                <NoStudents />
            ) : (
                <>
                    <RosterToolbar roster={roster} />
                    <StudentTable roster={roster} />
                    <TableFooter
                        paged={students}
                        onPage={table.page}
                        onPerPage={table.perPage}
                    />
                </>
            )}

            {exporting && <RosterExport roster={roster} />}
        </div>
    );
}

export default withAppShell(StudentRoster);
