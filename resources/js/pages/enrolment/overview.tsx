import { Head } from '@inertiajs/react';
import { ConfirmYear } from '../../components/enrolment/overview/confirm-year';
import { ContinuingCard } from '../../components/enrolment/overview/continuing-card';
import {
    type OpenOverview,
    type OverviewProps,
    useEnrolmentOverview,
} from '../../components/enrolment/overview/model';
import { NewStudentsCard } from '../../components/enrolment/overview/new-students-card';
import { NoYearYet } from '../../components/enrolment/overview/no-year-yet';
import { OverviewHeader } from '../../components/enrolment/overview/overview-header';
import { PlacementCard } from '../../components/enrolment/overview/placement-card';
import { RoomNextYear } from '../../components/enrolment/overview/room-next-year';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

/** The new year's progress, once it is open. */
function OpenYearOverview(props: OpenOverview) {
    const overview = useEnrolmentOverview(props);
    const { enrolment } = overview;

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Prepare :year', { year: enrolment.year })} />
            <OverviewHeader overview={overview} />

            <div className="flex flex-col gap-5 lg:flex-row">
                <NewStudentsCard overview={overview} />
                <ContinuingCard overview={overview} />
                <PlacementCard overview={overview} />
            </div>

            <RoomNextYear overview={overview} />
            <ConfirmYear overview={overview} />
        </div>
    );
}

function Overview(props: OverviewProps) {
    const { enrolment, currentLabel, applications, continuing } = props;

    if (!enrolment || !applications || !continuing) {
        return <NoYearYet currentLabel={currentLabel} />;
    }

    return (
        <OpenYearOverview
            {...props}
            enrolment={enrolment}
            applications={applications}
            continuing={continuing}
        />
    );
}

export default withAppShell(Overview);
