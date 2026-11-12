import { capsLabelClass } from '../../structure/ui';
import { money } from '../ui';
import { t } from '../../../lib/i18n';
import { CheckAside } from './check-aside';
import { FileBar } from './file-bar';
import { type CheckStepProps, useCheckStep } from './model';
import { ProblemTable } from './problem-table';

/** The last step: what the check found, before importing. */
export function CheckStep(props: CheckStepProps) {
    const check = useCheckStep(props);
    const { file, mapping, report, stats } = check;

    return (
        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
                <FileBar
                    file={file}
                    note={`${mapping.length} columns matched`}
                />
                <dl className="flex border-y border-solid border-border">
                    {stats.map(([label, value, tone], position) => (
                        <div
                            key={label}
                            className={`flex flex-1 flex-col gap-1 py-[14px] ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                        >
                            <dt className={capsLabelClass}>{label}</dt>
                            <dd
                                className={`font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] ${tone}`}
                            >
                                {money(value)}
                            </dd>
                        </div>
                    ))}
                </dl>
                {report.problems.length === 0 ? (
                    <p className="rounded-md bg-success-tint p-4 text-[13px] leading-[19px] text-text">
                        {t('Every row is ready. Nothing needs fixing.')}
                    </p>
                ) : (
                    <ProblemTable check={check} />
                )}
                {report.problems.length > 0 && (
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Rows with problems are skipped. Download them, fix them in the spreadsheet and import that file afterwards.',
                        )}
                    </p>
                )}
            </div>

            <CheckAside check={check} />
        </div>
    );
}
