import { Head } from '@inertiajs/react';
import { TableFooter } from '../../components/table/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { EmptyRoster } from '../../components/subjects/roster/empty-roster';
import {
    type RosterProps,
    useSubjectRoster,
} from '../../components/subjects/roster/model';
import { RosterExport } from '../../components/subjects/roster/roster-export';
import { RosterHeader } from '../../components/subjects/roster/roster-header';
import { RosterToolbar } from '../../components/subjects/roster/roster-toolbar';
import { SubjectTable } from '../../components/subjects/roster/subject-table';

function SubjectRoster(props: RosterProps) {
    const roster = useSubjectRoster(props);
    const { counts, subjects, table, exporting } = roster;

    return (
        <div className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Rooms and subjects')} />
            <RosterHeader roster={roster} />

            {counts.total === 0 ? (
                <EmptyRoster />
            ) : (
                <div className="flex flex-1 flex-col gap-4">
                    <RosterToolbar roster={roster} />
                    <SubjectTable roster={roster} />

                    <div className="mt-auto">
                        <TableFooter
                            paged={subjects}
                            onPage={table.page}
                            onPerPage={table.perPage}
                        />
                    </div>
                </div>
            )}

            {exporting && <RosterExport roster={roster} />}
        </div>
    );
}

export default withAppShell(SubjectRoster);
