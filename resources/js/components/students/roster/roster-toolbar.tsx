import { t } from '../../../lib/i18n';
import {
    BulkBar,
    DownloadIcon,
    FilterChips,
    TableToolbar,
    bulkButtonClass,
    count,
} from '../../table/ui';
import { type StudentRoster } from './model';

/** Search, filters, sort and export, or the bulk bar while rows are ticked. */
export function RosterToolbar({ roster }: { roster: StudentRoster }) {
    const {
        students,
        sort,
        values,
        table,
        selection,
        setExporting,
        fields,
        quickPicks,
        filter,
    } = roster;

    return (
        <div className="flex flex-col gap-3">
            {selection.ids.length > 0 || selection.allMatching ? (
                <BulkBar
                    selected={selection.ids.length}
                    total={students.total}
                    allMatching={selection.allMatching}
                    onSelectAll={selection.selectAllMatching}
                    onClear={selection.clear}
                >
                    <button
                        type="button"
                        onClick={() => setExporting('selected')}
                        className={bulkButtonClass}
                    >
                        <DownloadIcon colour="var(--color-bg)" />
                        {t('Export :count', {
                            count: count(
                                selection.allMatching
                                    ? students.total
                                    : selection.ids.length,
                            ),
                        })}
                    </button>
                </BulkBar>
            ) : (
                <TableToolbar
                    searchLabel={t('Search students')}
                    searchPlaceholder={t('Name, matricule or phone')}
                    search={table.search}
                    onSearch={(value) => {
                        table.onSearch(value);
                        selection.clear();
                    }}
                    filterTitle={t('Filter students')}
                    fields={fields}
                    quickPicks={quickPicks}
                    values={values}
                    onFilter={filter}
                    sorts={[
                        { value: 'class', label: t('Class') },
                        { value: 'name', label: t('Name') },
                        {
                            value: 'matricule',
                            label: t('Matricule'),
                        },
                        {
                            value: '-admitted',
                            label: t('Newest first'),
                        },
                    ]}
                    sort={sort}
                    onSort={table.sort}
                    countLabel={t(':count students', {
                        count: count(students.total),
                    })}
                    total={students.total}
                    onExport={() => setExporting('toolbar')}
                />
            )}
            <FilterChips fields={fields} values={values} onFilter={filter} />
        </div>
    );
}
