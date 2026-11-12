import { CopyFrom } from '../../components/structure/series-edit/copy-from';
import { CoreSubjects } from '../../components/structure/series-edit/core-subjects';
import { DomainNotice } from '../../components/structure/series-edit/domain-notice';
import { ElectivePool } from '../../components/structure/series-edit/elective-pool';
import {
    type SeriesEditProps,
    useSeriesEdit,
} from '../../components/structure/series-edit/model';
import { NoEligibleSubjects } from '../../components/structure/series-edit/no-eligible-subjects';
import { SeriesActions } from '../../components/structure/series-edit/series-actions';
import { SeriesChecks } from '../../components/structure/series-edit/series-checks';
import { SeriesDetails } from '../../components/structure/series-edit/series-details';
import { SeriesHeader } from '../../components/structure/series-edit/series-header';
import { StudentPreview } from '../../components/structure/series-edit/student-preview';
import { withAppShell } from '../../layouts/app-layout';

function SeriesEdit(props: SeriesEditProps) {
    const model = useSeriesEdit(props);
    const { submit, eligibleSubjects, copySources } = model;

    return (
        <form onSubmit={submit} className="flex flex-col gap-6">
            <SeriesHeader model={model} />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-5">
                    <SeriesDetails model={model} />

                    <DomainNotice model={model} />
                    {eligibleSubjects.length === 0 ? (
                        <NoEligibleSubjects />
                    ) : (
                        <>
                            <CoreSubjects model={model} />

                            <ElectivePool model={model} />
                        </>
                    )}

                    <SeriesActions model={model} />
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <StudentPreview model={model} />

                    <SeriesChecks model={model} />

                    {copySources.length > 0 && <CopyFrom model={model} />}
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(SeriesEdit);
