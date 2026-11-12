import { t } from '../../../lib/i18n';
import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    segmentClass,
} from '../../structure/ui';
import { type NewApplication } from './model';

/** Where the applicant studied before, and why they are applying. */
export function ComingFromSection({
    application,
}: {
    application: NewApplication;
}) {
    const { data, setData, errors } = application;

    return (
        <section className="flex flex-col gap-[14px]">
            <p className={capsLabelClass}>{t('Coming from')}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={fieldLabelClass}>
                    {t('Transferring from another secondary school?')}
                </span>
                <div
                    role="radiogroup"
                    aria-label={t('Transferring')}
                    className="flex w-[200px] shrink-0 gap-2"
                >
                    {[false, true].map((option) => (
                        <button
                            key={String(option)}
                            type="button"
                            role="radio"
                            aria-checked={data.transferred === option}
                            onClick={() => setData('transferred', option)}
                            className={`${segmentClass(data.transferred === option)} h-[34px]`}
                        >
                            {option ? t('Yes') : t('No')}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                    {data.transferred
                        ? t('School transferring from')
                        : t('Last school attended')}
                    <input
                        type="text"
                        value={data.previous_school}
                        onChange={(e) =>
                            setData('previous_school', e.target.value)
                        }
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.previous_school} />
                </label>
                <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Class there')}
                    <input
                        type="text"
                        value={data.previous_class}
                        onChange={(e) =>
                            setData('previous_class', e.target.value)
                        }
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.previous_class} />
                </label>
                <label
                    className={`flex flex-col gap-[6px] sm:col-span-2 ${fieldLabelClass}`}
                >
                    {t('Reason for applying')}
                    <input
                        type="text"
                        value={data.reason}
                        onChange={(e) => setData('reason', e.target.value)}
                        className={fieldInputClass}
                    />
                    <ErrorText message={errors.reason} />
                </label>
            </div>
        </section>
    );
}
