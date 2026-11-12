import { t } from '../../../lib/i18n';
import { tableRowClass } from '../../table/ui';
import { CYCLE_LABELS, LockIcon, StreamChip } from '../ui';
import { type StructureLevels } from './model';

/** The levels table; a row selects the level shown in the panel. */
export function LevelsTable({ structure }: { structure: StructureLevels }) {
    const { levels, level, setSelectedId } = structure;

    return (
        <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-[640px] flex-col self-start overflow-clip rounded-lg border border-solid border-border">
                <div className="flex items-center gap-4 border-b border-solid border-border bg-surface px-4 py-2 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                    <span className="w-[150px] shrink-0">{t('Level')}</span>
                    <span className="w-[100px] shrink-0">{t('Cycle')}</span>
                    <span className="w-14 shrink-0 text-[11px] tracking-normal">
                        {t('Classes')}
                    </span>
                    <span className="w-16 shrink-0 text-[11px] tracking-normal">
                        {t('Students')}
                    </span>
                    <span className="flex-1">{t('Series')}</span>
                </div>
                {levels.map((option, position) => {
                    const active = option.id === level?.id;
                    const high = option.cycle === 'high_school';

                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSelectedId(option.id)}
                            className={`flex h-[54px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 text-left last:border-b-0 ${
                                active
                                    ? 'bg-primary-tint'
                                    : `hover:bg-surface ${tableRowClass({ index: position })}`
                            }`}
                        >
                            <span className="flex w-[150px] shrink-0 flex-col">
                                <span
                                    className={`truncate text-[15px] leading-5 ${active ? 'font-semibold text-primary' : 'font-medium text-text'}`}
                                >
                                    {option.name}
                                </span>
                                <span className="font-mono text-[12px] leading-4 text-text-muted">
                                    {option.code ?? '—'}
                                </span>
                            </span>
                            <span className="flex w-[100px] shrink-0">
                                <span
                                    className={`flex h-[22px] items-center rounded-full border border-solid px-2 text-[12px] leading-4 font-medium ${
                                        high
                                            ? 'border-primary bg-white text-primary'
                                            : 'border-border bg-surface text-text-muted'
                                    }`}
                                >
                                    {t(CYCLE_LABELS[option.cycle])}
                                </span>
                            </span>
                            <span className="w-14 shrink-0 font-mono text-[13px] leading-4 text-text">
                                {option.classes.length}
                            </span>
                            <span className="w-16 shrink-0 font-mono text-[13px] leading-4 text-text">
                                {option.students}
                            </span>
                            <span className="flex flex-1 items-center gap-[6px]">
                                {!option.uses_series ? (
                                    <>
                                        <LockIcon />
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {t('Not available')}
                                        </span>
                                    </>
                                ) : option.series.length > 0 ? (
                                    option.series.map((range) => (
                                        <StreamChip
                                            key={range.stream}
                                            stream={range.stream}
                                        >
                                            {t(range.label)}
                                        </StreamChip>
                                    ))
                                ) : (
                                    <span className="text-[13px] leading-4 text-warning">
                                        {t('No series set up yet')}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
