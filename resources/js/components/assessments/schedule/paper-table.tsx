import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { Empty, amberText } from '../ui';
import { type Schedule, weekday } from './model';

/** The level's papers, one row per subject, each opening its form. */
export function PaperTable({ schedule }: { schedule: Schedule }) {
    const { rows, level, locked, editing, setEditing } = schedule;

    return (
        <>
            {rows.length === 0 ? (
                <Empty
                    title={t(':level takes no subjects yet', {
                        level: level.name,
                    })}
                >
                    {t(
                        'A paper is set for each subject the level’s classes take.',
                    )}
                </Empty>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[680px] flex-col">
                        <div
                            className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}
                        >
                            <span className="w-[96px] shrink-0">
                                {t('Day')}
                            </span>
                            <span className="w-[50px] shrink-0">
                                {t('Time')}
                            </span>
                            <span className="flex-1">{t('Subject')}</span>
                            <span className="w-9 shrink-0">{t('Hrs')}</span>
                            <span className="w-[90px] shrink-0">
                                {t('Room')}
                            </span>
                            <span className="w-[190px] shrink-0">
                                {t('Invigilators')}
                            </span>
                        </div>
                        {rows.map((row, position) => (
                            <button
                                key={row.subject_id}
                                type="button"
                                disabled={locked}
                                onClick={() => setEditing(row.subject_id)}
                                className={`flex min-h-10 items-center gap-4 border-b border-solid border-border px-[14px] py-[6px] text-left last:border-b-0 enabled:hover:bg-surface ${
                                    row.paper?.clash
                                        ? 'bg-warning-tint'
                                        : editing === row.subject_id
                                          ? 'bg-primary-tint'
                                          : position % 2 === 1
                                            ? 'bg-row-alt'
                                            : ''
                                }`}
                            >
                                <span className="w-[96px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                    {row.paper
                                        ? weekday(row.paper.held_on)
                                        : '—'}
                                </span>
                                <span className="w-[50px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                    {row.paper?.starts_at ?? '—'}
                                </span>
                                <span
                                    className={`min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium ${row.paper ? 'text-text' : 'text-text-muted'}`}
                                >
                                    {row.subject}
                                </span>
                                <span className="w-9 shrink-0 font-mono text-[13px] leading-4 text-text">
                                    {row.paper?.hours ?? ''}
                                </span>
                                <span
                                    className={`w-[90px] shrink-0 truncate text-[13px] leading-4 ${row.paper?.clash ? `font-semibold ${amberText}` : 'text-text'}`}
                                >
                                    {row.paper
                                        ? (row.paper.room ?? t('Not set'))
                                        : ''}
                                </span>
                                <span
                                    className={`w-[190px] shrink-0 truncate text-[13px] leading-4 ${row.paper ? 'text-text' : `font-medium ${amberText}`}`}
                                >
                                    {row.paper
                                        ? row.paper.invigilators.join(' · ') ||
                                          t('None yet')
                                        : t('No paper yet · set it')}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'A paper is for every student of the level who takes the subject.',
                )}
                {locked ? '' : t(' Pick a row to set or change its paper.')}
            </p>
        </>
    );
}
