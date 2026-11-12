import { t } from '../../../lib/i18n';
import {
    ChipPicker,
    ErrorText,
    LockIcon,
    RemoveIcon,
    capsLabelClass,
} from '../ui';
import { type SeriesEditModel } from './model';

/** The subjects every student in the series takes. */
export function CoreSubjects({ model }: { model: SeriesEditModel }) {
    const { code, core, pool, data, setData, fieldError } = model;

    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <p className={capsLabelClass}>{t('Core subjects')}</p>
                <p className="text-[13px] leading-4 text-text-muted">
                    {t(
                        'Every student in :code takes these. They are locked when students register.',
                        { code },
                    )}
                </p>
            </div>
            <ChipPicker
                label={t('Add a core subject')}
                addLabel={t('Add a subject')}
                chosen={core.length}
                summary={t(':core core', {
                    core: core.length,
                })}
                options={pool}
                onAdd={(id) =>
                    setData({
                        ...data,
                        core: [...data.core, id],
                        electives: data.electives.filter(
                            (other) => other !== id,
                        ),
                    })
                }
            >
                {core.map((subject) => (
                    <span
                        key={subject.id}
                        className="flex h-6 items-center gap-[6px] rounded-sm border border-solid border-border bg-surface px-2 text-[13px] leading-4 font-medium text-text"
                    >
                        <LockIcon size={11} tone="var(--color-text)" />
                        {subject.name}
                        <span className="text-[11px] font-normal text-text-muted">
                            {t(
                                subject.domain.charAt(0).toUpperCase() +
                                    subject.domain.slice(1),
                            )}
                        </span>
                        <button
                            type="button"
                            aria-label={t('Remove :subject from core', {
                                subject: subject.name,
                            })}
                            onClick={() =>
                                setData(
                                    'core',
                                    data.core.filter((id) => id !== subject.id),
                                )
                            }
                        >
                            <RemoveIcon tone="var(--color-text-muted)" />
                        </button>
                    </span>
                ))}
            </ChipPicker>
            <ErrorText message={fieldError('core')} />
        </section>
    );
}
