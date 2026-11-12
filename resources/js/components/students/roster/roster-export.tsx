import { exportMethod } from '@/actions/App/Http/Controllers/StudentRosterController';
import { t } from '../../../lib/i18n';
import { ExportDialog, toQuery } from '../../table/ui';
import { type StudentRoster } from './model';

/** Choose who and which columns to export, as filtered on screen. */
export function RosterExport({ roster }: { roster: StudentRoster }) {
    const {
        yearLabel,
        counts,
        students,
        sort,
        values,
        selection,
        setExporting,
    } = roster;

    return (
        <ExportDialog
            title={t('Export students')}
            subtitle={t(':year · as filtered on screen', {
                year: yearLabel ?? t('Students'),
            })}
            noun={t('students')}
            matching={students.total}
            selected={selection.allMatching ? 'all' : selection.ids}
            everyone={counts.total}
            columns={[
                { key: 'name', label: t('Name'), on: true },
                { key: 'matricule', label: t('Matricule'), on: true },
                { key: 'class', label: t('Class'), on: true },
                { key: 'series', label: t('Series'), on: true },
                { key: 'gender', label: t('Gender'), on: false },
                {
                    key: 'date_of_birth',
                    label: t('Date of birth'),
                    on: false,
                },
                { key: 'guardian', label: t('Guardian'), on: true },
                { key: 'phone', label: t('Guardian phone'), on: true },
                { key: 'fees', label: t('Fees'), on: true },
                { key: 'balance', label: t('Balance'), on: true },
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
            onClose={() => setExporting(null)}
        />
    );
}
