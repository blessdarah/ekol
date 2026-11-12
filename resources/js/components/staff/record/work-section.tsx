import { Link } from '@inertiajs/react';
import { access } from '@/actions/App/Http/Controllers/StaffAccessController';
import { longDate, sectionLabelClass } from '../ui';
import { t } from '../../../lib/i18n';
import { EMPLOYMENT_NOTES, type StaffRecordModel } from './model';
import { Row } from './row';

/** The member's role, subjects and employment at the school. */
export function WorkSection({ record }: { record: StaffRecordModel }) {
    const { member, Their, employment, subjects } = record;

    return (
        <section className="flex flex-col gap-2">
            <p className={sectionLabelClass}>
                {t(':their work here', { their: Their })}
            </p>
            <dl className="flex flex-col">
                <Row label={t('Portal role')}>
                    {member.role_label}{' '}
                    <Link
                        href={access.url(member.id)}
                        className="ml-2 text-[13px] font-medium text-primary hover:underline"
                    >
                        {t('Change')}
                    </Link>
                </Row>
                <Row label={t('Subjects')}>
                    {subjects || t('None assigned yet')}
                </Row>
                <Row label={t('Employment type')}>
                    {employment
                        ? `${employment} · ${EMPLOYMENT_NOTES[member.employment_type ?? '']}`
                        : '—'}
                </Row>
                <Row label={t('Joined this school')}>
                    {longDate(member.joined_on)}
                </Row>
            </dl>
        </section>
    );
}
