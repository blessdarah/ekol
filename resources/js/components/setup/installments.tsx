import { useState } from 'react';
import { updateInstallments } from '@/actions/App/Http/Controllers/SetupController';
import { t } from '../../lib/i18n';
import {
    type YearProp,
    type TemplateProp,
    useAutosave,
    Zone,
    ordinal,
    dateInputClass,
    shortDate,
    ZoneError,
} from './shared';

export function InstallmentsZone({
    year,
    templates,
}: {
    year: YearProp | null;
    templates: TemplateProp[];
}) {
    const { data, save, hold, error } = useAutosave(
        updateInstallments.url(year ? { query: { year: year.id } } : undefined),
        { templates },
        (props) => ({ templates: props.templates }),
    );
    const [editingDue, setEditingDue] = useState<number | null>(null);
    const rows = data.templates;
    const total = rows.reduce((sum, row) => sum + Number(row.percent || 0), 0);
    const balanced = Math.abs(total - 100) < 0.01;

    // An unbalanced split is kept locally until it adds up again.
    function commit(next: TemplateProp[]) {
        const sum = next.reduce(
            (acc, row) => acc + Number(row.percent || 0),
            0,
        );

        if (next.length > 0 && Math.abs(sum - 100) < 0.01) {
            save({ templates: next });
        } else {
            hold({ templates: next });
        }
    }

    function setRow(index: number, patch: Partial<TemplateProp>) {
        commit(
            rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
        );
    }

    function addRow() {
        commit([
            ...rows,
            {
                seq: rows.length + 1,
                percent: rows.length === 0 ? 100 : 0,
                due_on: null,
            },
        ]);
    }

    function removeRow() {
        const removed = rows[rows.length - 1];
        const kept = rows.slice(0, -1);
        const last = kept[kept.length - 1];

        commit([
            ...kept.slice(0, -1),
            {
                ...last,
                percent:
                    Number(last.percent || 0) + Number(removed.percent || 0),
            },
        ]);
    }

    return (
        <Zone
            title={t('Fee installments')}
            desc={t(
                'Applies to every student. Partial payments fill the oldest installment first.',
            )}
        >
            <div className="flex items-center gap-3">
                <span className="text-[13px] leading-4 font-medium text-text">
                    {t('Number of installments')}
                </span>
                <div className="flex h-[34px] items-center rounded-md border border-solid border-border">
                    <button
                        type="button"
                        aria-label={t('Fewer installments')}
                        disabled={!year || rows.length <= 1}
                        onClick={removeRow}
                        className="flex h-8 w-[34px] items-center justify-center border-r border-solid border-border text-[16px] leading-5 text-text enabled:hover:bg-surface disabled:text-text-muted disabled:opacity-60"
                    >
                        −
                    </button>
                    <span className="w-[44px] text-center font-mono text-[14px] leading-[18px] text-text">
                        {rows.length}
                    </span>
                    <button
                        type="button"
                        aria-label={t('More installments')}
                        disabled={!year || rows.length >= 12}
                        onClick={addRow}
                        className="flex h-8 w-[34px] items-center justify-center border-l border-solid border-border text-[16px] leading-5 text-text enabled:hover:bg-surface disabled:opacity-40"
                    >
                        +
                    </button>
                </div>
                {rows.length > 0 && !balanced && (
                    <span className="text-[13px] leading-4 text-danger">
                        {t(
                            'Splits add up to :total%. They must total 100% to save.',
                            { total },
                        )}
                    </span>
                )}
            </div>
            {rows.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {rows.map((row, index) => (
                        <div
                            key={row.seq}
                            className="flex items-center justify-between rounded-md border border-solid border-border px-[14px] py-3"
                        >
                            <div className="flex flex-col gap-[2px]">
                                <span className="text-[13px] leading-4 font-medium text-text">
                                    {ordinal(row.seq)}
                                </span>
                                {editingDue === index ? (
                                    <input
                                        type="date"
                                        autoFocus
                                        aria-label={t(
                                            ':seq installment due date',
                                            { seq: ordinal(row.seq) },
                                        )}
                                        value={row.due_on ?? ''}
                                        min={year?.starts_on}
                                        max={year?.ends_on}
                                        onChange={(e) =>
                                            setRow(index, {
                                                due_on: e.target.value || null,
                                            })
                                        }
                                        onBlur={() => setEditingDue(null)}
                                        className={dateInputClass}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        title={t('Change due date')}
                                        onClick={() => setEditingDue(index)}
                                        className="self-start text-[12px] leading-4 text-text-muted hover:underline"
                                    >
                                        {row.due_on
                                            ? t('Due :due_on', {
                                                  due_on: shortDate(
                                                      row.due_on,
                                                      false,
                                                  ),
                                              })
                                            : t('Set due date')}
                                    </button>
                                )}
                            </div>
                            <label className="flex items-center font-mono text-[14px] leading-[18px] text-text">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    aria-label={t(':seq installment percent', {
                                        seq: ordinal(row.seq),
                                    })}
                                    value={row.percent}
                                    onChange={(e) =>
                                        setRow(index, {
                                            percent: e.target.value.replace(
                                                /[^\d.]/g,
                                                '',
                                            ),
                                        })
                                    }
                                    className="w-[5ch] rounded-sm bg-transparent text-right outline-none hover:bg-surface focus:bg-surface"
                                />
                                %
                            </label>
                        </div>
                    ))}
                </div>
            )}
            <ZoneError
                message={
                    !year
                        ? 'Create an academic year to set installments.'
                        : error
                }
            />
        </Zone>
    );
}
