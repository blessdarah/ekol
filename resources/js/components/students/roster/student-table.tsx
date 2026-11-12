import { Link, router } from '@inertiajs/react';
import { edit } from '@/actions/App/Http/Controllers/StudentRegistrationController';
import { show } from '@/actions/App/Http/Controllers/StudentController';
import { t } from '../../../lib/i18n';
import { StreamChip } from '../../structure/ui';
import {
    Checkbox,
    TableEmptyState,
    TableRowMenu,
    tableRowClass,
} from '../../table/ui';
import { FeePill, money } from '../ui';
import { type StudentRoster, headClass } from './model';

/** The page of students, each opening their record. */
export function StudentTable({ roster }: { roster: StudentRoster }) {
    const { currency, students, selection, openMenu, setOpenMenu } = roster;

    return (
        <div className="overflow-x-auto xl:overflow-visible">
            <div className="flex min-w-[912px] flex-col rounded-lg border border-solid border-border">
                <div className="flex h-9 shrink-0 items-center gap-3 rounded-t-lg border-b border-solid border-border bg-surface px-4">
                    <span className="flex w-4 shrink-0">
                        <Checkbox
                            label={t('Select this page')}
                            checked={selection.pageState === 'all'}
                            mixed={selection.pageState === 'some'}
                            onChange={selection.togglePage}
                        />
                    </span>
                    <span className={`${headClass} min-w-[200px] flex-[3]`}>
                        {t('Student')}
                    </span>
                    <span className={`${headClass} w-[100px]`}>
                        {t('Class')}
                    </span>
                    <span className={`${headClass} w-16`}>{t('Series')}</span>
                    <span className={`${headClass} min-w-[160px] flex-[2]`}>
                        {t('Guardian')}
                    </span>
                    <span className={`${headClass} w-[112px]`}>
                        {t('Fees')}
                    </span>
                    <span className={`${headClass} w-[110px] text-right`}>
                        {t('Balance')}
                    </span>
                    <span className="w-8 shrink-0" />
                </div>
                {students.rows.length === 0 && (
                    <TableEmptyState>
                        {t(
                            'No student matches. Try another name, or clear the filters.',
                        )}
                    </TableEmptyState>
                )}
                {students.rows.map((row, position) => (
                    <div
                        key={row.id}
                        onClick={() => router.visit(show.url(row.id))}
                        className={`flex h-14 shrink-0 cursor-pointer items-center gap-3 border-b border-solid border-border px-4 last:rounded-b-lg last:border-b-0 ${tableRowClass(
                            {
                                index: position,
                                selected: selection.has(row.id),
                                interactive: true,
                            },
                        )}`}
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
                        <span className="flex min-w-[200px] flex-[3] items-center gap-[10px]">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] leading-[14px] font-semibold text-primary">
                                {row.initials}
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <Link
                                    href={show.url(row.id)}
                                    onClick={(event) => event.stopPropagation()}
                                    className="truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                                >
                                    {row.name}
                                </Link>
                                <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                    {row.matricule}
                                </span>
                            </span>
                        </span>
                        <span className="w-[100px] shrink-0 truncate text-[14px] leading-[18px] text-text">
                            {row.class ?? '—'}
                        </span>
                        <span className="flex w-16 shrink-0 items-center">
                            {row.series ? (
                                <StreamChip stream={row.series.stream}>
                                    {row.series.code}
                                </StreamChip>
                            ) : row.needs_series ? (
                                <span className="flex items-center gap-[6px] text-[13px] leading-4 text-warning-text">
                                    <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                    {t('None')}
                                </span>
                            ) : (
                                <span className="text-text-muted">—</span>
                            )}
                        </span>
                        <span className="flex min-w-[160px] flex-[2] flex-col">
                            <span className="truncate text-[13px] leading-[18px] text-text">
                                {row.guardian}
                            </span>
                            <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                {row.phone}
                            </span>
                        </span>
                        <span className="flex w-[112px] shrink-0">
                            <FeePill status={row.fees} />
                        </span>
                        <span className="w-[110px] shrink-0 text-right font-mono text-[14px] leading-[18px] text-text">
                            {row.balance > 0
                                ? money(row.balance, currency)
                                : '–'}
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
                                {t('Edit student')}
                            </Link>
                        </TableRowMenu>
                    </div>
                ))}
            </div>
        </div>
    );
}
