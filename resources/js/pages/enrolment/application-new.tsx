import { Head } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/ApplicationRosterController';
import { ApplicantSection } from '../../components/enrolment/application-new/applicant-section';
import { ApplicationAside } from '../../components/enrolment/application-new/application-aside';
import { ComingFromSection } from '../../components/enrolment/application-new/coming-from-section';
import { GuardiansSection } from '../../components/enrolment/application-new/guardians-section';
import {
    type NewApplicationProps,
    useNewApplication,
} from '../../components/enrolment/application-new/model';
import { EnrolmentHeader } from '../../components/enrolment/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function NewApplication(props: NewApplicationProps) {
    const application = useNewApplication(props);
    const { enrolment, submit } = application;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            className="flex flex-col gap-5"
        >
            <Head title={t('Add an application')} />
            <EnrolmentHeader
                progress={enrolment}
                trail={[
                    { label: t('Admissions'), href: index.url() },
                    { label: t('Add an application') },
                ]}
                title={t('Add an application')}
                meta={t('it gets a reference and waits under To review')}
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-7">
                    <ApplicantSection application={application} />
                    <ComingFromSection application={application} />
                    <GuardiansSection application={application} />
                </div>

                <ApplicationAside application={application} />
            </div>
        </form>
    );
}

export default withAppShell(NewApplication);
