import { index } from '@/actions/App/Http/Controllers/SeriesController';
import { Head } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { StructureHeader } from '../ui';
import { type SeriesEditModel } from './model';

/** The page title and the trail back to the level's series. */
export function SeriesHeader({ model }: { model: SeriesEditModel }) {
    const { series, level, yearLabel } = model;

    return (
        <>
            <Head
                title={
                    series
                        ? t('Configure series :code', { code: series.code })
                        : t('Add a series')
                }
            />
            <StructureHeader
                section="series"
                trail={[
                    {
                        label: level.name,
                        href: index.url({ query: { level: level.id } }),
                    },
                    { label: series?.code ?? t('New series') },
                ]}
                title={
                    series
                        ? t('Configure series :code', { code: series.code })
                        : t('Add a series')
                }
                tag={t('Series:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t(
                    'choose the core subjects and the electives students can pick from',
                )}
            />
        </>
    );
}
