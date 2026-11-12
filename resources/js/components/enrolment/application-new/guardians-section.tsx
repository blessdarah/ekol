import { t } from '../../../lib/i18n';
import { ErrorText, capsLabelClass, fieldLabelClass } from '../../structure/ui';
import { type NewApplication, RELATIONS, smallInputClass } from './model';

/** The father, mother and guardian, and which one is the main contact. */
export function GuardiansSection({
    application,
}: {
    application: NewApplication;
}) {
    const { data, setData, errors, guardians, guardianError, setGuardian } =
        application;

    return (
        <section className="flex flex-col gap-[14px]">
            <p className={capsLabelClass}>{t('Parents and guardian')}</p>
            <div className="flex flex-col gap-4 md:flex-row">
                {RELATIONS.map(({ key, title }) => (
                    <fieldset
                        key={key}
                        className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border border-solid border-border p-[14px]"
                    >
                        <div className="flex items-center justify-between">
                            <legend className="float-left text-[14px] leading-[18px] font-semibold text-text">
                                {title}
                            </legend>
                            {data.main_contact === key ? (
                                <span className="flex h-[22px] items-center rounded-full bg-primary-tint px-2 text-[12px] leading-4 font-medium text-primary">
                                    {t('Main contact')}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setData('main_contact', key)}
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
                                value={guardians[key].name}
                                onChange={(e) =>
                                    setGuardian(key, {
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
                                value={guardians[key].phone}
                                onChange={(e) =>
                                    setGuardian(key, {
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
                                value={guardians[key].occupation}
                                onChange={(e) =>
                                    setGuardian(key, {
                                        occupation: e.target.value,
                                    })
                                }
                                className={smallInputClass}
                            />
                        </label>
                    </fieldset>
                ))}
            </div>
            <ErrorText
                message={
                    errors.main_contact ?? errors.guardians ?? guardianError
                }
            />
        </section>
    );
}
