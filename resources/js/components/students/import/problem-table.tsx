import { tableRowClass } from '../../table/ui';
import { t } from '../../../lib/i18n';
import { type CheckStepModel } from './model';

/** The rows that need fixing or may be duplicates, a few at a time. */
export function ProblemTable({ check }: { check: CheckStepModel }) {
    const { report, showAll, setShowAll, shown } = check;

    return (
        <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
            <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                <span className="w-11 shrink-0">{t('Row')}</span>
                <span className="w-[170px] shrink-0">{t('Student')}</span>
                <span className="flex-1">{t('Problem')}</span>
            </div>
            {shown.map((problem, position) => (
                <div
                    key={problem.row}
                    className={`flex min-h-[42px] items-center gap-3 border-t border-solid border-border px-3 py-2 ${tableRowClass({ index: position })}`}
                >
                    <span className="w-11 shrink-0 font-mono text-[13px] leading-4 text-text-muted">
                        {problem.row}
                    </span>
                    <span className="w-[170px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text">
                        {problem.name}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-[18px] text-text">
                        <span
                            className={`h-[6px] w-[6px] shrink-0 rounded-full ${problem.status === 'duplicate' ? 'bg-warning' : 'bg-danger'}`}
                        />
                        {problem.problem}
                    </span>
                </div>
            ))}
            <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                <span className="text-[13px] leading-4 text-text-muted">
                    {t(':shown of :problems shown', {
                        shown: shown.length,
                        problems: report.problems.length,
                    })}
                </span>
                {report.problems.length > 6 && (
                    <button
                        type="button"
                        onClick={() => setShowAll(!showAll)}
                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {showAll
                            ? t('Show fewer')
                            : t('Show all :problems', {
                                  problems: report.problems.length,
                              })}
                    </button>
                )}
            </div>
        </div>
    );
}
