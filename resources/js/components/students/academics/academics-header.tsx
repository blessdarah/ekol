import { Link } from '@inertiajs/react';
import { edit } from '@/actions/App/Http/Controllers/StudentRegistrationController';
import { t } from '../../../lib/i18n';
import { outlineButtonClass } from '../../structure/ui';
import { StudentHeader } from '../ui';
import { type StudentAcademics } from './model';

/** The student's header with the edit button. */
export function AcademicsHeader({
    academics,
}: {
    academics: StudentAcademics;
}) {
    const { student } = academics;

    return (
        <StudentHeader
            trail={[{ label: student.name }, { label: t('Academics') }]}
            title={student.name}
            tag={[student.matricule, student.class, student.series]
                .filter(Boolean)
                .join(' · ')}
            action={
                <Link
                    href={edit.url(student.id)}
                    className={outlineButtonClass}
                >
                    {t('Edit student')}
                </Link>
            }
        />
    );
}
