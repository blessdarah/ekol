import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
} from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type StudentRegistrationModel, smallInputClass, Tick } from './model';
export function StudentGuardians({
    props,
    data,
    setData,
    errors,
    guardians,
    showGuardian,
    setShowGuardian,
    guardianError,
    setGuardian,
    relations,
}: Pick<
    StudentRegistrationModel,
    | 'props'
    | 'data'
    | 'setData'
    | 'errors'
    | 'guardians'
    | 'showGuardian'
    | 'setShowGuardian'
    | 'guardianError'
    | 'setGuardian'
    | 'relations'
>) {
    return (
        <section className="flex flex-col gap-[14px]">
            <p className={capsLabelClass}>{t('Parents and guardian')}</p>
            <div className="flex flex-col gap-4 md:flex-row">
                {relations.map((relation) => {
                    const isMain = data.main_contact === relation;
                    const title = {
                        father: 'Father',
                        mother: 'Mother',
                        guardian: 'Guardian',
                    }[relation];

                    return (
                        <fieldset
                            key={relation}
                            className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border border-solid border-border p-[14px]"
                        >
                            <div className="flex items-center justify-between">
                                <legend className="float-left text-[14px] leading-[18px] font-semibold text-text">
                                    {title}
                                </legend>
                                {isMain ? (
                                    <span className="flex h-[22px] items-center rounded-full bg-primary-tint px-2 text-[12px] leading-4 font-medium text-primary">
                                        {t('Main contact')}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setData('main_contact', relation)
                                        }
                                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                    >
                                        {t('Make main contact')}
                                    </button>
                                )}
                            </div>
                            <label
                                className={`flex flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Surname and name')}
                                <input
                                    type="text"
                                    value={guardians[relation].name}
                                    onChange={(e) =>
                                        setGuardian(relation, {
                                            name: e.target.value,
                                        })
                                    }
                                    className={smallInputClass}
                                />
                            </label>
                            <label
                                className={`flex flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Phone')}
                                <input
                                    type="tel"
                                    value={guardians[relation].phone}
                                    onChange={(e) =>
                                        setGuardian(relation, {
                                            phone: e.target.value,
                                        })
                                    }
                                    className={`${smallInputClass} font-mono`}
                                />
                            </label>
                            <label
                                className={`flex flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Occupation')}
                                <input
                                    type="text"
                                    value={guardians[relation].occupation}
                                    onChange={(e) =>
                                        setGuardian(relation, {
                                            occupation: e.target.value,
                                        })
                                    }
                                    className={smallInputClass}
                                />
                            </label>
                        </fieldset>
                    );
                })}
            </div>
            <ErrorText
                message={
                    errors.main_contact ?? errors.guardians ?? guardianError
                }
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tick
                    checked={data.on_whatsapp}
                    onChange={(next) => setData('on_whatsapp', next)}
                >
                    {t(
                        'The main contact is also on WhatsApp. Notices go there.',
                    )}
                </Tick>
                {!showGuardian && (
                    <button
                        type="button"
                        onClick={() => setShowGuardian(true)}
                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {t('Add a guardian who is not a parent')}
                    </button>
                )}
            </div>
            <label
                className={`flex flex-col gap-2 sm:w-[252px] ${fieldLabelClass}`}
            >
                {t('Lives with')}
                <select
                    value={data.lives_with}
                    onChange={(e) => setData('lives_with', e.target.value)}
                    className={fieldInputClass}
                >
                    <option value="">{t('Not recorded')}</option>
                    {props.livesWithOptions.map((option) => (
                        <option key={option}>{option}</option>
                    ))}
                </select>
            </label>
        </section>
    );
}
