import { RemoveIcon, fieldLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { inputClass, type RoomPanelModel } from './model';

/** The subjects whose lessons need a special room's kind. */
export function RoomSubjects({
    panel,
    kind,
}: {
    panel: RoomPanelModel;
    kind: NonNullable<RoomPanelModel['kind']>;
}) {
    const { subjects, data, setData, left } = panel;

    return (
        <div className="flex flex-col gap-2">
            <p className={fieldLabelClass}>
                {t('Lessons that need this kind of room')}
            </p>
            <div className="flex flex-wrap gap-[6px]">
                {subjects
                    .filter((subject) => data.subject_ids.includes(subject.id))
                    .map((subject) => (
                        <span
                            key={subject.id}
                            className="flex h-6 items-center gap-[6px] rounded-sm bg-primary-tint pr-[6px] pl-[10px] text-[13px] leading-4 font-medium text-primary"
                        >
                            {subject.name}
                            <button
                                type="button"
                                aria-label={t('Remove :subject', {
                                    subject: subject.name,
                                })}
                                onClick={() =>
                                    setData(
                                        'subject_ids',
                                        data.subject_ids.filter(
                                            (id) => id !== subject.id,
                                        ),
                                    )
                                }
                                className="flex size-4 items-center justify-center rounded-sm hover:bg-white"
                            >
                                <RemoveIcon tone="var(--color-primary)" />
                            </button>
                        </span>
                    ))}
                {data.subject_ids.length === 0 && (
                    <span className="text-[13px] leading-6 text-text-muted">
                        {t('None yet')}
                    </span>
                )}
            </div>
            {left.length > 0 && (
                <select
                    aria-label={t('Add a subject')}
                    value=""
                    onChange={(e) =>
                        e.target.value &&
                        setData('subject_ids', [
                            ...data.subject_ids,
                            e.target.value,
                        ])
                    }
                    className={`${inputClass} h-8 text-[13px]`}
                >
                    <option value="">{t('Add a subject…')}</option>
                    {left.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                            {subject.name}
                            {subject.room_kind
                                ? t(' (moves from another kind)')
                                : ''}
                        </option>
                    ))}
                </select>
            )}
            <p className="text-[12px] leading-[17px] text-text-muted">
                {t('This applies to every :to_lower_case, not only this one.', {
                    to_lower_case: kind.label.toLowerCase(),
                })}
            </p>
        </div>
    );
}
