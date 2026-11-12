import { Link, router } from '@inertiajs/react';
import { edit } from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import { show } from '@/actions/App/Http/Controllers/SubjectController';
import {
    Checkbox,
    TableEmptyState,
    TableRowMenu,
    tableRowClass,
} from '../../table/ui';
import { t } from '../../../lib/i18n';
import { headClass, type SubjectRosterModel } from './model';
import { Staffing } from './staffing';

/** One row per subject: its code, department, levels and staffing. */
export function SubjectTable({ roster }: { roster: SubjectRosterModel }) {
    const { subjects, selection, openMenu, setOpenMenu } = roster;

    return (
        <div className="overflow-x-auto xl:overflow-visible">
            <div className="flex min-w-[930px] flex-col rounded-lg border border-solid border-border bg-white">
                <div className="flex items-center gap-3 rounded-t-lg border-b border-solid border-border bg-surface px-4 py-2">
                    <span className="flex w-4 shrink-0">
                        <Checkbox
                            label={t('Select this page')}
                            checked={selection.pageState === 'all'}
                            mixed={selection.pageState === 'some'}
                            onChange={selection.togglePage}
                        />
                    </span>
                    <span className={`${headClass} min-w-[180px] flex-1`}>
                        {t('Subject')}
                    </span>
                    <span className={`${headClass} w-[72px]`}>{t('Code')}</span>
                    <span className={`${headClass} w-[104px]`}>
                        {t('Department')}
                    </span>
                    <span className={`${headClass} w-[110px]`}>
                        {t('Levels')}
                    </span>
                    <span className={`${headClass} w-16`}>{t('Coeff.')}</span>
                    <span className={`${headClass} w-[200px]`}>
                        {t('Classes & teachers')}
                    </span>
                    <span className={`${headClass} w-[84px]`}>
                        {t('Periods')}
                    </span>
                    <span className="w-8 shrink-0" />
                </div>
                {subjects.rows.length === 0 && (
                    <TableEmptyState>
                        {t(
                            'No subject matches. Try another name, or clear the filters.',
                        )}
                    </TableEmptyState>
                )}
                {subjects.rows.map((row, position) => (
                    <div
                        key={row.id}
                        onClick={() => router.visit(show.url(row.id))}
                        className={`flex h-[62px] shrink-0 cursor-pointer items-center gap-3 border-b border-solid border-border px-4 py-2 last:rounded-b-lg last:border-b-0 ${tableRowClass({ index: position, selected: selection.has(row.id), interactive: true })}`}
                    >
                        <span className="flex w-4 shrink-0">
                            <Checkbox
                                label={t('Select :row', {
                                    row: row.name,
                                })}
                                checked={selection.has(row.id)}
                                onChange={() => selection.toggle(row.id)}
                            />
                        </span>
                        <span className="flex min-w-[180px] flex-1 flex-col">
                            <Link
                                href={show.url(row.id)}
                                onClick={(event) => event.stopPropagation()}
                                className="truncate text-[16px] leading-5 font-medium text-text hover:underline"
                            >
                                {row.name}
                            </Link>
                            <span className="text-[13px] leading-4 text-text-muted">
                                {row.kind} ·{' '}
                                <span
                                    className={
                                        row.domain
                                            ? ''
                                            : 'font-medium text-warning-text'
                                    }
                                >
                                    {row.domain
                                        ? t(
                                              row.domain
                                                  .charAt(0)
                                                  .toUpperCase() +
                                                  row.domain.slice(1),
                                          )
                                        : t('Needs classification')}
                                </span>
                            </span>
                        </span>
                        <span className="w-[72px] shrink-0 font-mono text-[13px] leading-4 text-text">
                            {row.code}
                        </span>
                        <span className="w-[104px] shrink-0 truncate text-[13px] leading-4 text-text">
                            {row.department}
                        </span>
                        <span className="w-[110px] shrink-0 truncate text-[13px] leading-4 text-text-muted">
                            {row.levels.join(', ') || '—'}
                        </span>
                        <span className="w-16 shrink-0 font-mono text-[13px] leading-4 text-text">
                            {row.coefficient ?? '—'}
                        </span>
                        <span className="w-[200px] shrink-0">
                            <Staffing row={row} />
                        </span>
                        <span className="w-[84px] shrink-0 font-mono text-[13px] leading-4 text-text">
                            {t(':periods / wk', {
                                periods: row.periods,
                            })}
                        </span>
                        <TableRowMenu
                            label={t('Actions for :row', {
                                row: row.name,
                            })}
                            open={openMenu === row.id}
                            onToggle={() =>
                                setOpenMenu(openMenu === row.id ? null : row.id)
                            }
                            onClose={() => setOpenMenu(null)}
                        >
                            <Link
                                role="menuitem"
                                href={show.url(row.id)}
                                className="flex h-8 items-center rounded-sm px-3 text-[13px] text-text hover:bg-surface"
                            >
                                {t('Open record')}
                            </Link>
                            <Link
                                role="menuitem"
                                href={edit.url(row.id)}
                                className="flex h-8 items-center rounded-sm px-3 text-[13px] text-text hover:bg-surface"
                            >
                                {t('Edit subject')}
                            </Link>
                        </TableRowMenu>
                    </div>
                ))}
            </div>
        </div>
    );
}
