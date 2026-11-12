import { Link } from '@inertiajs/react';
import { create } from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import {
    ManagementTabs,
    PlusIcon,
    StructureHeader,
    solidButtonClass,
} from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { plural, type SubjectRosterModel } from './model';

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
                meta={t(
                    ':subjects · :departments · :needs_teacher :need a teacher',
                    {
                        subjects: plural(counts.total, 'subject', 'subjects'),
                        departments: plural(
                            counts.departments,
                            'department',
                            'departments',
                        ),
                        needs_teacher: counts.needs_teacher,
                        need: counts.needs_teacher === 1 ? 'needs' : 'need',
                    },
                )}
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
