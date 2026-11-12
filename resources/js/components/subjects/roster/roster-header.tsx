import { Link } from '@inertiajs/react';
import { create } from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import {
    ManagementTabs,
    PlusIcon,
    StructureHeader,
    solidButtonClass,
} from '../../structure/ui';
import { t, tChoice } from '../../../lib/i18n';
import { type SubjectRosterModel } from './model';

/** The page title, its counts, adding a subject, and the management tabs. */
export function RosterHeader({ roster }: { roster: SubjectRosterModel }) {
    const { yearLabel, counts } = roster;

    return (
        <>
            <StructureHeader
                section="subjects"
                trail={[{ label: t('Subjects') }]}
                title={t('Rooms and subjects')}
                tag={t('Subjects:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={[
                    tChoice(
                        '{1} :count subject|[2,*] :count subjects',
                        counts.total,
                    ),
                    tChoice(
                        '{1} :count department|[2,*] :count departments',
                        counts.departments,
                    ),
                    tChoice(
                        '{1} :count needs a teacher|[2,*] :count need a teacher',
                        counts.needs_teacher,
                    ),
                ].join(' · ')}
                action={
                    <Link href={create.url()} className={solidButtonClass}>
                        <PlusIcon />
                        {t('Add subject')}
                    </Link>
                }
            />
            <ManagementTabs group="resources" active="subjects" />
        </>
    );
}
