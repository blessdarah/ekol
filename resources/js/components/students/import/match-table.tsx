import { ErrorText, fieldInputClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type MatchStepModel } from './model';

/** Each field we need, the file column it is read from, and its first values. */
export function MatchTable({ match }: { match: MatchStepModel }) {
    const { fields, file, sample, chosen, setChosen, errors } = match;

    return (
        <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
            <div className="flex h-8 shrink-0 items-center gap-4 bg-surface px-4 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                <span className="w-[200px] shrink-0">{t('We need')}</span>
                <span className="w-[260px] shrink-0">
                    {t('Column in your file')}
                </span>
                <span className="flex-1">{t('First rows')}</span>
            </div>
            {fields.map((field) => {
                const column = chosen[field.key];
                const error = errors[`mapping.${field.key}`];

                return (
                    <div
                        key={field.key}
                        className="flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-1 border-t border-solid border-border px-4 py-2"
                    >
                        <span className="flex w-[200px] shrink-0 flex-col">
                            <span className="text-[14px] leading-[18px] font-medium text-text">
                                {t(field.label)}
                            </span>
                            {!field.required && (
                                <span className="text-[12px] leading-4 text-text-muted">
                                    {t('optional')}
                                </span>
                            )}
                        </span>
                        <span className="flex w-[260px] shrink-0 flex-col gap-1">
                            <select
                                aria-label={t('Column for :label', {
                                    label: field.label,
                                })}
                                value={column}
                                onChange={(e) =>
                                    setChosen({
                                        ...chosen,
                                        [field.key]: e.target.value,
                                    })
                                }
                                className={`${fieldInputClass} h-9 text-[14px] ${
                                    field.required && column === ''
                                        ? 'border-warning bg-warning-tint'
                                        : ''
                                }`}
                            >
                                <option value="">
                                    {field.required
                                        ? t('Choose a column')
                                        : t('Not in this file')}
                                </option>
                                {file.headers.map((header, position) => (
                                    <option
                                        key={`${header}-${position}`}
                                        value={position}
                                    >
                                        {header ||
                                            t('Column :position', {
                                                position: position + 1,
                                            })}
                                    </option>
                                ))}
                            </select>
                            <ErrorText message={error} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px] leading-4 text-text-muted">
                            {column === ''
                                ? '—'
                                : sample
                                      .map((row) => row[Number(column)])
                                      .filter(Boolean)
                                      .join(' · ') || '—'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
