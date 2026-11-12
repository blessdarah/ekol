import { Head } from '@inertiajs/react';
import { PageHeader, SplitLayout } from '../../components/staff/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { HoursDialog } from '../../components/staff/record/hours-dialog';
import { HoursSection } from '../../components/staff/record/hours-section';
import { MemberCard } from '../../components/staff/record/member-card';
import {
    type RecordProps,
    useStaffRecord,
} from '../../components/staff/record/model';
import { RecordAside } from '../../components/staff/record/record-aside';
import { WhoSection } from '../../components/staff/record/who-section';
import { WorkSection } from '../../components/staff/record/work-section';

function StaffRecord(props: RecordProps) {
    const record = useStaffRecord(props);
    const {
        yearLabel,
        member,
        schoolDays,
        periods,
        changingHours,
        setChangingHours,
        employment,
    } = record;

    return (
        <div className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]">
            <Head title={member.name} />
            <PageHeader
                crumb={member.name}
                title={t('One staff record')}
                tag={t('Record:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={[
                    member.formal_name,
                    member.role_label,
                    employment,
                    member.has_account ? 'portal on' : 'no account yet',
                ]
                    .filter(Boolean)
                    .join(' · ')}
            />

            <SplitLayout aside={<RecordAside record={record} />}>
                <MemberCard record={record} />

                <WhoSection record={record} />

                <WorkSection record={record} />

                <HoursSection record={record} />
            </SplitLayout>

            {changingHours && (
                <HoursDialog
                    member={member}
                    schoolDays={schoolDays}
                    periods={periods}
                    onClose={() => setChangingHours(false)}
                />
            )}
        </div>
    );
}

export default withAppShell(StaffRecord);
