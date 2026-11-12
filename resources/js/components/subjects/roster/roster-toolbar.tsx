import {
    BulkBar,
    DownloadIcon,
    FilterChips,
    TableToolbar,
    bulkButtonClass,
    count,
} from '../../table/ui';
import { t } from '../../../lib/i18n';
import { plural, type SubjectRosterModel } from './model';

/** Searching, filtering and sorting the subjects, or acting on a selection. */
export function RosterToolbar({ roster }: { roster: SubjectRosterModel }) {
    const {
        subjects,
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
                    total={subjects.total}
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
                                    ? subjects.total
                                    : selection.ids.length,
                            ),
                        })}
                    </button>
                </BulkBar>
            ) : (
                <TableToolbar
                    searchLabel={t('Search subjects')}
                    searchPlaceholder={t('A subject, code or teacher')}
                    search={table.search}
                    onSearch={(value) => {
                        table.onSearch(value);
                        selection.clear();
                    }}
                    filterTitle={t('Filter subjects')}
                    fields={fields}
                    quickPicks={quickPicks}
                    values={values}
                    onFilter={filter}
                    sorts={[
                        { value: 'code', label: t('Code') },
                        { value: 'name', label: t('Name') },
                        {
                            value: 'department',
                            label: t('Department'),
                        },
                    ]}
                    sort={sort}
                    onSort={table.sort}
                    countLabel={plural(subjects.total, 'subject', 'subjects')}
                    total={subjects.total}
                    onExport={() => setExporting(true)}
                />
            )}
            <FilterChips fields={fields} values={values} onFilter={filter} />
        </div>
    );
}
