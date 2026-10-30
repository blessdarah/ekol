import { TermStrip } from '../ui';
import {
    BulkBar,
    DownloadIcon,
    FilterChips,
    TableToolbar,
    bulkButtonClass,
    count,
} from '../../table/ui';
import { t } from '../../../lib/i18n';
import { type SchemesProgressModel } from './model';
export function SchemeOverview({
    steps,
    week,
    totals,
    states,
    paged,
    setExporting,
    sort,
    values,
    table,
    selection,
    onTrack,
    shown,
    fields,
    quickPicks,
    filter,
    showing,
}: Pick<
    SchemesProgressModel,
    | 'steps'
    | 'week'
    | 'totals'
    | 'states'
    | 'paged'
    | 'setExporting'
    | 'sort'
    | 'values'
    | 'table'
    | 'selection'
    | 'onTrack'
    | 'shown'
    | 'fields'
    | 'quickPicks'
    | 'filter'
    | 'showing'
>) {
    return (
        <div className="-mt-2 flex flex-col">
            <TermStrip steps={steps} />

            <div className="flex flex-wrap items-end gap-x-14 gap-y-5 pt-8 pb-7">
                <div className="flex w-[260px] shrink-0 flex-col gap-1">
                    <p className="font-display text-[56px] leading-[56px] font-extrabold tracking-[-0.03em] text-text">
                        {onTrack}
                        <span className="font-light text-text-muted">
                            {' '}
                            / {totals.all}
                        </span>
                    </p>
                    <p className="text-[14px] leading-5 text-text-muted">
                        {week
                            ? t('schemes on track at week :week', { week })
                            : t('schemes on track')}
                    </p>
                </div>
                <div className="flex min-w-[280px] flex-1 flex-col gap-[14px]">
                    <div className="flex h-3 gap-[3px]" aria-hidden>
                        {shown.map((part, position) => (
                            <span
                                key={part.label}
                                className={`h-3 ${part.bar} ${position === 0 ? 'rounded-l-full' : 'rounded-l-[2px]'} ${position === shown.length - 1 ? 'rounded-r-full' : 'rounded-r-[2px]'}`}
                                style={{
                                    flexGrow: part.states.reduce(
                                        (sum, state) =>
                                            sum + (states[state] ?? 0),
                                        0,
                                    ),
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] leading-4">
                        {shown.map((part) => {
                            const on = showing(part.states);
                            const number = part.states.reduce(
                                (sum, state) => sum + (states[state] ?? 0),
                                0,
                            );

                            return (
                                <button
                                    key={part.label}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() =>
                                        filter({
                                            state: on ? [] : part.states,
                                        })
                                    }
                                    className={`flex items-center gap-2 rounded-full py-1 text-text ${on ? 'bg-primary-tint px-[10px] font-semibold' : 'hover:underline'}`}
                                >
                                    <span
                                        className={`h-2 w-2 rounded-full ${part.bar}`}
                                    />
                                    {t(part.label)}
                                    <span className="font-mono font-normal text-text-muted">
                                        {number}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {selection.ids.length > 0 || selection.allMatching ? (
                    <BulkBar
                        selected={selection.ids.length}
                        total={paged.total}
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
                                        ? paged.total
                                        : selection.ids.length,
                                ),
                            })}
                        </button>
                    </BulkBar>
                ) : (
                    <TableToolbar
                        searchLabel={t('Search schemes')}
                        searchPlaceholder={t('A subject, class or teacher')}
                        search={table.search}
                        onSearch={(value) => {
                            table.onSearch(value);
                            selection.clear();
                        }}
                        filterTitle={t('Filter schemes')}
                        fields={fields}
                        quickPicks={quickPicks}
                        values={values}
                        onFilter={filter}
                        sorts={[
                            {
                                value: 'attention',
                                label: t('Needs attention first'),
                            },
                            { value: 'subject', label: t('Subject') },
                            { value: 'class', label: t('Class') },
                            { value: 'teacher', label: t('Teacher') },
                        ]}
                        sort={sort}
                        onSort={table.sort}
                        countLabel={t(':count schemes', {
                            count: count(paged.total),
                        })}
                        total={paged.total}
                        onExport={() => setExporting(true)}
                    />
                )}
                <FilterChips
                    fields={fields}
                    values={values}
                    onFilter={filter}
                />
            </div>
        </div>
    );
}
