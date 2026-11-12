import { STREAMS } from '../../series/ui';
import { t } from '../../../lib/i18n';
import { type SeriesEditModel } from './model';

/** Which subjects the domain allows, and any that saving will drop. */
export function DomainNotice({ model }: { model: SeriesEditModel }) {
    const { unavailableSubjects, data, level, yearLabel } = model;

    return (
        <>
            {unavailableSubjects.length > 0 && (
                <p
                    role="status"
                    className="rounded-md bg-warning-tint p-3 text-[13px] leading-5 text-warning-text"
                >
                    {t(
                        'These subjects do not match this level, year or domain and will be removed when you save: :subjects',
                        { subjects: unavailableSubjects.join(', ') },
                    )}
                </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-solid border-border bg-surface px-3 py-3 text-[13px]">
                <span className="font-semibold text-primary">
                    {t('General + :domain only', {
                        domain: t(
                            STREAMS.find(
                                (stream) => stream.value === data.stream,
                            )?.label ?? data.stream,
                        ),
                    })}
                </span>
                <span className="text-text-muted">
                    {level.name} · {yearLabel}
                </span>
                <p className="w-full text-text-muted">
                    {t(
                        'Subjects must be assigned to this level in the current year. Unclassified subjects are excluded.',
                    )}
                </p>
            </div>
        </>
    );
}
