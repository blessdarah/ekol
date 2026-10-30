import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
} from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type StudentRegistrationModel } from './model';
export function StudentClass({
    levels,
    data,
    setData,
    errors,
    levelId,
    level,
    levelClasses,
    levelSeries,
    chooseLevel,
}: Pick<
    StudentRegistrationModel,
    | 'levels'
    | 'data'
    | 'setData'
    | 'errors'
    | 'levelId'
    | 'level'
    | 'levelClasses'
    | 'levelSeries'
    | 'chooseLevel'
>) {
    return (
        <section className="flex flex-col gap-[14px]">
            <p className={capsLabelClass}>{t('Class')}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
                <label
                    className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                >
                    {t('Level')}
                    <select
                        value={levelId}
                        onChange={(e) => chooseLevel(e.target.value)}
                        className={fieldInputClass}
                    >
                        <option value="">{t('Choose a level')}</option>
                        {levels.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label
                    className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                >
                    {t('Class')}
                    <select
                        value={data.class_id}
                        disabled={!levelId}
                        onChange={(e) => setData('class_id', e.target.value)}
                        className={`${fieldInputClass} disabled:bg-surface`}
                    >
                        <option value="">
                            {levelId
                                ? t('Choose a class')
                                : t('Choose a level first')}
                        </option>
                        {levelClasses.map((option) => (
                            <option key={option.id} value={option.id}>
                                {t(':option · :students of :capacity', {
                                    option: option.name,
                                    students: option.students,
                                    capacity: option.capacity,
                                })}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <ErrorText message={errors.class_id} />
            {levels.length === 0 && (
                <p className="text-[13px] leading-[19px] text-warning">
                    {t(
                        'There are no levels or classes yet. Add them under Classes & Subjects first.',
                    )}
                </p>
            )}
            {level?.uses_series && (
                <div className="flex flex-col gap-2">
                    <p className="flex items-baseline gap-2">
                        <span className={fieldLabelClass}>{t('Series')}</span>
                        <span className="text-[12px] leading-4 text-text-muted">
                            {t('optional · :level uses series', {
                                level: level.name,
                            })}
                        </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {levelSeries.map((option, position) => {
                            const on = data.series_id === option.id;
                            const newStream =
                                position > 0 &&
                                levelSeries[position - 1].stream !==
                                    option.stream;

                            return (
                                <span
                                    key={option.id}
                                    className="flex items-center gap-2"
                                >
                                    {newStream && (
                                        <span className="h-5 w-px shrink-0 bg-border" />
                                    )}
                                    <button
                                        type="button"
                                        aria-pressed={on}
                                        title={option.name}
                                        onClick={() =>
                                            setData(
                                                'series_id',
                                                on ? '' : option.id,
                                            )
                                        }
                                        className={`flex h-8 min-w-11 shrink-0 items-center justify-center rounded-md border border-solid px-2 font-mono text-[13px] leading-4 ${
                                            on
                                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                : 'border-border text-text hover:bg-surface'
                                        }`}
                                    >
                                        {option.code}
                                    </button>
                                </span>
                            );
                        })}
                        <span className="pl-2 text-[13px] leading-4 text-text-muted">
                            {levelSeries.length > 0
                                ? t('Leave empty to choose later.')
                                : t('No series are set up for this level yet.')}
                        </span>
                    </div>
                    <ErrorText message={errors.series_id} />
                </div>
            )}
        </section>
    );
}
