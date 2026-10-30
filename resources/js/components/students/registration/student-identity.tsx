import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    segmentClass,
} from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type StudentRegistrationModel } from './model';
export function StudentIdentity({
    props,
    student,
    canSeePrivate,
    data,
    setData,
    errors,
}: Pick<
    StudentRegistrationModel,
    'props' | 'student' | 'canSeePrivate' | 'data' | 'setData' | 'errors'
>) {
    return (
        <section className="flex flex-col gap-[14px]">
            <p className={capsLabelClass}>{t('Student')}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
                <label
                    className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                >
                    {t('Surname')}
                    <input
                        type="text"
                        value={data.surname}
                        onChange={(e) => setData('surname', e.target.value)}
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.surname} />
                </label>
                <label
                    className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                >
                    {t('Name')}
                    <input
                        type="text"
                        value={data.given_names}
                        onChange={(e) => setData('given_names', e.target.value)}
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.given_names} />
                </label>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <label
                    className={`flex flex-col gap-2 sm:w-[176px] ${fieldLabelClass}`}
                >
                    {t('Date of birth')}
                    <input
                        type="date"
                        value={data.date_of_birth}
                        onChange={(e) =>
                            setData('date_of_birth', e.target.value)
                        }
                        className={`${fieldInputClass} font-mono text-[14px]`}
                    />
                    <ErrorText message={errors.date_of_birth} />
                </label>
                <div
                    role="radiogroup"
                    aria-label={t('Gender')}
                    className={`flex flex-col gap-2 sm:w-[160px] ${fieldLabelClass}`}
                >
                    {t('Gender')}
                    <div className="flex gap-2">
                        {[
                            { value: 'female', label: t('Girl') },
                            { value: 'male', label: t('Boy') },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={data.gender === option.value}
                                onClick={() => setData('gender', option.value)}
                                className={segmentClass(
                                    data.gender === option.value,
                                )}
                            >
                                {t(option.label)}
                            </button>
                        ))}
                    </div>
                    <ErrorText message={errors.gender} />
                </div>
                <label
                    className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                >
                    {t('Place of birth')}
                    <input
                        type="text"
                        value={data.place_of_birth}
                        onChange={(e) =>
                            setData('place_of_birth', e.target.value)
                        }
                        className={fieldInputClass}
                    />
                </label>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                {canSeePrivate && (
                    <label
                        className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                    >
                        {t('Religion')}
                        <select
                            value={data.religion}
                            onChange={(e) =>
                                setData('religion', e.target.value)
                            }
                            className={fieldInputClass}
                        >
                            <option value="">{t('Not recorded')}</option>
                            {props.religions.map((religion) => (
                                <option key={religion}>{religion}</option>
                            ))}
                        </select>
                    </label>
                )}
                <div
                    className={`flex flex-col gap-2 sm:w-[252px] ${fieldLabelClass}`}
                >
                    {t('Matricule')}
                    <span className="flex h-10 items-center justify-between rounded-md border border-solid border-border bg-surface px-3">
                        <span className="font-mono text-[16px] leading-5 font-normal text-text">
                            {props.matricule}
                        </span>
                        <span className="text-[12px] leading-4 font-medium text-text-muted">
                            {student ? t('Never changes') : t('Automatic')}
                        </span>
                    </span>
                </div>
            </div>
        </section>
    );
}
