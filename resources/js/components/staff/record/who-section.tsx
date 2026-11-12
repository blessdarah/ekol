import { GENDER_LABELS, sectionLabelClass } from '../ui';
import { t } from '../../../lib/i18n';
import { type StaffRecordModel } from './model';
import { Row } from './row';

/** Who the member is and how to reach them. */
export function WhoSection({ record }: { record: StaffRecordModel }) {
    const { member, they } = record;

    return (
        <section className="flex flex-col gap-2">
            <p className={sectionLabelClass}>
                {t('Who')} {they.subject}{' '}
                {they.subject === 'they' ? t('are') : t('is')}
            </p>
            <dl className="flex flex-col">
                <Row label={t('Gender')}>
                    {member.gender ? GENDER_LABELS[member.gender] : '—'}
                </Row>
                <Row label={t('Highest qualification')}>
                    {member.qualification ?? '—'}
                </Row>
                <Row label={t('Address')}>{member.address ?? '—'}</Row>
                <Row label={t('Email')}>{member.email}</Row>
                <Row label={t('Phone')}>{member.phone}</Row>
            </dl>
        </section>
    );
}
