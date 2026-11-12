import { student } from '@/actions/App/Http/Controllers/FeePaymentController';
import { Link, router } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { Checkbox, tableRowClass } from '../../table/ui';
import { StatePill, amberText, figure } from '../ui';
import { type FeesOverview } from './model';

/** One row per student: billed, paid, balance and status. */
export function StudentsTable({ fees }: { fees: FeesOverview }) {
    const { students, counts, yearLabel, selection } = fees;

    return students.rows.length === 0 ? (
        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
            {counts.all === 0
                ? t('No student is enrolled in :year_label yet.', {
                      year_label: yearLabel,
                  })
                : t('No student matches.')}
        </p>
    ) : (
        <div className="overflow-x-auto rounded-lg border border-solid border-border">
            <div className="flex min-w-[900px] flex-col">
                <div
                    className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                >
                    <span className="flex w-4 shrink-0">
                        <Checkbox
                            label={t('Select this page')}
                            checked={selection.pageState === 'all'}
                            mixed={selection.pageState === 'some'}
                            onChange={selection.togglePage}
                        />
                    </span>
                    <span className="flex-1">{t('Student')}</span>
                    <span className="w-[110px] shrink-0">{t('Class')}</span>
                    <span className="w-[100px] shrink-0 text-right">
                        {t('Annual fees')}
                    </span>
                    <span className="w-[100px] shrink-0 text-right">
                        {t('Paid')}
                    </span>
                    <span className="w-[100px] shrink-0 text-right">
                        {t('Balance')}
                    </span>
                    <span className="w-[110px] shrink-0">{t('Status')}</span>
                    <span className="w-[60px] shrink-0" />
                </div>
                {students.rows.map((row, position) => (
                    <div
                        key={row.id}
                        onClick={() => router.visit(student.url(row.id))}
                        className={`flex h-[52px] shrink-0 cursor-pointer items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 ${tableRowClass({ index: position, selected: selection.has(row.id), interactive: true })}`}
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
                        <span className="flex min-w-0 flex-1 flex-col">
                            <Link
                                href={student.url(row.id)}
                                onClick={(event) => event.stopPropagation()}
                                className="truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                            >
                                {row.name}
                            </Link>
                            <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                {row.matricule}
                            </span>
                        </span>
                        <span className="w-[110px] shrink-0 truncate text-[13px] leading-4 text-text">
                            {row.class ?? '—'}
                        </span>
                        <span className="w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                            {row.state === 'unbilled' ? '—' : figure(row.due)}
                        </span>
                        <span className="w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 text-success">
                            {row.state === 'unbilled' ? '—' : figure(row.paid)}
                        </span>
                        <span
                            className={`w-[100px] shrink-0 text-right font-mono text-[13px] leading-4 ${row.overdue > 0 ? 'text-danger' : row.balance > 0 ? amberText : 'text-text-muted'}`}
                        >
                            {row.state === 'unbilled'
                                ? '—'
                                : figure(row.balance)}
                        </span>
                        <span className="flex w-[110px] shrink-0">
                            <StatePill state={row.state} />
                        </span>
                        <span className="w-[60px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary">
                            {t('Open')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
