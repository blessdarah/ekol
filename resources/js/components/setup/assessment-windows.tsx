import { useState } from 'react';
import { updateWindows } from '@/actions/App/Http/Controllers/SchoolScheduleController';
import { t } from '../../lib/i18n';
import {
    type AssessmentProp,
    useAutosave,
    Zone,
    dateInputClass,
    shortDate,
    ZoneError,
} from './shared';

export function WindowStatus({
    status,
}: {
    status: AssessmentProp['window_status'];
}) {
    if (status === 'open') {
        return (
            <span className="flex h-6 items-center gap-[6px] rounded-full bg-primary-tint px-[10px] text-[12px] leading-4 font-medium text-primary">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-primary" />
                {t('Open')}
            </span>
        );
    }

    if (status === 'closed') {
        return (
            <span className="flex h-6 items-center rounded-full border border-solid border-border bg-surface px-[10px] text-[12px] leading-4 font-medium text-text-muted">
                {t('Closed')}
            </span>
        );
    }

    return (
        <span className="text-[12px] leading-4 text-text-muted">
            {status === 'scheduled' ? t('Scheduled') : t('Not scheduled')}
        </span>
    );
}

export interface WindowRow {
    ids: string[];
    name: string;
    window_starts_on: string;
    window_ends_on: string;
}

export function windowRows(assessments: AssessmentProp[]): WindowRow[] {
    return assessments.map((row) => ({
        ids: row.ids,
        name: row.name,
        window_starts_on: row.window_starts_on ?? '',
        window_ends_on: row.window_ends_on ?? '',
    }));
}

export function WindowsZone({
    assessments,
}: {
    assessments: AssessmentProp[];
}) {
    const { data, save, error } = useAutosave(
        updateWindows.url(),
        { rows: windowRows(assessments) },
        (props) => ({ rows: windowRows(props.assessments) }),
        ({ rows }) => ({
            assessments: rows.flatMap((row) =>
                row.ids.map((id) => ({
                    id,
                    window_starts_on: row.window_starts_on || null,
                    window_ends_on: row.window_ends_on || null,
                })),
            ),
        }),
    );
    const [editing, setEditing] = useState<number | null>(null);

    function setRow(index: number, patch: Partial<WindowRow>) {
        save({
            rows: data.rows.map((row, i) =>
                i === index ? { ...row, ...patch } : row,
            ),
        });
    }

    return (
        <Zone
            title={t('Sequences & exams')}
            desc={t(
                'Teachers can enter marks only while a window is open. Pass marks are set by each teacher.',
            )}
        >
            {data.rows.length === 0 ? (
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'No sequences or exams yet. Their marks windows appear here once they are created.',
                    )}
                </p>
            ) : (
                <div className="flex flex-col">
                    {data.rows.map((row, index) => {
                        const status =
                            assessments.find(
                                (saved) => saved.ids[0] === row.ids[0],
                            )?.window_status ?? 'unscheduled';

                        return (
                            <div
                                key={row.ids[0]}
                                className="flex min-h-[44px] items-center gap-4 border-b border-solid border-border last:border-b-0"
                            >
                                <span className="flex-1 text-[14px] leading-[18px] font-medium text-text">
                                    {row.name}
                                </span>
                                {editing === index ? (
                                    <span className="flex shrink-0 items-center gap-1">
                                        <input
                                            type="date"
                                            aria-label={t(':row window opens', {
                                                row: row.name,
                                            })}
                                            value={row.window_starts_on}
                                            onChange={(e) =>
                                                setRow(index, {
                                                    window_starts_on:
                                                        e.target.value,
                                                })
                                            }
                                            className={dateInputClass}
                                        />
                                        <input
                                            type="date"
                                            aria-label={t(
                                                ':row window closes',
                                                { row: row.name },
                                            )}
                                            value={row.window_ends_on}
                                            min={row.window_starts_on}
                                            onChange={(e) =>
                                                setRow(index, {
                                                    window_ends_on:
                                                        e.target.value,
                                                })
                                            }
                                            className={dateInputClass}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setEditing(null)}
                                            className="text-[12px] leading-4 font-medium text-primary hover:underline"
                                        >
                                            {t('Done')}
                                        </button>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        title={t('Change marks window')}
                                        onClick={() => setEditing(index)}
                                        className={`w-[200px] shrink-0 text-left font-mono text-[13px] leading-4 hover:underline ${
                                            status === 'open'
                                                ? 'text-text'
                                                : 'text-text-muted'
                                        }`}
                                    >
                                        {row.window_starts_on &&
                                        row.window_ends_on
                                            ? `${shortDate(row.window_starts_on)} → ${shortDate(row.window_ends_on)}`
                                            : t('Set window')}
                                    </button>
                                )}
                                <span className="flex w-[130px] shrink-0 justify-end">
                                    <WindowStatus status={status} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            <ZoneError message={error} />
        </Zone>
    );
}
