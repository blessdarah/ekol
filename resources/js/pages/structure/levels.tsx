import { Head } from '@inertiajs/react';
import { ManagementTabs } from '../../components/structure/ui';
import { LevelPanel } from '../../components/structure/levels/level-panel';
import { LevelsEmpty } from '../../components/structure/levels/levels-empty';
import { LevelsHeader } from '../../components/structure/levels/levels-header';
import { LevelsTable } from '../../components/structure/levels/levels-table';
import {
    type LevelsProps,
    useStructureLevels,
} from '../../components/structure/levels/model';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Levels(props: LevelsProps) {
    const structure = useStructureLevels(props);
    const { yearLabel, levels, staff, rooms, level } = structure;

    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Levels and series')} />
            <LevelsHeader structure={structure} />
            <ManagementTabs
                group="structure"
                active="levels"
                levelId={level?.id}
            />

            {levels.length === 0 ? (
                <LevelsEmpty />
            ) : (
                <div className="flex flex-col gap-8 lg:flex-row">
                    <LevelsTable structure={structure} />
                    {level && (
                        <LevelPanel
                            key={level.id}
                            level={level}
                            hasYear={yearLabel !== null}
                            staff={staff}
                            rooms={rooms}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default withAppShell(Levels);
