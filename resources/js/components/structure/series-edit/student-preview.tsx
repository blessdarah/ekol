import { t } from '../../../lib/i18n';
import { LockIcon, capsLabelClass } from '../ui';
import { type SeriesEditModel } from './model';

/** The subjects as students will see them when they register. */
export function StudentPreview({ model }: { model: SeriesEditModel }) {
    const { core, inPool, data } = model;

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
            <p className={capsLabelClass}>{t('What students see')}</p>
            {core.length + inPool.length > 0 ? (
                <ul className="flex flex-col overflow-clip rounded-md border border-solid border-border bg-white">
                    {core.map((subject) => (
                        <li
                            key={subject.id}
                            className="flex h-8 shrink-0 items-center gap-2 border-t border-solid border-border bg-surface px-[10px] first:border-t-0"
                        >
                            <LockIcon />
                            <span className="flex-1 truncate text-[12px] leading-4 text-text">
                                {subject.name}
                            </span>
                            <span className="flex h-[18px] items-center rounded-sm border border-solid border-text px-[5px] text-[9px] leading-3 font-semibold tracking-[0.06em] text-text">
                                {t('CORE')}
                            </span>
                        </li>
                    ))}
                    {inPool.map((subject) => (
                        <li
                            key={subject.id}
                            className="flex h-8 shrink-0 items-center gap-2 border-t border-solid border-border px-[10px] first:border-t-0"
                        >
                            <span className="h-[14px] w-[14px] shrink-0 rounded-[3px] border border-solid border-border" />
                            <span className="flex-1 truncate text-[12px] leading-4 text-text">
                                {subject.name}
                            </span>
                            <span className="flex h-[18px] items-center rounded-sm border border-dashed border-text-muted px-[5px] text-[9px] leading-3 font-semibold tracking-[0.06em] text-text-muted">
                                {t('ELECTIVE')}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[12px] leading-4 text-text-muted">
                    {t('Nothing chosen yet.')}
                </p>
            )}
            <p className="text-[12px] leading-4 text-text-muted">
                {t('Same layout as Series Registration. Min')}{' '}
                {data.min_subjects || '—'} {t('· Max')}{' '}
                {data.max_subjects || '—'}.
            </p>
        </div>
    );
}
