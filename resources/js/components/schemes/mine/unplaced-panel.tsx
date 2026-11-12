import { itemLabel } from '../ui';
import {
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { smallSelect, type MySchemeModel } from './model';
import { WeekPicker } from './week-picker';

/** The sub-topics not in a week yet, and adding one of the teacher's own. */
export function UnplacedPanel({ mine }: { mine: MySchemeModel }) {
    const {
        scheme,
        adding,
        setAdding,
        draft,
        setDraft,
        errors,
        unplaced,
        topics,
        move,
        addOwn,
    } = mine;

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
            <div className="flex items-center justify-between">
                <span className={capsLabelClass}>{t('Not placed yet')}</span>
                <span className="font-mono text-[12px] text-warning-text">
                    {t(':count left', {
                        count: unplaced.length,
                    })}
                </span>
            </div>
            {unplaced.length === 0 && (
                <p className="text-[13px] text-text-muted">
                    {t('Everything is placed in a week.')}
                </p>
            )}
            {topics.map((topic) => (
                <div key={topic} className="flex flex-col gap-2">
                    <span className="text-[14px] font-semibold text-text">
                        {topic}
                    </span>
                    {unplaced
                        .filter((item) => item.topic === topic)
                        .map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 rounded-md border border-solid border-border bg-white px-3 py-2"
                            >
                                <span className="min-w-0 flex-1 text-[13px] text-text">
                                    {item.name ?? t('Whole topic')}
                                    <span className="ml-2 font-mono text-[11px] text-text-muted">
                                        {t(':count periods', {
                                            count: item.periods,
                                        })}
                                    </span>
                                </span>
                                <WeekPicker
                                    weeks={scheme.weeks}
                                    value={null}
                                    label={t('Place :label', {
                                        label: itemLabel(item),
                                    })}
                                    onPick={(next) => move(item, next)}
                                />
                            </div>
                        ))}
                </div>
            ))}
            {adding ? (
                <div className="flex flex-col gap-2 border-t border-solid border-border pt-3">
                    <input
                        placeholder={t('Topic')}
                        value={draft.topic}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                topic: e.target.value,
                            })
                        }
                        className="h-8 rounded-md border border-solid border-border bg-white px-2 text-[13px] outline-none focus:border-primary"
                    />
                    <input
                        placeholder={t('Sub-topic (optional)')}
                        value={draft.name}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                name: e.target.value,
                            })
                        }
                        className="h-8 rounded-md border border-solid border-border bg-white px-2 text-[13px] outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            aria-label={t('Periods')}
                            inputMode="numeric"
                            value={draft.periods}
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    periods:
                                        Number(
                                            e.target.value.replace(/\D/g, ''),
                                        ) || 1,
                                })
                            }
                            className="h-8 w-[56px] rounded-md border border-solid border-border bg-white px-2 font-mono text-[13px] outline-none focus:border-primary"
                        />
                        <span className="text-[12px] text-text-muted">
                            {t('periods')}
                        </span>
                        <select
                            value={draft.week}
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    week: e.target.value,
                                })
                            }
                            className={smallSelect}
                        >
                            <option value="">{t('No week yet')}</option>
                            {scheme.weeks.map((week) => (
                                <option key={week.week} value={week.week}>
                                    {t('Week :week', {
                                        week: week.week,
                                    })}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(errors.topic || errors.periods) && (
                        <p className="text-[12px] text-danger">
                            {errors.topic ?? errors.periods}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={addOwn}
                            className={solidButtonClass}
                        >
                            {t('Add')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdding(false)}
                            className={outlineButtonClass}
                        >
                            {t('Cancel')}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="self-start text-[13px] font-medium text-primary hover:underline"
                >
                    {t('+ Add a sub-topic of your own')}
                </button>
            )}
        </div>
    );
}
