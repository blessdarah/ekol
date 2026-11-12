import { t } from '../../../lib/i18n';
import { TimetableHeader } from '../ui';
import { type TimetableChanges } from './model';

/** The page header, saying which version is live. */
export function ChangesHeader({ changes }: { changes: TimetableChanges }) {
    const { phase, live } = changes;

    return (
        <TimetableHeader
            page="changes"
            phase={phase}
            trail={[{ label: t('Changes') }]}
            title={t('Changes')}
            meta={
                live !== null
                    ? t(
                          'Version :live is live. Cover a lesson, swap two lessons or change a room. No new version needed.',
                          { live },
                      )
                    : t(
                          'Changes apply to a published timetable, and none is live yet.',
                      )
            }
        />
    );
}
