import { t } from '../../../lib/i18n';
import { capsLabelClass, ErrorText } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { amberText, figure } from '../ui';
import { type FeeStructure, linkClass } from './model';

/** What each item costs at each level, and the total a student pays. */
export function AmountsByLevel({ fees }: { fees: FeeStructure }) {
    const {
        currency,
        year,
        levels,
        pageErrors,
        errors,
        drafts,
        dirty,
        totalOf,
        expected,
        hasNewOnly,
        change,
        billStudents,
    } = fees;

    return (
        <section className="flex flex-col gap-3">
            <p className={capsLabelClass}>
                {t('Amount by level · :currency', { currency })}
            </p>
            {levels.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'The school has no levels yet. Add them under Classes & Subjects, then set what each pays.',
                    )}
                </p>
            ) : drafts.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t('Add an item above to set what each level pays for it.')}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex w-max min-w-full flex-col">
                        <div
                            className={`flex min-h-9 items-center gap-3 border-b border-solid border-border bg-surface px-4 py-2 ${capsLabelClass}`}
                        >
                            <span className="w-[84px] shrink-0">
                                {t('Level')}
                            </span>
                            {drafts.map((item) => (
                                <span
                                    key={item.key}
                                    className="w-24 shrink-0 truncate"
                                    title={item.name}
                                >
                                    {item.name.trim() || t('Unnamed')}
                                </span>
                            ))}
                            <span className="min-w-24 flex-1 text-right">
                                {t('Total')}
                            </span>
                            <span className="w-24 shrink-0 text-right">
                                {t('Billed')}
                            </span>
                        </div>
                        {levels.map((level, position) => {
                            const total = totalOf(level.id, false);
                            const forNew = totalOf(level.id, true);
                            const waiting = level.has_fee
                                ? level.students - level.billed
                                : 0;

                            return (
                                <div
                                    key={level.id}
                                    className={`flex min-h-[52px] shrink-0 items-start gap-3 border-b border-solid border-border px-4 py-2 last:border-b-0 ${tableRowClass({ index: position })}`}
                                >
                                    <span className="flex h-9 w-[84px] shrink-0 items-center truncate text-[14px] leading-[18px] font-medium text-text">
                                        {level.name}
                                    </span>
                                    {drafts.map((item, column) => {
                                        const error =
                                            errors[
                                                `items.${column}.amounts.${level.id}`
                                            ];

                                        return (
                                            <span
                                                key={item.key}
                                                className="flex w-24 shrink-0 flex-col gap-1"
                                            >
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    aria-label={t(
                                                        ':item for :level',
                                                        {
                                                            item:
                                                                item.name ||
                                                                'Item',
                                                            level: level.name,
                                                        },
                                                    )}
                                                    value={
                                                        item.amounts[
                                                            level.id
                                                        ] ?? ''
                                                    }
                                                    onChange={(e) =>
                                                        change(item.key, {
                                                            amounts: {
                                                                ...item.amounts,
                                                                [level.id]:
                                                                    e.target.value.replace(
                                                                        /[^\d.]/g,
                                                                        '',
                                                                    ),
                                                            },
                                                        })
                                                    }
                                                    placeholder="—"
                                                    className={`h-9 w-full rounded-md border border-solid bg-white px-[10px] text-right font-mono text-[14px] leading-[18px] text-text outline-none placeholder:text-text-muted focus:border-primary ${error ? 'border-danger' : 'border-border'}`}
                                                />
                                                <ErrorText message={error} />
                                            </span>
                                        );
                                    })}
                                    <span className="flex min-h-9 min-w-24 flex-1 flex-col items-end justify-center gap-[2px] whitespace-nowrap">
                                        <span className="font-mono text-[14px] leading-[18px] font-medium text-text">
                                            {total > 0 || forNew > 0
                                                ? figure(total)
                                                : '—'}
                                        </span>
                                        {forNew > total && (
                                            <span className="font-mono text-[12px] leading-4 text-text-muted">
                                                {t(':for_new if new', {
                                                    for_new: figure(forNew),
                                                })}
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex min-h-9 w-24 shrink-0 flex-col items-end justify-center gap-[2px] text-right">
                                        <span className="font-mono text-[13px] leading-4 text-text">
                                            {t(':billed of :students', {
                                                billed: level.billed,
                                                students: level.students,
                                            })}
                                        </span>
                                        {waiting > 0 &&
                                            year.current &&
                                            !dirty && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        billStudents(level.id)
                                                    }
                                                    className={linkClass}
                                                >
                                                    {t('Bill :waiting now', {
                                                        waiting,
                                                    })}
                                                </button>
                                            )}
                                        {!level.has_fee &&
                                            level.students > 0 && (
                                                <span
                                                    className={`text-[12px] leading-4 ${amberText}`}
                                                >
                                                    {t('No fee, not billed')}
                                                </span>
                                            )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <ErrorText message={errors.year_id ?? pageErrors.bill} />
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'Leave an amount empty when a level does not pay the item, so that mock exam fees, say, are charged to the exam classes alone. With these fees and today’s enrolment, the school would bill',
                )}{' '}
                {figure(expected)} {currency} {t('for')} {t(year.label)}
                {hasNewOnly ? t(', before what new students pay on top') : ''}
                {t(
                    '. Changing the fees does not change invoices already issued; it applies to students billed from now on.',
                )}
            </p>
        </section>
    );
}
