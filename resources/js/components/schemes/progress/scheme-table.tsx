import { Link } from '@inertiajs/react';
import { show as subjectShow } from '@/actions/App/Http/Controllers/SubjectController';
import { dayMonth } from '../../fees/ui';
import { StateLabel } from '../ui';
import { Checkbox, TableFooter } from '../../table/ui';
import { t } from '../../../lib/i18n';
import { type SchemesProgressModel, headClass, ProgressCell } from './model';
export function SchemeTable({
    week,
    dueOn,
    daysLate,
    canManage,
    rows,
    paged,
    picked,
    table,
    selection,
    open,
}: Pick<
    SchemesProgressModel,
    | 'week'
    | 'dueOn'
    | 'daysLate'
    | 'canManage'
    | 'rows'
    | 'paged'
    | 'picked'
    | 'table'
    | 'selection'
    | 'open'
>) {
    return (
        <div className="-mt-4 flex flex-col gap-4">
            <div className="overflow-x-auto rounded-xl border border-solid border-border">
                <div className="flex min-w-[880px] flex-col">
                    <div
                        className={`flex h-[38px] items-center gap-4 border-b border-solid border-border bg-surface px-5 ${headClass}`}
                    >
                        <span className="flex w-4 shrink-0">
                            <Checkbox
                                label={t('Select this page')}
                                checked={selection.pageState === 'all'}
                                mixed={selection.pageState === 'some'}
                                onChange={selection.togglePage}
                            />
                        </span>
                        <span className="min-w-0 flex-1">
                            {t('Subject · class')}
                        </span>
                        <span className="w-[200px] shrink-0">
                            {t('Teacher')}
                        </span>
                        <span className="w-[280px] shrink-0">
                            {week
                                ? t('Taught by week :week', { week })
                                : t('Taught')}
                        </span>
                        <span className="w-[140px] shrink-0">
                            {t('Status')}
                        </span>
                        <span className="w-5 shrink-0" />
                    </div>
                    {rows.length === 0 && (
                        <p className="px-5 py-10 text-center text-[13px] text-text-muted">
                            {t(
                                'No scheme matches. Try another name, or clear the filters.',
                            )}
                        </p>
                    )}
                    {rows.map((row) => (
                        <div
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => open(row)}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                ) {
                                    event.preventDefault();
                                    open(row);
                                }
                            }}
                            className={`flex h-16 cursor-pointer items-center gap-4 border-b border-solid border-border px-5 last:border-b-0 ${
                                picked?.id === row.id || selection.has(row.id)
                                    ? 'bg-primary-tint'
                                    : 'hover:bg-surface'
                            }`}
                        >
                            <span className="flex w-4 shrink-0">
                                <Checkbox
                                    label={t('Select :row', {
                                        row: `${row.subject} · ${row.class}`,
                                    })}
                                    checked={selection.has(row.id)}
                                    onChange={() => selection.toggle(row.id)}
                                />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                <span className="truncate text-[15px] leading-5 font-semibold text-text">
                                    {row.subject}
                                </span>
                                <span className="truncate text-[13px] leading-4 text-text-muted">
                                    {row.class} ·{' '}
                                    {row.state === 'not_submitted' ||
                                    row.state === 'sent_back'
                                        ? row.state === 'sent_back'
                                            ? t('sent back for changes')
                                            : t('not written yet')
                                        : t(':count sub-topics', {
                                              count: row.topics,
                                          })}
                                </span>
                            </span>
                            <span className="flex w-[200px] shrink-0 items-center gap-[10px]">
                                {row.teacher ? (
                                    <>
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary">
                                            {row.initials}
                                        </span>
                                        <span className="truncate text-[14px] text-text">
                                            {row.teacher}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-text-disabled text-[14px] text-text-muted">
                                            +
                                        </span>
                                        {canManage && row.subject_id ? (
                                            <Link
                                                href={subjectShow.url(
                                                    row.subject_id,
                                                )}
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                                className="text-[14px] font-medium text-primary hover:underline"
                                            >
                                                {t('Assign a teacher')}
                                            </Link>
                                        ) : (
                                            <span className="text-[14px] text-text-muted">
                                                {t('No teacher yet')}
                                            </span>
                                        )}
                                    </>
                                )}
                            </span>
                            <span className="flex w-[280px] shrink-0 items-center">
                                {row.state === 'not_submitted' ||
                                row.state === 'sent_back' ? (
                                    <span className="text-[13px] text-danger">
                                        {daysLate > 0
                                            ? t(
                                                  'Was due :due · :days days late',
                                                  {
                                                      due: dayMonth(
                                                          dueOn,
                                                          false,
                                                      ),
                                                      days: daysLate,
                                                  },
                                              )
                                            : t('Due :due', {
                                                  due: dayMonth(dueOn, false),
                                              })}
                                    </span>
                                ) : (
                                    <ProgressCell row={row} />
                                )}
                            </span>
                            <span className="w-[140px] shrink-0">
                                {row.state === 'behind' ? (
                                    <span className="flex items-center gap-[6px] text-[13px] leading-4 text-warning-text">
                                        <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning" />
                                        {t('Behind · :count', {
                                            count: row.late,
                                        })}
                                    </span>
                                ) : (
                                    <StateLabel state={row.state} />
                                )}
                            </span>
                            <span className="w-5 shrink-0 text-[16px] text-text-muted">
                                ›
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <TableFooter
                paged={paged}
                onPage={table.page}
                onPerPage={table.perPage}
            />
        </div>
    );
}
