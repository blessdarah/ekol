import { ErrorText, RemoveIcon, fieldLabelClass } from '../../structure/ui';
import { WEEKDAYS, linkClass } from '../ui';
import { t } from '../../../lib/i18n';
import { inputClass, type RoomPanelModel } from './model';

/** The periods a room is closed, and blocking another. */
export function RoomBlocks({ panel }: { panel: RoomPanelModel }) {
    const { periods, data, setData, errors, days, draft, setDraft, addBlock } =
        panel;

    return (
        <div className="flex flex-col gap-2">
            <p className={fieldLabelClass}>{t('Not available')}</p>
            {data.unavailable.length > 0 ? (
                <ul className="flex flex-col gap-1 rounded-md bg-surface px-3 py-2">
                    {data.unavailable.map((block, position) => (
                        <li
                            key={`${block.weekday}-${block.period_id}`}
                            className="flex items-center justify-between gap-3 py-1"
                        >
                            <span className="text-[13px] leading-4 text-text">
                                {t(WEEKDAYS[block.weekday])}{' '}
                                {periods.find(
                                    (period) => period.id === block.period_id,
                                )?.label ?? t('period')}
                                {block.reason ? ` · ${block.reason}` : ''}
                            </span>
                            <button
                                type="button"
                                aria-label={t('Remove this block')}
                                onClick={() =>
                                    setData(
                                        'unavailable',
                                        data.unavailable.filter(
                                            (_, index) => index !== position,
                                        ),
                                    )
                                }
                                className="flex size-5 items-center justify-center rounded-sm hover:bg-white"
                            >
                                <RemoveIcon tone="var(--color-text-muted)" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[13px] leading-4 text-text-muted">
                    {t('Open every period.')}
                </p>
            )}
            {draft.open ? (
                <div className="flex flex-col gap-2 rounded-md border border-solid border-border p-3">
                    <div className="flex gap-2">
                        <select
                            aria-label={t('Day')}
                            value={draft.weekday}
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    weekday: Number(e.target.value),
                                })
                            }
                            className={`${inputClass} h-8 text-[13px]`}
                        >
                            {days.map((day) => (
                                <option key={day.index} value={day.index}>
                                    {t(day.label)}
                                </option>
                            ))}
                        </select>
                        <select
                            aria-label={t('Period')}
                            value={draft.period_id}
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    period_id: e.target.value,
                                })
                            }
                            className={`${inputClass} h-8 text-[13px]`}
                        >
                            {periods.map((period) => (
                                <option key={period.id} value={period.id}>
                                    {t(period.label)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="text"
                        value={draft.reason}
                        onChange={(e) =>
                            setDraft({ ...draft, reason: e.target.value })
                        }
                        placeholder={t('Reason, such as cleaning')}
                        className={`${inputClass} h-8 text-[13px]`}
                    />
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={addBlock}
                            className={linkClass}
                        >
                            {t('Add')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDraft({ ...draft, open: false })}
                            className="text-[13px] leading-4 text-text-muted hover:underline"
                        >
                            {t('Cancel')}
                        </button>
                    </div>
                </div>
            ) : (
                periods.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setDraft({ ...draft, open: true })}
                        className={`self-start ${linkClass}`}
                    >
                        {t('Block')}{' '}
                        {data.unavailable.length > 0 ? t('another') : 'a'}{' '}
                        {t('period')}
                    </button>
                )
            )}
            <ErrorText message={errors.unavailable} />
        </div>
    );
}
