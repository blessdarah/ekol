import { t } from '../../../lib/i18n';
import {
    BulkBar,
    DownloadIcon,
    FilterChips,
    TableToolbar,
    bulkButtonClass,
    count,
} from '../../table/ui';
import { type FeesOverview } from './model';

/** Search, filters and sorting, or the bulk bar while students are selected. */
export function FeesToolbar({ fees }: { fees: FeesOverview }) {
    const {
        selection,
        students,
        setExporting,
        table,
        fields,
        quickPicks,
        values,
        filter,
        sort,
    } = fees;

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
                        onClick={() => setExporting(true)}
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
                    searchPlaceholder={t('Name or matricule')}
                    search={table.search}
                    onSearch={(value) => {
                        table.onSearch(value);
                        selection.clear();
                    }}
                    filterTitle={t('Filter fees')}
                    fields={fields}
                    quickPicks={quickPicks}
                    values={values}
                    onFilter={filter}
                    sorts={[
                        { value: 'owed', label: t('Most overdue') },
                        {
                            value: '-balance',
                            label: t('Largest balance'),
                        },
                        { value: 'name', label: t('Name') },
                        { value: 'class', label: t('Class') },
                    ]}
                    sort={sort}
                    onSort={table.sort}
                    countLabel={t(':count students', {
                        count: count(students.total),
                    })}
                    total={students.total}
                    onExport={() => setExporting(true)}
                />
            )}
            <FilterChips fields={fields} values={values} onFilter={filter} />
        </div>
    );
}
