import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { amberText, score } from '../ui';
import { Correction } from './correction';
import type { MarkSheetModel } from './model';

/** One row per student: the mark, a remark, and the result or a correction. */
export function MarkTable({ model }: { model: MarkSheetModel }) {
    const {
        passMark,
        sheet,
        open,
        previous,
        rows,
        entries,
        correcting,
        setCorrecting,
        inputs,
        published,
        valueOf,
        patch,
    } = model;

    return (
        <>
            {rows.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t('No student is enrolled in :class yet.', {
                        class: sheet.class,
                    })}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[760px] flex-col">
                        <div
                            className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                        >
                            <span className="w-7 shrink-0">#</span>
                            <span className="flex-1">{t('Student')}</span>
                            <span className="w-[70px] shrink-0 text-right">
                                {previous
                                    ? previous.replace('Sequence', 'Seq')
                                    : ''}
                            </span>
                            <span className="w-[112px] shrink-0 text-right text-text">
                                / {sheet.max}
                            </span>
                            <span className="w-[250px] shrink-0">
                                {t('Remark')}
                            </span>
                            <span className="w-[130px] shrink-0">
                                {t('Result')}
                            </span>
                        </div>
                        {rows.map((row, position) => {
                            const entry = entries[row.student_id];
                            const value = valueOf(row.student_id);
                            const over =
                                !entry.absent &&
                                value !== null &&
                                value > sheet.max;
                            const below =
                                !entry.absent &&
                                value !== null &&
                                !over &&
                                value < passMark;

                            return (
                                <div
                                    key={row.student_id}
                                    className="flex flex-col border-b border-solid border-border last:border-b-0"
                                >
                                    <div
                                        className={`flex min-h-12 items-center gap-4 px-4 py-[6px] ${tableRowClass({ index: position })}`}
                                    >
                                        <span className="w-7 shrink-0 font-mono text-[12px] leading-4 text-text-muted">
                                            {String(position + 1).padStart(
                                                2,
                                                '0',
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium text-text">
                                            {row.name}
                                        </span>
                                        <span className="w-[70px] shrink-0 text-right font-mono text-[13px] leading-4 text-text-muted">
                                            {score(row.previous)}
                                        </span>
                                        <span className="w-[112px] shrink-0">
                                            {open ? (
                                                <input
                                                    ref={(element) => {
                                                        inputs.current[
                                                            row.student_id
                                                        ] = element;
                                                    }}
                                                    type="text"
                                                    inputMode="decimal"
                                                    aria-label={t(
                                                        'Mark for :row',
                                                        { row: row.name },
                                                    )}
                                                    value={
                                                        entry.absent
                                                            ? ''
                                                            : entry.score
                                                    }
                                                    disabled={entry.absent}
                                                    placeholder={
                                                        entry.absent
                                                            ? t('ABS')
                                                            : '—'
                                                    }
                                                    onChange={(e) =>
                                                        patch(row.student_id, {
                                                            score: e.target.value.replace(
                                                                /[^\d.]/g,
                                                                '',
                                                            ),
                                                        })
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            inputs.current[
                                                                rows[
                                                                    position + 1
                                                                ]?.student_id ??
                                                                    ''
                                                            ]?.focus();
                                                        }
                                                    }}
                                                    className={`h-8 w-full rounded-sm border border-solid px-[10px] text-right font-mono text-[14px] leading-[18px] outline-none focus:border-2 focus:border-primary disabled:bg-surface ${
                                                        over
                                                            ? 'border-danger bg-danger-tint text-danger'
                                                            : below
                                                              ? 'border-border text-danger'
                                                              : value === null
                                                                ? 'border-dashed border-border text-text'
                                                                : 'border-border text-text'
                                                    }`}
                                                />
                                            ) : (
                                                <span
                                                    className={`block text-right font-mono text-[14px] leading-[18px] ${below ? 'text-danger' : 'text-text'}`}
                                                >
                                                    {entry.absent
                                                        ? t('ABS')
                                                        : score(value)}
                                                </span>
                                            )}
                                        </span>
                                        <span className="w-[250px] shrink-0">
                                            {over ? (
                                                <span className="text-[13px] leading-4 text-danger">
                                                    {t(
                                                        'Mark can’t be above :sheet',
                                                        { sheet: sheet.max },
                                                    )}
                                                </span>
                                            ) : open ? (
                                                <input
                                                    type="text"
                                                    aria-label={t(
                                                        'Remark for :row',
                                                        { row: row.name },
                                                    )}
                                                    value={entry.remark}
                                                    onChange={(e) =>
                                                        patch(row.student_id, {
                                                            remark: e.target
                                                                .value,
                                                        })
                                                    }
                                                    placeholder={t(
                                                        'Add a remark…',
                                                    )}
                                                    className="h-8 w-full rounded-sm bg-transparent text-[13px] leading-4 text-text outline-none placeholder:text-text-muted focus:bg-white focus:px-2 focus:outline focus:outline-1 focus:outline-primary"
                                                />
                                            ) : (
                                                <span className="text-[13px] leading-4 text-text-muted">
                                                    {entry.remark}
                                                </span>
                                            )}
                                        </span>
                                        <span className="flex w-[130px] shrink-0 items-center">
                                            {published && row.mark_id ? (
                                                row.correction !== null ? (
                                                    <span
                                                        className={`text-[12px] leading-4 ${amberText}`}
                                                    >
                                                        {t(
                                                            'Correction to :correction waiting',
                                                            {
                                                                correction:
                                                                    score(
                                                                        row.correction,
                                                                    ),
                                                            },
                                                        )}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCorrecting(
                                                                correcting ===
                                                                    row.student_id
                                                                    ? null
                                                                    : row.student_id,
                                                            )
                                                        }
                                                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                                    >
                                                        {t('Ask correction')}
                                                    </button>
                                                )
                                            ) : entry.absent ? (
                                                open ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            patch(
                                                                row.student_id,
                                                                {
                                                                    absent: false,
                                                                },
                                                            )
                                                        }
                                                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                                    >
                                                        {t('Not absent')}
                                                    </button>
                                                ) : (
                                                    <span className="text-[13px] leading-4 text-text-muted">
                                                        {t('Absent')}
                                                    </span>
                                                )
                                            ) : value === null ? (
                                                open && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            patch(
                                                                row.student_id,
                                                                {
                                                                    absent: true,
                                                                    score: '',
                                                                },
                                                            )
                                                        }
                                                        className="flex h-6 items-center rounded-full border border-solid border-border bg-surface px-[10px] text-[12px] leading-4 font-medium text-text hover:bg-white"
                                                    >
                                                        {t('Absent?')}
                                                    </button>
                                                )
                                            ) : over ? null : (
                                                <span
                                                    className={`flex h-6 items-center rounded-full px-[10px] text-[12px] leading-4 font-medium ${
                                                        below
                                                            ? 'bg-danger-tint text-danger'
                                                            : 'bg-success-tint text-success'
                                                    }`}
                                                >
                                                    {below
                                                        ? t('Below')
                                                        : t('Pass')}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {correcting === row.student_id && (
                                        <Correction
                                            row={row}
                                            max={sheet.max}
                                            onClose={() => setCorrecting(null)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
