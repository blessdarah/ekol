import { t } from '../../../lib/i18n';
import { ErrorText, capsLabelClass } from '../../structure/ui';
import { SeriesChips } from '../ui';
import { type RegisterOne } from './model';

/** Step 1: the series the student follows. */
export function SeriesChoice({ registration }: { registration: RegisterOne }) {
    const { level, series, seriesId, chooseSeries, errors } = registration;

    return (
        <section className="flex flex-col gap-3">
            <p className={capsLabelClass}>{t('1 · Choose a series')}</p>
            {series.length === 0 ? (
                <p className="text-[13px] leading-[19px] text-warning">
                    {t(
                        ':level has no series yet. Add them under Series setup.',
                        { level: level.name },
                    )}
                </p>
            ) : (
                <SeriesChips
                    series={series}
                    value={seriesId}
                    labelled
                    onChange={chooseSeries}
                />
            )}
            <ErrorText message={errors.series_id} />
        </section>
    );
}
