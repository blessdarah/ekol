import { Head } from '@inertiajs/react';
import { CapacityWarning } from '../../components/enrolment/placement/capacity-warning';
import { ClassGrid } from '../../components/enrolment/placement/class-grid';
import { ConfirmChecklist } from '../../components/enrolment/placement/confirm-checklist';
import { LevelSwitch } from '../../components/enrolment/placement/level-switch';
import {
    type PlacementProps,
    useClassPlacement,
} from '../../components/enrolment/placement/model';
import { PlacementEmpty } from '../../components/enrolment/placement/placement-empty';
import { PlacementHeader } from '../../components/enrolment/placement/placement-header';
import { WaitingList } from '../../components/enrolment/placement/waiting-list';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Placement(props: PlacementProps) {
    const classPlacement = useClassPlacement(props);
    const { level, classes } = classPlacement;

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Class placement')} />
            <PlacementHeader classPlacement={classPlacement} />

            {!level ? (
                <PlacementEmpty />
            ) : (
                <>
                    <LevelSwitch
                        classPlacement={classPlacement}
                        level={level}
                    />

                    {(level.expected > level.seats || classes.length === 0) && (
                        <CapacityWarning
                            classPlacement={classPlacement}
                            level={level}
                        />
                    )}

                    <div className="flex flex-col gap-6 lg:flex-row">
                        <WaitingList
                            classPlacement={classPlacement}
                            level={level}
                        />

                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <ClassGrid
                                classPlacement={classPlacement}
                                level={level}
                            />

                            <ConfirmChecklist classPlacement={classPlacement} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(Placement);
