import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
} from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type StudentRegistrationModel, YesNo, Tick } from './model';
export function StudentBackground({
    props,
    canSeePrivate,
    data,
    setData,
    errors,
    toggleType,
}: Pick<
    StudentRegistrationModel,
    'props' | 'canSeePrivate' | 'data' | 'setData' | 'errors' | 'toggleType'
>) {
    return (
        <section className="flex flex-col gap-[14px]">
            <p className={capsLabelClass}>{t('Background')}</p>
            {canSeePrivate && (
                <div className="flex flex-col gap-[10px]">
                    <YesNo
                        label={t('Does the student have a disability?')}
                        value={data.has_disability}
                        onChange={(next) => setData('has_disability', next)}
                    />
                    {data.has_disability && (
                        <div className="flex flex-col gap-3 rounded-md bg-surface p-[14px] sm:flex-row">
                            <div
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Type')}
                                <div className="flex flex-wrap gap-[6px]">
                                    {props.disabilityTypes.map((type) => {
                                        const on =
                                            data.disability_types.includes(
                                                type,
                                            );

                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => toggleType(type)}
                                                className={`flex h-8 items-center rounded-sm border border-solid px-[10px] text-[13px] leading-4 ${
                                                    on
                                                        ? 'border-primary bg-primary-tint font-medium text-primary'
                                                        : 'border-border bg-white font-normal text-text'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <label
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Support the school should give')}
                                <input
                                    type="text"
                                    placeholder={t('Sits in the front row')}
                                    value={data.disability_support}
                                    onChange={(e) =>
                                        setData(
                                            'disability_support',
                                            e.target.value,
                                        )
                                    }
                                    className={`${fieldInputClass} text-[14px]`}
                                />
                            </label>
                        </div>
                    )}
                </div>
            )}
            <div className="flex flex-col gap-[10px]">
                <YesNo
                    label={t('Transferred from another school?')}
                    value={data.transferred}
                    onChange={(next) => setData('transferred', next)}
                />
                {data.transferred && (
                    <div className="flex flex-col gap-3 rounded-md bg-surface p-[14px]">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Previous school')}
                                <input
                                    type="text"
                                    value={data.previous_school}
                                    onChange={(e) =>
                                        setData(
                                            'previous_school',
                                            e.target.value,
                                        )
                                    }
                                    className={fieldInputClass}
                                />
                            </label>
                            <label
                                className={`flex flex-col gap-2 sm:w-[150px] ${fieldLabelClass}`}
                            >
                                {t('Last class')}
                                <input
                                    type="text"
                                    placeholder={t('Form 3')}
                                    value={data.previous_class}
                                    onChange={(e) =>
                                        setData(
                                            'previous_class',
                                            e.target.value,
                                        )
                                    }
                                    className={fieldInputClass}
                                />
                            </label>
                            <label
                                className={`flex flex-col gap-2 sm:w-[110px] ${fieldLabelClass}`}
                            >
                                {t('Year left')}
                                <input
                                    type="number"
                                    min={1990}
                                    value={data.previous_year_left}
                                    onChange={(e) =>
                                        setData(
                                            'previous_year_left',
                                            e.target.value,
                                        )
                                    }
                                    className={`${fieldInputClass} font-mono`}
                                />
                            </label>
                        </div>
                        <ErrorText
                            message={
                                errors.previous_school ??
                                errors.previous_year_left
                            }
                        />
                        <div className="flex flex-wrap gap-6">
                            <Tick
                                checked={data.transfer_certificate_received}
                                onChange={(next) =>
                                    setData(
                                        'transfer_certificate_received',
                                        next,
                                    )
                                }
                            >
                                {t('Transfer certificate received')}
                            </Tick>
                            <Tick
                                checked={data.last_report_received}
                                onChange={(next) =>
                                    setData('last_report_received', next)
                                }
                            >
                                {t('Last report card received')}
                            </Tick>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
