import { Link } from '@inertiajs/react';
import {
    createLevel,
    levelTemplates,
} from '@/actions/App/Http/Controllers/LevelController';
import { t } from '../../../lib/i18n';
import { PlusIcon, StructureHeader, solidButtonClass } from '../ui';
import { type StructureLevels } from './model';

/** The page header with the level, class and series counts. */
export function LevelsHeader({ structure }: { structure: StructureLevels }) {
    const { yearLabel, levels, classCount, seriesLevels } = structure;

    return (
        <StructureHeader
            trail={[{ label: t('Levels') }]}
            title={t('Levels and series')}
            tag={t('Structure:year_label', {
                year_label: yearLabel ? ` · ${yearLabel}` : '',
            })}
            meta={t(
                ':levels levels · :class_count classes · series on :series_levels levels',
                {
                    levels: levels.length,
                    class_count: classCount,
                    series_levels: seriesLevels,
                },
            )}
            action={
                <div className="flex items-center gap-4">
                    {levels.length > 0 && (
                        <Link
                            href={levelTemplates.url()}
                            className="text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            {t('Standard structure')}
                        </Link>
                    )}
                    <Link href={createLevel.url()} className={solidButtonClass}>
                        <PlusIcon />
                        {t('Add level')}
                    </Link>
                </div>
            }
        />
    );
}
