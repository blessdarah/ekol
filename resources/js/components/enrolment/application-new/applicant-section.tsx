import { t } from '../../../lib/i18n';
import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    segmentClass,
} from '../../structure/ui';
import { type NewApplication } from './model';

/** Who is applying, and to which level. */
export function ApplicantSection({
    application,
}: {
    application: NewApplication;
}) {
    const { levels, religions, canSeePrivate, data, setData, errors } =
        application;

    return (
        <section className="flex flex-col gap-[14px]">
            <p className={capsLabelClass}>{t('Applicant')}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Surname')}
                    <input
                        type="text"
                        value={data.surname}
                        onChange={(e) => setData('surname', e.target.value)}
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.surname} />
                </label>
                <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Given names')}
                    <input
                        type="text"
                        value={data.given_names}
                        onChange={(e) => setData('given_names', e.target.value)}
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.given_names} />
                </label>
                <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Date of birth')}
                    <input
                        type="date"
                        value={data.date_of_birth}
                        onChange={(e) =>
                            setData('date_of_birth', e.target.value)
                        }
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.date_of_birth} />
                </label>
                <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Place of birth')}
                    <input
                        type="text"
                        value={data.place_of_birth}
                        onChange={(e) =>
                            setData('place_of_birth', e.target.value)
                        }
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.place_of_birth} />
                </label>
                <div className="flex flex-col gap-[6px]">
                    <span className={fieldLabelClass}>{t('Gender')}</span>
                    <div
                        role="radiogroup"
                        aria-label={t('Gender')}
                        className="flex gap-2"
                    >
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
                <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Applying to')}
                    <select
                        value={data.level_id}
                        onChange={(e) => setData('level_id', e.target.value)}
                        className={fieldInputClass}
                    >
                        <option value="">{t('Choose a level')}</option>
                        {levels.map((level) => (
                            <option key={level.id} value={level.id}>
                                {level.name}
                            </option>
                        ))}
                    </select>
                    <ErrorText message={errors.level_id} />
                </label>
                {canSeePrivate && (
                    <>
                        <label
                            className={`flex flex-col gap-[6px] ${fieldLabelClass}`}
                        >
                            {t('Religion')}
                            <select
                                value={data.religion}
                                onChange={(e) =>
                                    setData('religion', e.target.value)
                                }
                                className={fieldInputClass}
                            >
                                <option value="">{t('Not given')}</option>
                                {religions.map((religion) => (
                                    <option key={religion} value={religion}>
                                        {religion}
                                    </option>
                                ))}
                            </select>
                            <ErrorText message={errors.religion} />
                        </label>
                        <label
                            className={`flex flex-col gap-[6px] ${fieldLabelClass}`}
                        >
                            {t('Disability or support needed')}
                            <input
                                type="text"
                                value={data.disability}
                                onChange={(e) =>
                                    setData('disability', e.target.value)
                                }
                                placeholder={t('Leave empty for none')}
                                className={fieldInputClass}
                            />
                            <ErrorText message={errors.disability} />
                        </label>
                    </>
                )}
            </div>
        </section>
    );
}
