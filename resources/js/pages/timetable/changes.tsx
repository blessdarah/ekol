import { Head } from '@inertiajs/react';
import { ChangeActions } from '../../components/timetable/changes/change-actions';
import { ChangeFilters } from '../../components/timetable/changes/change-filters';
import { ChangesHeader } from '../../components/timetable/changes/changes-header';
import { ClassChange } from '../../components/timetable/changes/class-change';
import { CoverTable } from '../../components/timetable/changes/cover-table';
import {
    type ChangesProps,
    useTimetableChanges,
} from '../../components/timetable/changes/model';
import { ModeSwitch } from '../../components/timetable/changes/mode-switch';
import { NothingLive } from '../../components/timetable/changes/nothing-live';
import { RecentChanges } from '../../components/timetable/changes/recent-changes';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Changes(props: ChangesProps) {
    const changes = useTimetableChanges(props);
    const { live, mode } = changes;

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Timetable changes')} />
            <ChangesHeader changes={changes} />

            {live === null ? (
                <NothingLive changes={changes} />
            ) : (
                <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        <ModeSwitch changes={changes} />

                        <ChangeFilters changes={changes} />

                        {mode === 'cover' && props.teacher && (
                            <CoverTable changes={changes} />
                        )}

                        {mode !== 'cover' && props.class && (
                            <ClassChange changes={changes} />
                        )}

                        <ChangeActions changes={changes} />
                    </div>

                    <RecentChanges changes={changes} />
                </div>
            )}
        </div>
    );
}

export default withAppShell(Changes);
