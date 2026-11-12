import { exportMethod } from '@/actions/App/Http/Controllers/FeeController';
import { t } from '../../../lib/i18n';
import { ExportDialog, toQuery } from '../../table/ui';
import { type FeesOverview } from './model';

/** Export the students as filtered, selected, or everyone. */
export function FeesExport({ fees }: { fees: FeesOverview }) {
    const {
        yearLabel,
        students,
        selection,
        counts,
        values,
        sort,
        setExporting,
    } = fees;

    return (
        <ExportDialog
            title={t('Export fees')}
            subtitle={t(':year · as filtered on screen', {
                year: yearLabel ?? t('Fees'),
            })}
            noun={t('students')}
            matching={students.total}
            selected={selection.allMatching ? 'all' : selection.ids}
            everyone={counts.all}
            columns={[
                { key: 'name', label: t('Name'), on: true },
                { key: 'matricule', label: t('Matricule'), on: true },
                { key: 'class', label: t('Class'), on: true },
                { key: 'due', label: t('Annual fees'), on: true },
                { key: 'paid', label: t('Paid'), on: true },
                { key: 'balance', label: t('Balance'), on: true },
                { key: 'overdue', label: t('Overdue'), on: false },
                { key: 'state', label: t('Status'), on: true },
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
