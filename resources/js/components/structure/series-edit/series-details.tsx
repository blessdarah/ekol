import { STREAMS } from '../../series/ui';
import { t } from '../../../lib/i18n';
import {
    ChipPicker,
    ErrorText,
    RemoveIcon,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
} from '../ui';
import { type SeriesEditModel } from './model';

/** Code, name, domain, levels and how many subjects a student takes. */
export function SeriesDetails({ model }: { model: SeriesEditModel }) {
    const { data, setData, changeDomain, errors, levels, level, fieldError } =
        model;

    return (
        <section className="flex flex-col gap-3">
            <p className={capsLabelClass}>{t('Series')}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
                <label
                    className={`flex flex-col gap-2 sm:w-[100px] ${fieldLabelClass}`}
                >
                    {t('Code')}
                    <input
                        type="text"
                        placeholder="S1"
                        maxLength={10}
                        value={data.code}
                        onChange={(e) =>
                            setData('code', e.target.value.toUpperCase())
                        }
                        className={`${fieldInputClass} font-mono`}
                    />
                </label>
                <label
                    className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                >
                    {t('Name')}
                    <input
                        type="text"
                        placeholder={t('Science 1')}
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className={fieldInputClass}
                    />
                </label>
                <div
                    role="radiogroup"
                    aria-label={t('Series domain')}
                    className={`flex flex-col gap-2 sm:w-[320px] ${fieldLabelClass}`}
                >
                    {t('Series domain')}
                    <div className="flex gap-2">
                        {STREAMS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={data.stream === option.value}
                                onClick={() => changeDomain(option.value)}
                                className={`flex h-10 flex-1 items-center justify-center rounded-md border border-solid text-[14px] leading-[18px] ${
                                    data.stream === option.value
                                        ? `font-semibold ${option.on}`
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {t(option.label)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <ErrorText message={errors.code ?? errors.name ?? errors.stream} />
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="flex items-baseline gap-2">
                        <span className={fieldLabelClass}>
                            {t('Applies to levels')}
                        </span>
                        <span className="text-[12px] leading-4 text-text-muted">
                            {t('GCE high school only')}
                        </span>
                    </p>
                    <ChipPicker
                        label={t('Add a level')}
                        addLabel={t('Add a level')}
                        chosen={data.level_ids.length}
                        summary={t(':level_ids of :levels', {
                            level_ids: data.level_ids.length,
                            levels: levels.length,
                        })}
                        options={levels.filter(
                            (option) => !data.level_ids.includes(option.id),
                        )}
                        onAdd={(id) =>
                            setData('level_ids', [...data.level_ids, id])
                        }
                    >
                        {levels
                            .filter((option) =>
                                data.level_ids.includes(option.id),
                            )
                            .map((option) => (
                                <span
                                    key={option.id}
                                    className="flex h-6 items-center gap-[6px] rounded-sm bg-primary-tint pr-2 pl-[10px] text-[13px] leading-4 font-medium text-primary"
                                >
                                    {option.name}
                                    {option.id !== level.id && (
                                        <button
                                            type="button"
                                            aria-label={t('Remove :option', {
                                                option: option.name,
                                            })}
                                            onClick={() =>
                                                setData(
                                                    'level_ids',
                                                    data.level_ids.filter(
                                                        (id) =>
                                                            id !== option.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <RemoveIcon tone="var(--color-primary)" />
                                        </button>
                                    )}
                                </span>
                            ))}
                    </ChipPicker>
                </div>
                <label
                    className={`flex flex-col gap-2 sm:w-[100px] ${fieldLabelClass}`}
                >
                    {t('Min subjects')}
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={data.min_subjects}
                        onChange={(e) =>
                            setData('min_subjects', e.target.value)
                        }
                        className={`${fieldInputClass} font-mono`}
                    />
                </label>
                <label
                    className={`flex flex-col gap-2 sm:w-[100px] ${fieldLabelClass}`}
                >
                    {t('Max subjects')}
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={data.max_subjects}
                        onChange={(e) =>
                            setData('max_subjects', e.target.value)
                        }
                        className={`${fieldInputClass} font-mono`}
                    />
                </label>
            </div>
            <ErrorText
                message={
                    errors.min_subjects ??
                    errors.max_subjects ??
                    fieldError('level_ids')
                }
            />
            {data.level_ids.length > 1 && (
                <p className="text-[12px] leading-[18px] text-text-muted">
                    {t(
                        'Saving writes the same series, by code, to each level listed. Removing a level here does not delete the series already on it.',
                    )}
                </p>
            )}
        </section>
    );
}
