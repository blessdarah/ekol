import { index } from '@/actions/App/Http/Controllers/SeriesController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { outlineButtonClass, solidButtonClass } from '../ui';
import { type SeriesEditModel } from './model';

/** Cancel or save the series. */
export function SeriesActions({ model }: { model: SeriesEditModel }) {
    const { code, level, processing } = model;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] leading-4 text-text-muted">
                {t(
                    'Students already registered in :code keep their subjects.',
                    { code },
                )}
            </p>
            <div className="flex gap-2">
                <Link
                    href={index.url({ query: { level: level.id } })}
                    className={outlineButtonClass}
                >
                    {t('Cancel')}
                </Link>
                <button
                    type="submit"
                    disabled={processing}
                    className={solidButtonClass}
                >
                    {t('Save series')}
                </button>
            </div>
        </div>
    );
}
