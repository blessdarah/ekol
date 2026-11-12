import { exportMethod } from '@/actions/App/Http/Controllers/SubjectController';
import { ExportDialog, toQuery } from '../../table/ui';
import { t } from '../../../lib/i18n';
import { type SubjectRosterModel } from './model';

/** Exporting the subjects as filtered on screen, or the ones selected. */
export function RosterExport({ roster }: { roster: SubjectRosterModel }) {
    const {
        yearLabel,
        counts,
        subjects,
        sort,
        values,
        selection,
        setExporting,
    } = roster;

    return (
        <ExportDialog
            title={t('Export subjects')}
            subtitle={t(':year · as filtered on screen', {
                year: yearLabel ?? t('Subjects'),
            })}
            noun={t('subjects')}
            matching={subjects.total}
            selected={selection.allMatching ? 'all' : selection.ids}
            everyone={counts.total}
            columns={[
                { key: 'name', label: t('Subject'), on: true },
                { key: 'code', label: t('Code'), on: true },
                { key: 'department', label: t('Department'), on: true },
                { key: 'kind', label: t('Kind'), on: false },
                { key: 'levels', label: t('Levels'), on: true },
                { key: 'coefficient', label: t('Coeff.'), on: true },
                { key: 'classes', label: t('Classes'), on: true },
                { key: 'teachers', label: t('Teachers'), on: true },
                {
                    key: 'unstaffed',
                    label: t('Classes without a teacher'),
                    on: false,
                },
                {
                    key: 'periods',
                    label: t('Periods a week'),
                    on: true,
                },
            ]}
            href={({ scope, format, columns }) =>
                exportMethod.url({
                    query: toQuery(scope === 'everyone' ? {} : values, {
                        sort,
                        format: format === 'print' ? 'print' : undefined,
                        columns: columns.join(','),
                        ids:
                            scope === 'selected' && !selection.allMatching
                                ? selection.ids.join(',')
                                : undefined,
                    }),
                })
            }
            onClose={() => setExporting(false)}
        />
    );
}
